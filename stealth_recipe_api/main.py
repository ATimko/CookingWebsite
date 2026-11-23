"""Recipe URL import API powered by jpjacobpadilla/Stealth-Requests."""
from __future__ import annotations

import html
import ipaddress
import json
import logging
import os
import socket
from datetime import datetime
from typing import Any
from urllib.parse import urljoin, urlparse, urlunparse

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from stealth_requests import StealthSession

MAX_HTML_BYTES = 3 * 1024 * 1024
MAX_REDIRECTS = 4
TIMEOUT_SECONDS = 18
REDIRECT_CODES = {301, 302, 303, 307, 308}


def _public_host(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Only http and https recipe pages are supported.")
    if not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Enter a valid public recipe page URL.")
    if parsed.port and parsed.port not in {80, 443}:
        raise ValueError("Recipe pages must use standard web ports.")
    host = parsed.hostname.lower().rstrip(".")
    if host in {"localhost"} or host.endswith((".localhost", ".local", ".internal")):
        raise ValueError("Local or private network addresses are not supported.")
    try:
        addresses = [ipaddress.ip_address(host)]
    except ValueError:
        try:
            records = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
        except OSError as exc:
            raise ValueError("The recipe website hostname could not be resolved.") from exc
        addresses = list({ipaddress.ip_address(record[4][0]) for record in records})
    if not addresses or any(not address.is_global for address in addresses):
        raise ValueError("Local or private network addresses are not supported.")


def _fetch_html(value: str) -> tuple[str, str]:
    current = value
    with StealthSession() as session:
        for redirect_count in range(MAX_REDIRECTS + 1):
            _public_host(current)
            response = session.get(
                current,
                timeout=TIMEOUT_SECONDS,
                retry=1,
                allow_redirects=False,
                headers={"Accept": "text/html,application/xhtml+xml"},
            )
            if response.status_code in REDIRECT_CODES:
                location = response.headers.get("location")
                if not location:
                    raise ValueError("The recipe website returned an invalid redirect.")
                if redirect_count >= MAX_REDIRECTS:
                    raise ValueError("The recipe website redirected too many times.")
                current = urljoin(current, location)
                continue
            if response.status_code != 200:
                raise ValueError(f"The recipe website returned HTTP {response.status_code}.")
            content_type = response.headers.get("content-type", "")
            if "text/html" not in content_type.lower() and "application/xhtml+xml" not in content_type.lower():
                raise ValueError("The URL did not return an HTML recipe page.")
            body = response.content
            if len(body) > MAX_HTML_BYTES:
                raise ValueError("The recipe page is too large to import.")
            encoding = getattr(response, "encoding", None) or "utf-8"
            return body.decode(encoding, errors="replace"), current
    raise ValueError("The recipe page could not be fetched.")


def _recipe_nodes(value: Any, output: list[dict[str, Any]]) -> None:
    if isinstance(value, list):
        for item in value:
            _recipe_nodes(item, output)
    elif isinstance(value, dict):
        types = value.get("@type", [])
        if not isinstance(types, list):
            types = [types]
        if any(isinstance(item, str) and item.lower().split("/")[-1].split("#")[-1] == "recipe" for item in types):
            output.append(value)
        for item in value.values():
            if isinstance(item, (dict, list)):
                _recipe_nodes(item, output)


def _first_string(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, list):
        return _first_string(value[0]) if value else ""
    if isinstance(value, dict):
        return _first_string(value.get("name") or value.get("url") or value.get("contentUrl"))
    return ""


def _instructions(value: Any, output: list[str]) -> None:
    if isinstance(value, str):
        if value.strip():
            output.append(value.strip())
    elif isinstance(value, list):
        for item in value:
            _instructions(item, output)
    elif isinstance(value, dict):
        if isinstance(value.get("text"), str) and value["text"].strip():
            output.append(value["text"].strip())
        else:
            _instructions(value.get("itemListElement") or value.get("recipeInstructions") or value.get("steps"), output)


def _duration(value: Any) -> int | None:
    if not isinstance(value, str):
        return None
    import re
    match = re.fullmatch(r"P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?", value, re.I)
    if not match:
        return None
    days, hours, minutes = (int(part or 0) for part in match.groups())
    total = days * 1440 + hours * 60 + minutes
    return total or None


def parse_recipe(html_text: str, source_url: str) -> dict[str, Any]:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html_text, "html.parser")
    recipes: list[dict[str, Any]] = []
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = script.string or script.get_text()
        if not raw:
            continue
        try:
            _recipe_nodes(json.loads(raw.strip()), recipes)
        except (json.JSONDecodeError, TypeError):
            try:
                _recipe_nodes(json.loads(html.unescape(raw.strip())), recipes)
            except (json.JSONDecodeError, TypeError):
                continue
    recipe = next((item for item in recipes if isinstance(item.get("recipeIngredient"), list) and item.get("recipeIngredient") and item.get("recipeInstructions")), None)
    if not recipe:
        raise ValueError("No complete Schema.org Recipe data was found on this page. Try another recipe page or enter it manually.")

    ingredients = [item.strip() for item in recipe["recipeIngredient"] if isinstance(item, str) and item.strip()]
    steps: list[str] = []
    _instructions(recipe.get("recipeInstructions"), steps)
    title = _first_string(recipe.get("name"))
    if not title or not ingredients or not steps:
        raise ValueError("The page has recipe metadata, but it is missing a title, ingredients, or instructions.")

    author = recipe.get("author")
    if isinstance(author, list):
        author = ", ".join(filter(None, (_first_string(item.get("name") if isinstance(item, dict) else item) for item in author)))
    else:
        author = _first_string(author.get("name") if isinstance(author, dict) else author)

    image = _first_string(recipe.get("image"))
    if image:
        image = urljoin(source_url, image)
    parsed = urlparse(source_url)
    prep, cook = _duration(recipe.get("prepTime")), _duration(recipe.get("cookTime"))
    total = _duration(recipe.get("totalTime")) or ((prep or 0) + (cook or 0) or None)
    return {
        "title": title,
        "category": _first_string(recipe.get("recipeCategory")) or "My recipes",
        "description": _first_string(recipe.get("description")),
        "author": author or "You",
        "time": total,
        "servings": _first_string(recipe.get("recipeYield")),
        "image": image,
        "ingredients": ingredients,
        "steps": steps,
        "source": (parsed.hostname or "").removeprefix("www."),
        "sourceUrl": source_url,
        "originalSourceUrl": source_url,
        "attribution": author or (parsed.hostname or ""),
    }


app = FastAPI(title="Grassy Stealth Recipe Import API", version="1.0.0")
allowed_origins = [item.strip() for item in os.getenv("ALLOWED_ORIGINS", "*").split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type"],
)


class ParseRequest(BaseModel):
    url: HttpUrl
    permissionConfirmed: bool = False


@app.get("/")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "Grassy Stealth Recipe Import API"}


@app.post("/api/recipes/parse")
def import_recipe(payload: ParseRequest) -> dict[str, Any]:
    if not payload.permissionConfirmed:
        raise HTTPException(status_code=400, detail="Confirm that you own or have permission to reuse this recipe.")
    try:
        logging.info("Starting recipe import for host: %s", urlparse(str(payload.url)).hostname)
        page, final_url = _fetch_html(str(payload.url))
        logging.info("Fetched recipe page successfully; parsing structured recipe data.")
        recipe = parse_recipe(page, final_url)
        logging.info("Recipe import succeeded.")
        return {"recipe": recipe}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        # Keep the browser response generic, but record the full traceback in Render logs.
        logging.exception("Unexpected recipe import failure (%s)", type(exc).__name__)
        raise HTTPException(status_code=502, detail="The recipe page could not be imported. Check the API service logs for the underlying error.") from exc
