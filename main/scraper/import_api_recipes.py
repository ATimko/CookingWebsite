"""Import recipes from APIs whose credentials stay in this local process."""

import argparse
import base64
import json
import os
import random
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = ROOT / "public" / "recipes.json"
THEMEALDB_BASE = "https://www.themealdb.com/api/json/v1/1"
RECIPE_API_BASE = "https://recipe-api.com/api/v1"
FATSECRET_TOKEN_URL = "https://oauth.fatsecret.com/connect/token"
FATSECRET_API_URL = "https://platform.fatsecret.com/rest/server.api"


def fetch_json(url, *, headers=None, data=None):
    request = urllib.request.Request(url, headers=headers or {}, data=data)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"API request failed ({error.code}) for {url}: {detail}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"API request failed for {url}: {error.reason}") from error


def _mealdb_recipe(meal):
    ingredients = []
    for index in range(1, 21):
        ingredient = (meal.get(f"strIngredient{index}") or "").strip()
        if not ingredient:
            continue
        measure = (meal.get(f"strMeasure{index}") or "").strip()
        ingredients.append(f"{measure} {ingredient}".strip())

    instructions = re.split(r"\n+", meal.get("strInstructions") or "")
    steps = [re.sub(r"\s+", " ", step).strip() for step in instructions]
    steps = [
        step
        for step in steps
        if step and not re.fullmatch(r"step\s+\d+\s*[:.]?", step, flags=re.IGNORECASE)
    ]
    meal_id = meal.get("idMeal")
    title = (meal.get("strMeal") or "").strip()
    if not meal_id or not title or not ingredients or not steps:
        return None
    if "\ufffd" in title or any("\ufffd" in step for step in steps):
        return None

    return {
        "id": f"themealdb-{meal_id}",
        "title": title,
        "category": "Imported collection",
        "sourceCategory": meal.get("strCategory"),
        "time": None,
        "servings": None,
        "rating": None,
        "reviews": None,
        "featured": False,
        "difficulty": "Varies",
        "ingredients": ingredients,
        "image": meal.get("strMealThumb") or None,
        "color": "sage",
        "description": "A community recipe from TheMealDB.",
        "author": "Community recipe",
        "steps": steps,
        "source": "TheMealDB",
        "sourceUrl": f"https://www.themealdb.com/meal/{meal_id}",
        "originalSourceUrl": meal.get("strSource") or None,
        "attribution": "TheMealDB",
        "license": None,
        "licenseUrl": None,
    }


def import_themealdb(limit):
    recipe_ids = []
    for letter in "abcdefghijklmnopqrstuvwxyz":
        query = urllib.parse.urlencode({"f": letter})
        result = fetch_json(f"{THEMEALDB_BASE}/search.php?{query}")
        for meal in result.get("meals") or []:
            meal_id = meal.get("idMeal")
            if meal_id and meal_id not in recipe_ids:
                recipe_ids.append(meal_id)
    random.SystemRandom().shuffle(recipe_ids)

    recipes = []
    for index, meal_id in enumerate(recipe_ids[: limit * 2]):
        if index:
            time.sleep(0.25)
        result = fetch_json(
            f"{THEMEALDB_BASE}/lookup.php?{urllib.parse.urlencode({'i': meal_id})}"
        )
        meals = result.get("meals") or []
        if meals:
            recipe = _mealdb_recipe(meals[0])
            if recipe:
                recipes.append(recipe)
                if len(recipes) >= limit:
                    break
    return recipes


def _duration_minutes(duration):
    if not duration:
        return None
    match = re.fullmatch(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?", duration)
    if not match:
        return None
    days, hours, minutes = (int(value or 0) for value in match.groups())
    total = days * 1440 + hours * 60 + minutes
    return total or None


def _recipe_api_recipe(recipe):
    ingredients = []
    for group in recipe.get("ingredients") or []:
        for item in group.get("items") or []:
            quantity = item.get("quantity")
            measure = " ".join(
                str(part)
                for part in (quantity, item.get("unit"))
                if part is not None and str(part).strip()
            )
            parts = [measure, item.get("name"), item.get("preparation"), item.get("notes")]
            ingredients.append(" ".join(str(part).strip() for part in parts if part))

    steps = [
        item["text"].strip()
        for item in recipe.get("instructions") or []
        if item.get("text", "").strip()
    ]
    title = (recipe.get("name") or "").strip()
    if not title or not ingredients or not steps:
        return None

    meta = recipe.get("meta") or {}
    return {
        "id": f"recipe-api-{recipe.get('id')}",
        "title": title,
        "category": "Imported collection",
        "sourceCategory": recipe.get("category"),
        "time": _duration_minutes(meta.get("total_time")),
        "servings": meta.get("yields") or None,
        "rating": None,
        "reviews": None,
        "featured": False,
        "difficulty": recipe.get("difficulty") or "Varies",
        "ingredients": ingredients,
        "image": recipe.get("image_url"),
        "color": "sage",
        "description": recipe.get("description") or "A structured recipe from Recipe API.",
        "author": "Community recipe",
        "steps": steps,
        "source": "Recipe API",
        "sourceUrl": "https://recipe-api.com/",
        "attribution": "Recipe API",
        "license": None,
        "licenseUrl": None,
    }


def import_recipe_api(limit, api_key):
    if limit <= 0:
        result = fetch_json(f"{RECIPE_API_BASE}/dinner")
        recipe = _recipe_api_recipe(result)
        return [recipe] if recipe else []
    if not api_key:
        raise RuntimeError("Set RECIPE_API_KEY before requesting Recipe API recipe details.")

    search_url = f"{RECIPE_API_BASE}/recipes?{urllib.parse.urlencode({'per_page': min(limit, 100)})}"
    headers = {"X-API-Key": api_key}
    result = fetch_json(search_url, headers=headers)
    recipes = []
    for summary in (result.get("data") or [])[:limit]:
        recipe_id = summary.get("id")
        if not recipe_id:
            continue
        detail = fetch_json(
            f"{RECIPE_API_BASE}/recipes/{urllib.parse.quote(str(recipe_id), safe='')}",
            headers=headers,
        )
        recipe = _recipe_api_recipe(detail.get("data") or {})
        if recipe:
            recipes.append(recipe)
    return recipes


def _fatsecret_request(token, params):
    body = urllib.parse.urlencode({**params, "format": "json"}).encode("utf-8")
    return fetch_json(
        FATSECRET_API_URL,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data=body,
    )


def _as_list(value):
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def _fatsecret_recipe(recipe):
    ingredients = [
        item.get("ingredient_description", "").strip()
        for item in _as_list((recipe.get("ingredients") or {}).get("ingredient"))
        if item.get("ingredient_description", "").strip()
    ]
    steps = [
        item.get("direction_description", "").strip()
        for item in _as_list((recipe.get("directions") or {}).get("direction"))
        if item.get("direction_description", "").strip()
    ]
    recipe_id = recipe.get("recipe_id")
    title = (recipe.get("recipe_name") or "").strip()
    if not recipe_id or not title or not ingredients or not steps:
        return None

    types = (recipe.get("recipe_types") or {}).get("recipe_type")
    category = next(iter(_as_list(types)), None)
    prep = int(recipe.get("preparation_time_min") or 0)
    cook = int(recipe.get("cooking_time_min") or 0)
    image = (recipe.get("recipe_images") or {}).get("recipe_image")
    if isinstance(image, list):
        image = image[0] if image else None
    if isinstance(image, dict):
        image = image.get("image")

    return {
        "id": f"fatsecret-{recipe_id}",
        "title": title,
        "category": "Imported collection",
        "sourceCategory": category,
        "time": prep + cook or None,
        "servings": recipe.get("number_of_servings") or None,
        "rating": None,
        "reviews": None,
        "featured": False,
        "difficulty": "Varies",
        "ingredients": ingredients,
        "image": image,
        "color": "sage",
        "description": recipe.get("recipe_description") or "A recipe from fatsecret.",
        "author": "Community recipe",
        "steps": steps,
        "source": "fatsecret",
        "sourceUrl": recipe.get("recipe_url") or "https://www.fatsecret.com/",
        "attribution": "fatsecret",
        "license": None,
        "licenseUrl": None,
    }


def import_fatsecret(limit, client_id, client_secret, search_expression):
    if limit <= 0:
        return []
    if bool(client_id) != bool(client_secret):
        raise RuntimeError("Set both FATSECRET_CLIENT_ID and FATSECRET_CLIENT_SECRET.")
    if not client_id:
        raise RuntimeError("Set fatsecret app credentials before requesting recipes.")

    credentials = f"{client_id}:{client_secret}".encode("utf-8")
    token_payload = urllib.parse.urlencode({"grant_type": "client_credentials", "scope": "basic"}).encode("ascii")
    token = fetch_json(
        FATSECRET_TOKEN_URL,
        headers={
            "Authorization": f"Basic {base64.b64encode(credentials).decode('ascii')}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data=token_payload,
    ).get("access_token")
    if not token:
        raise RuntimeError("fatsecret did not return an OAuth access token.")

    search = _fatsecret_request(
        token,
        {
            "method": "recipes.search.v3",
            "search_expression": search_expression,
            "max_results": min(limit, 50),
            "page_number": 0,
        },
    )
    summaries = _as_list((search.get("recipes") or {}).get("recipe"))
    recipes = []
    for summary in summaries[:limit]:
        recipe_id = summary.get("recipe_id")
        if not recipe_id:
            continue
        detail = _fatsecret_request(
            token,
            {"method": "recipe.get.v2", "recipe_id": recipe_id},
        )
        recipe = _fatsecret_recipe(detail.get("recipe") or {})
        if recipe:
            recipes.append(recipe)
    return recipes


def merge_recipes(output_path, additions, extra_file=None):
    existing = json.loads(output_path.read_text(encoding="utf-8")) if output_path.exists() else []
    if not isinstance(existing, list):
        raise ValueError(f"Expected a JSON array in {output_path}.")
    previous_count = len(existing)
    if extra_file:
        extra_recipes = json.loads(extra_file.read_text(encoding="utf-8"))
        if not isinstance(extra_recipes, list):
            raise ValueError(f"Expected a JSON array in {extra_file}.")
        existing.extend(extra_recipes)
    for recipe in existing:
        if recipe.get("category") == "Open collection":
            recipe["category"] = "Imported collection"
    replacement_sources = {recipe.get("source") for recipe in additions}
    by_id = {
        recipe["id"]: recipe
        for recipe in existing
        if recipe.get("id") and recipe.get("source") not in replacement_sources
    }
    for recipe in additions:
        by_id[recipe["id"]] = recipe
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(list(by_id.values()), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return previous_count, len(by_id)


def main():
    parser = argparse.ArgumentParser(description="Import recipes from free recipe APIs.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--themealdb-limit", type=int, default=30)
    parser.add_argument("--recipe-api-limit", type=int, default=0)
    parser.add_argument("--fatsecret-limit", type=int, default=0)
    parser.add_argument("--fatsecret-search", default="easy")
    parser.add_argument("--wikibooks-file", type=Path)
    args = parser.parse_args()
    if min(args.themealdb_limit, args.recipe_api_limit, args.fatsecret_limit) < 0:
        parser.error("Recipe limits must be zero or greater.")
    if args.recipe_api_limit > 50:
        parser.error("Recipe API evaluation keys allow at most 50 detail imports per run.")
    if args.wikibooks_file and not args.wikibooks_file.is_file():
        parser.error(f"Wikibooks dataset does not exist: {args.wikibooks_file}")

    recipes = import_themealdb(args.themealdb_limit) if args.themealdb_limit else []
    recipes.extend(import_recipe_api(args.recipe_api_limit, os.getenv("RECIPE_API_KEY")))
    recipes.extend(
        import_fatsecret(
            args.fatsecret_limit,
            os.getenv("FATSECRET_CLIENT_ID"),
            os.getenv("FATSECRET_CLIENT_SECRET"),
            args.fatsecret_search,
        )
    )
    if not recipes:
        raise RuntimeError("No complete recipes were returned; the existing dataset was not changed.")

    previous, total = merge_recipes(args.output, recipes, args.wikibooks_file)
    print(f"Imported {len(recipes)} recipes; dataset contains {total} unique recipes (previously {previous}).")


if __name__ == "__main__":
    main()
