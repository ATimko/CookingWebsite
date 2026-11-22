import json
import os
import sys
import types
import unittest

# The scraper transport is only needed for live requests; unit tests exercise parsing offline.
stub = types.ModuleType("stealth_requests")
class _UnusedSession:
    def __init__(self, *args, **kwargs): pass
    def __enter__(self): return self
    def __exit__(self, *args): return False
stub.StealthSession = _UnusedSession
sys.modules.setdefault("stealth_requests", stub)
sys.path.insert(0, os.path.dirname(__file__))

from main import parse_recipe, _public_host


class RecipeParserTests(unittest.TestCase):
    def test_extracts_recipe_jsonld(self):
        payload = {
            "@context": "https://schema.org",
            "@graph": [{
                "@type": "Recipe",
                "name": "Lemon pasta",
                "author": {"@type": "Person", "name": "A Cook"},
                "image": {"url": "/lemon.jpg"},
                "prepTime": "PT10M",
                "cookTime": "PT15M",
                "recipeYield": "4 servings",
                "recipeIngredient": ["2 cups pasta", "1 lemon"],
                "recipeInstructions": [
                    {"@type": "HowToStep", "text": "Boil the pasta."},
                    {"@type": "HowToStep", "text": "Add lemon."},
                ],
            }],
        }
        page = f'<script type="application/ld+json">{json.dumps(payload)}</script>'
        result = parse_recipe(page, "https://food.example/recipe/lemon")
        self.assertEqual(result["title"], "Lemon pasta")
        self.assertEqual(result["time"], 25)
        self.assertEqual(result["ingredients"], ["2 cups pasta", "1 lemon"])
        self.assertEqual(result["steps"], ["Boil the pasta.", "Add lemon."])
        self.assertEqual(result["image"], "https://food.example/lemon.jpg")

    def test_rejects_page_without_recipe_schema(self):
        with self.assertRaisesRegex(ValueError, "No complete Schema.org Recipe"):
            parse_recipe("<html><title>Nothing here</title></html>", "https://food.example/page")

    def test_rejects_local_hosts(self):
        for url in ("http://127.0.0.1/recipe", "http://localhost/recipe"):
            with self.subTest(url=url), self.assertRaisesRegex(ValueError, "private network"):
                _public_host(url)


if __name__ == "__main__":
    unittest.main()
