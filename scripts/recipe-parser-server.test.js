import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchRecipeImage, isPublicIpv4, parseRecipeHtml } from './recipe-parser-server.js';

test('parses schema.org recipe fields from a JSON-LD graph', () => {
	const html = `<html><script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'Recipe',
				name: 'Weeknight soup',
				description: 'A quick soup.',
				author: { '@type': 'Person', name: 'Jamie Cook' },
				image: { url: '/images/soup.jpg' },
				prepTime: 'PT10M',
				cookTime: 'PT20M',
				recipeYield: '4 servings',
				recipeCategory: 'Dinner',
				recipeIngredient: ['2 cups broth', '1 onion'],
				recipeInstructions: [
					{ '@type': 'HowToStep', text: 'Chop the onion.' },
					{
						'@type': 'HowToSection',
						itemListElement: [{ '@type': 'HowToStep', text: 'Simmer in broth.' }],
					},
				],
			},
		],
	})}</script></html>`;

	const recipe = parseRecipeHtml(html, 'https://recipes.example/soup');

	assert.equal(recipe.title, 'Weeknight soup');
	assert.equal(recipe.time, 30);
	assert.equal(recipe.servings, '4 servings');
	assert.deepEqual(recipe.ingredients, ['2 cups broth', '1 onion']);
	assert.deepEqual(recipe.steps, ['Chop the onion.', 'Simmer in broth.']);
	assert.equal(recipe.image, 'https://recipes.example/images/soup.jpg');
	assert.equal(recipe.source, 'recipes.example');
	assert.equal(recipe.sourceUrl, 'https://recipes.example/soup');
});

test('rejects pages without complete schema.org recipe data', () => {
	assert.throws(
		() => parseRecipeHtml('<html><title>No recipe schema</title></html>', 'https://recipes.example/page'),
		/No complete Schema.org Recipe data/,
	);
});

test('allows public IPv4 addresses and blocks local or reserved ranges', () => {
	assert.equal(isPublicIpv4('8.8.8.8'), true);
	assert.equal(isPublicIpv4('127.0.0.1'), false);
	assert.equal(isPublicIpv4('192.168.1.5'), false);
	assert.equal(isPublicIpv4('169.254.169.254'), false);
});

test('recipe image fetching rejects loopback and local hostnames before requesting them', async () => {
	await assert.rejects(() => fetchRecipeImage('http://127.0.0.1/image.jpg'), /Local or private network/);
	await assert.rejects(() => fetchRecipeImage('http://localhost/image.jpg'), /Local or private network/);
});
