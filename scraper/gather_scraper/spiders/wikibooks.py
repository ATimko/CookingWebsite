import re
from urllib.parse import quote

import scrapy
from scrapy import Selector


FEATURED_RECIPES_URL = "https://en.wikibooks.org/wiki/Category:Featured_recipes"
LICENSE_URL = "https://creativecommons.org/licenses/by-sa/4.0/"

INGREDIENT_HEADINGS = {"ingredient", "ingredients", "what you need"}
INSTRUCTION_HEADINGS = {
    "directions",
    "instructions",
    "method",
    "preparation",
    "procedure",
    "steps",
}


def _clean_text(selector):
    text_nodes = selector.xpath(
        './/text()[not(ancestor::style) and not(ancestor::script) '
        'and not(ancestor::*[contains(concat(" ", normalize-space(@class), " "), " mw-editsection ")])]'
    )
    parts = text_nodes.getall() if hasattr(text_nodes, "getall") else text_nodes
    return re.sub(r"\s+", " ", " ".join(parts)).strip()


def _section_name(text):
    normalized = re.sub(r"[^a-z ]", "", text.lower()).strip()
    for heading in INGREDIENT_HEADINGS:
        if normalized == heading or normalized.startswith(f"{heading} "):
            return "ingredients"
    for heading in INSTRUCTION_HEADINGS:
        if normalized == heading or normalized.startswith(f"{heading} "):
            return "instructions"
    return None


def extract_recipe(html, title, source_url):
    document = Selector(text=html)
    root = document.css(".mw-parser-output")
    if not root:
        return None

    sections = {"ingredients": [], "instructions": []}
    for heading in root.xpath(".//h2 | .//h3"):
        section = _section_name(_clean_text(heading))
        if not section:
            continue

        heading_node = heading.root
        wrapper = heading_node.getparent()
        if wrapper is not None and "mw-heading" in wrapper.get("class", "").split():
            first_sibling = wrapper
        else:
            first_sibling = heading_node

        section_nodes = []
        for sibling in first_sibling.itersiblings():
            if sibling.tag in {"h2", "h3"} or sibling.xpath(".//h2 | .//h3"):
                break
            section_nodes.append(sibling)

        list_entries = [
            entry
            for node in section_nodes
            for entry in node.xpath(".//li")
        ]
        entries = list_entries or [
            entry
            for node in section_nodes
            for entry in node.xpath(".//p | self::p")
        ]
        for entry in entries:
            text = _clean_text(entry)
            if text and text.lower() not in {"edit", "edit source"}:
                sections[section].append(text)

    ingredients = list(dict.fromkeys(sections["ingredients"]))
    instructions = list(dict.fromkeys(sections["instructions"]))
    if not ingredients or not instructions:
        return None

    info = {}
    for row in root.css(".infobox tr"):
        label = _clean_text(row.css("th"))
        value = _clean_text(row.css("td"))
        if label and value:
            info[label.lower()] = value

    time_values = re.findall(
        r"(\d+)\s*(minutes?|mins?|hours?|hrs?)\b",
        info.get("time", ""),
        flags=re.IGNORECASE,
    )
    total_minutes = sum(
        int(value) * (60 if unit.lower().startswith(("hour", "hr")) else 1)
        for value, unit in time_values
    )

    servings = info.get("servings")
    if servings:
        servings = re.sub(r"\s+", " ", servings).strip()

    return {
        "id": f"wikibooks-{quote(title, safe='')}",
        "title": title.removeprefix("Cookbook:").strip(),
        "category": "Imported collection",
        "time": total_minutes or None,
        "servings": servings or None,
        "rating": None,
        "reviews": None,
        "featured": True,
        "difficulty": info.get("difficulty", "Varies"),
        "ingredients": ingredients,
        "image": None,
        "color": "sage",
        "description": "A community recipe from the open Wikibooks Cookbook.",
        "author": "Wikibooks contributors",
        "steps": instructions,
        "source": "Wikibooks Cookbook",
        "sourceUrl": source_url,
        "attribution": "Wikibooks contributors",
        "license": "CC BY-SA 4.0",
        "licenseUrl": LICENSE_URL,
    }


class WikibooksRecipesSpider(scrapy.Spider):
    name = "wikibooks"
    allowed_domains = ["en.wikibooks.org"]

    def __init__(self, max_candidates=60, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.max_candidates = max(1, int(max_candidates))
        self.candidates = []
        self.candidate_titles = set()

    async def start(self):
        yield scrapy.Request(FEATURED_RECIPES_URL, callback=self.collect_candidates)

    def collect_candidates(self, response):
        for link in response.css("#mw-pages a[href^='/wiki/Cookbook:']"):
            title = link.attrib.get("title")
            if title and "\ufffd" in title:
                self.logger.warning("Skipping title with invalid text encoding: %s", title)
                continue
            if title and title not in self.candidate_titles:
                self.candidate_titles.add(title)
                self.candidates.append(
                    {
                        "title": title,
                        "url": response.urljoin(link.attrib["href"]),
                    }
                )
            if len(self.candidates) >= self.max_candidates:
                break

        next_page = response.css("#mw-pages a[href*='pagefrom=']::attr(href)").get()
        if len(self.candidates) < self.max_candidates and next_page:
            yield scrapy.Request(
                response.urljoin(next_page),
                callback=self.collect_candidates,
            )
            return

        for page in self.candidates[: self.max_candidates]:
            yield scrapy.Request(
                page["url"],
                callback=self.parse_recipe,
                cb_kwargs={"title": page["title"]},
            )

    def parse_recipe(self, response, title):
        source_url = response.url
        recipe = extract_recipe(response.text, title, source_url)
        if not recipe:
            self.logger.info("Skipping page without recognizable recipe sections: %s", title)
            return

        yield recipe
