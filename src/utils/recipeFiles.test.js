import test from 'node:test';
import assert from 'node:assert/strict';
import {
	exportRecipesJson,
	exportRecipesText,
	parseRecipeFile,
	parsePastedRecipeText,
} from './recipeFiles.js';

const sample = {
	id: 'user-test-1',
	title: 'Lemon pasta',
	category: 'My recipes',
	time: 20,
	servings: '2',
	description: 'A quick dinner.',
	author: 'Alex',
	ingredients: ['200 g pasta', '1 lemon'],
	steps: ['Boil the pasta.', 'Add the lemon.'],
	source: 'recipes.example',
	sourceUrl: 'https://recipes.example/lemon-pasta',
	originalSourceUrl: 'https://recipes.example/lemon-pasta',
	attribution: 'Alex',
};

test('JSON export imports recipes while retaining personal IDs and source links', () => {
	const exported = exportRecipesJson([sample]);
	const imported = parseRecipeFile(exported);

	assert.equal(imported.length, 1);
	assert.equal(imported[0].id, sample.id);
	assert.equal(imported[0].sourceUrl, sample.sourceUrl);
	assert.deepEqual(imported[0].ingredients, sample.ingredients);
});

test('plain-text export round-trips multiple recipes', () => {
	const exported = exportRecipesText([sample, { ...sample, id: 'user-test-2', title: 'Tomato toast' }]);
	const imported = parseRecipeFile(exported, 'my-recipes.txt');

	assert.deepEqual(imported.map((recipe) => recipe.title), ['Lemon pasta', 'Tomato toast']);
	assert.deepEqual(imported[0].steps, sample.steps);
	assert.deepEqual(imported.map((recipe) => recipe.id), ['user-test-1', 'user-test-2']);
	assert.equal(imported[1].sourceUrl, sample.sourceUrl);
});

test('rejects invalid URLs and recipes without ingredients or steps', () => {
	assert.throws(
		() => parseRecipeFile(JSON.stringify([{ ...sample, image: 'javascript:alert(1)' }])),
		/Image URL must use http or https/,
	);
	assert.throws(
		() => parseRecipeFile(JSON.stringify([{ ...sample, steps: [] }])),
		/needs at least one instruction step/,
	);
});

test('parses pasted recipe text into editable recipe fields', () => {
	const recipe = parsePastedRecipeText(`Curried rice
Prep time: 10 minutes
Cook time: 20 minutes
Serves: 4

Ingredients:
- 2 cups basmati rice
- 1 tablespoon curry powder

Instructions:
1. Rinse the rice.
2. Simmer with the curry powder.

Notes:
Serve warm.`);

	assert.equal(recipe.title, 'Curried rice');
	assert.equal(recipe.time, '30');
	assert.equal(recipe.servings, '4');
	assert.deepEqual(recipe.ingredients, ['2 cups basmati rice', '1 tablespoon curry powder']);
	assert.deepEqual(recipe.steps, ['Rinse the rice.', 'Simmer with the curry powder.']);
});

test('rejects pasted text that does not contain a complete recipe', () => {
	assert.throws(
		() => parsePastedRecipeText('A recipe title\nIngredients:\n- flour'),
		/Could not find a recipe name, Ingredients section, and Instructions section/,
	);
});

test('preserves bounded raster image data URLs and rejects unsupported or oversized images', () => {
	const image = `data:image/jpeg;base64,${Buffer.from('recipe image').toString('base64')}`;
	const imported = parseRecipeFile(JSON.stringify([{ ...sample, image }]));

	assert.equal(imported[0].image, image);
	assert.equal(parseRecipeFile(exportRecipesJson(imported))[0].image, image);
	assert.equal(parseRecipeFile(exportRecipesText(imported), 'recipes.txt')[0].image, image);
	assert.throws(
		() => parseRecipeFile(JSON.stringify([{ ...sample, image: 'data:image/svg+xml;base64,PHN2Zy8+' }])),
		/valid JPEG, PNG, or WebP/,
	);

	const oversizedPayload = 'A'.repeat(4 * Math.ceil((180 * 1024 + 1) / 3));
	assert.throws(
		() => parseRecipeFile(JSON.stringify([{ ...sample, image: `data:image/jpeg;base64,${oversizedPayload}` }])),
		/180 KB or smaller/,
	);
});
