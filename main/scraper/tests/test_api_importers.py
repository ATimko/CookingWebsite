import json
import tempfile
import unittest
from pathlib import Path

from import_api_recipes import (
    _fatsecret_recipe,
    _mealdb_recipe,
    _recipe_api_recipe,
    _duration_minutes,
    merge_recipes,
)


class RecipeApiNormalizerTests(unittest.TestCase):
    def test_themealdb_pairs_measures_and_keeps_source_attribution(self):
        meal = {
            "idMeal": "42",
            "strMeal": "Example Stew",
            "strCategory": "Stew",
            "strInstructions": "step 1\nBrown the onions.\n\nstep 2\nSimmer until tender.",
            "strMealThumb": "https://example.test/stew.jpg",
            "strIngredient1": "Onion",
            "strMeasure1": "2",
            "strIngredient2": "Stock",
            "strMeasure2": "1 cup",
        }

        recipe = _mealdb_recipe(meal)

        self.assertEqual(recipe["ingredients"], ["2 Onion", "1 cup Stock"])
        self.assertEqual(recipe["steps"], ["Brown the onions.", "Simmer until tender."])
        self.assertEqual(recipe["sourceUrl"], "https://www.themealdb.com/meal/42")
        self.assertEqual(recipe["attribution"], "TheMealDB")
        self.assertIsNone(recipe["license"])

    def test_themealdb_skips_instructions_with_replacement_characters(self):
        recipe = _mealdb_recipe(
            {
                "idMeal": "42",
                "strMeal": "Example Stew",
                "strInstructions": "Pur\ufffde until smooth.",
                "strIngredient1": "Onion",
            }
        )

        self.assertIsNone(recipe)

    def test_recipe_api_converts_duration_and_grouped_ingredients(self):
        recipe = _recipe_api_recipe(
            {
                "id": "sample-id",
                "name": "Sample dinner",
                "category": "Dinner",
                "difficulty": "Easy",
                "meta": {"total_time": "PT1H15M", "yields": "4 servings"},
                "ingredients": [
                    {
                        "items": [
                            {
                                "quantity": 2,
                                "unit": "cloves",
                                "name": "garlic",
                                "preparation": "minced",
                            }
                        ]
                    }
                ],
                "instructions": [{"text": "Cook until fragrant."}],
            }
        )

        self.assertEqual(recipe["time"], 75)
        self.assertEqual(recipe["ingredients"], ["2 cloves garlic minced"])
        self.assertEqual(recipe["steps"], ["Cook until fragrant."])

    def test_fatsecret_supports_single_or_multiple_search_results(self):
        recipe = _fatsecret_recipe(
            {
                "recipe_id": "73",
                "recipe_name": "Baked fish",
                "recipe_url": "https://www.fatsecret.com/recipes/73",
                "preparation_time_min": "10",
                "cooking_time_min": "20",
                "ingredients": {"ingredient": {"ingredient_description": "1 fish fillet"}},
                "directions": {
                    "direction": [
                        {"direction_description": "Season the fish."},
                        {"direction_description": "Bake until cooked through."},
                    ]
                },
                "recipe_types": {"recipe_type": "Dinner"},
            }
        )

        self.assertEqual(recipe["time"], 30)
        self.assertEqual(recipe["ingredients"], ["1 fish fillet"])
        self.assertEqual(len(recipe["steps"]), 2)
        self.assertEqual(recipe["sourceUrl"], "https://www.fatsecret.com/recipes/73")

    def test_duration_parser_rejects_unknown_format(self):
        self.assertEqual(_duration_minutes("PT2H"), 120)
        self.assertIsNone(_duration_minutes("about an hour"))

    def test_merge_refreshes_provider_records_without_dropping_other_sources(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "recipes.json"
            output.write_text(
                '[{"id":"wiki-1","source":"Wikibooks","category":"Open collection"},'
                '{"id":"meal-1","source":"TheMealDB","title":"Old title"}]',
                encoding="utf-8",
            )

            previous, total = merge_recipes(
                output,
                [{"id": "meal-1", "source": "TheMealDB", "title": "New title"}],
            )
            recipes = json.loads(output.read_text(encoding="utf-8"))

        self.assertEqual((previous, total), (2, 2))
        self.assertEqual(recipes[0]["category"], "Imported collection")
        self.assertEqual(recipes[1]["title"], "New title")


if __name__ == "__main__":
    unittest.main()
