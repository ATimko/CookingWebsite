import unittest

from gather_scraper.spiders.wikibooks import extract_recipe


class ExtractRecipeTests(unittest.TestCase):
    def test_extracts_recipe_sections_and_attribution(self):
        html = """
        <div class="mw-parser-output">
          <table class="infobox">
            <tr><th>Servings</th><td>8–10</td></tr>
            <tr><th>Time</th><td>Prep: 15 minutes<br />Baking: 1 hour</td></tr>
          </table>
          <div class="mw-heading mw-heading2"><h2>Ingredients</h2></div>
          <ul><li>2 cups flour</li><li>1 tsp salt</li></ul>
          <div class="mw-heading mw-heading2"><h2>Directions</h2></div>
          <ol><li>Mix the dry ingredients.</li><li>Bake until golden.</li></ol>
          <p>Photo caption: the finished cake.</p>
          <div class="mw-heading mw-heading2"><h2>Notes</h2></div>
          <p>Serve with tea.</p>
        </div>
        """

        recipe = extract_recipe(
            html,
            "Cookbook:Test Cake",
            "https://en.wikibooks.org/wiki/Cookbook:Test_Cake",
        )

        self.assertEqual(recipe["title"], "Test Cake")
        self.assertEqual(recipe["ingredients"], ["2 cups flour", "1 tsp salt"])
        self.assertEqual(recipe["steps"], ["Mix the dry ingredients.", "Bake until golden."])
        self.assertEqual(recipe["time"], 75)
        self.assertEqual(recipe["servings"], "8–10")
        self.assertEqual(recipe["author"], "Wikibooks contributors")
        self.assertEqual(recipe["license"], "CC BY-SA 4.0")
        self.assertEqual(recipe["image"], None)

    def test_skips_pages_without_both_recipe_sections(self):
        html = """
        <div class="mw-parser-output">
          <h2>Ingredients</h2><ul><li>1 cup flour</li></ul>
        </div>
        """

        self.assertIsNone(
            extract_recipe(html, "Cookbook:Incomplete", "https://example.org/incomplete")
        )


if __name__ == "__main__":
    unittest.main()
