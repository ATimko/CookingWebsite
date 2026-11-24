const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_DATA_BYTES = 180 * 1024;
const MAX_RECIPES = 200;
const TEXT_SEPARATOR = '--- GATHER RECIPE ---';

function createRecipeId() {
	const uuid = globalThis.crypto?.randomUUID?.();
	return `user-${uuid || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function normalizeWebUrl(value, label) {
	const candidate = typeof value === 'string' ? value.trim() : '';
	if (!candidate) return '';

	let url;
	try {
		url = new URL(candidate);
	} catch (error) {
		throw new Error(`${label} must be a complete web address.`);
	}
	if (!['http:', 'https:'].includes(url.protocol)) {
		throw new Error(`${label} must use http or https.`);
	}
	return url.href;
}

function parseRecipeImageData(candidate) {
	const match = candidate.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i);
	if (!match || match[2].length % 4 !== 0) return null;
	const padding = match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0;
	return { byteLength: (match[2].length * 3) / 4 - padding };
}

function normalizeRecipeImage(value) {
	const candidate = typeof value === 'string' ? value.trim() : '';
	if (!candidate) return null;
	if (!candidate.startsWith('data:')) return normalizeWebUrl(candidate, 'Image URL') || null;

	const imageData = parseRecipeImageData(candidate);
	if (!imageData) throw new Error('Uploaded images must be valid JPEG, PNG, or WebP files.');
	if (imageData.byteLength > MAX_IMAGE_DATA_BYTES) {
		throw new Error('Resized recipe images must be 180 KB or smaller.');
	}
	return candidate;
}

export function getRecipeImageSrc(image, isUserRecipe = false) {
	if (!image) return '';
	if (image.startsWith('data:')) {
		const imageData = parseRecipeImageData(image);
		return imageData && imageData.byteLength <= MAX_IMAGE_DATA_BYTES ? image : '';
	}
	return isUserRecipe ? `/api/recipes/image?url=${encodeURIComponent(image)}` : image;
}

function normalizeRecipe(recipe) {
	if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) {
		throw new Error('Each imported recipe must be an object.');
	}

	const title = typeof recipe.title === 'string' ? recipe.title.trim() : '';
	const ingredients = Array.isArray(recipe.ingredients)
		? recipe.ingredients.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
		: [];
	const steps = Array.isArray(recipe.steps)
		? recipe.steps
				.map((item) => (typeof item === 'string' ? item.trim() : typeof item?.text === 'string' ? item.text.trim() : ''))
				.filter(Boolean)
		: [];
	if (!title) throw new Error('Every recipe needs a title.');
	if (!ingredients.length) throw new Error(`“${title}” needs at least one ingredient.`);
	if (!steps.length) throw new Error(`“${title}” needs at least one instruction step.`);
	if (title.length > 160) throw new Error('Recipe titles must be 160 characters or fewer.');
	if (ingredients.length > 100 || steps.length > 100) {
		throw new Error(`“${title}” exceeds the 100-item ingredient or instruction limit.`);
	}

	const time = recipe.time === '' || recipe.time == null ? null : Number(recipe.time);
	if (time != null && (!Number.isInteger(time) || time < 1 || time > 10080)) {
		throw new Error(`“${title}” has an invalid cooking time.`);
	}

	const id = typeof recipe.id === 'string' && recipe.id.startsWith('user-') ? recipe.id : createRecipeId();
	return {
		id,
		title,
		category: typeof recipe.category === 'string' && recipe.category.trim() ? recipe.category.trim() : 'My recipes',
		time,
		servings: typeof recipe.servings === 'string' || typeof recipe.servings === 'number' ? String(recipe.servings).trim() : '',
		rating: null,
		reviews: null,
		difficulty: typeof recipe.difficulty === 'string' && recipe.difficulty.trim() ? recipe.difficulty.trim() : 'Varies',
		ingredients,
		image: normalizeRecipeImage(recipe.image),
		color: 'sage',
		description: typeof recipe.description === 'string' ? recipe.description.trim().slice(0, 2000) : '',
		author: typeof recipe.author === 'string' && recipe.author.trim() ? recipe.author.trim() : 'You',
		steps,
		source: typeof recipe.source === 'string' && recipe.source.trim() ? recipe.source.trim() : '',
		sourceUrl: normalizeWebUrl(recipe.sourceUrl, 'Source URL') || '',
		originalSourceUrl: normalizeWebUrl(recipe.originalSourceUrl, 'Original source URL') || '',
		attribution: typeof recipe.attribution === 'string' ? recipe.attribution.trim() : '',
		isUserRecipe: true,
	};
}

function getMinutesFromText(value) {
	if (typeof value !== 'string') return null;
	const text = value.toLowerCase();
	const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
	const minutes = text.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/);
	const plainMinutes = text.match(/^\s*(\d+)\s*$/);
	const total = (hours ? Number(hours[1]) * 60 : 0)
		+ (minutes ? Number(minutes[1]) : plainMinutes ? Number(plainMinutes[1]) : 0);
	return total > 0 && Number.isInteger(total) ? total : null;
}

export function parsePastedRecipeText(contents) {
	if (typeof contents !== 'string' || !contents.trim()) {
		throw new Error('Paste the recipe text you want to import.');
	}

	const sections = {
		ingredients: /^(?:ingredients?(?:\s+(?:for|needed).*)?|what you(?:'|’)ll need)\s*:?\s*$/i,
		steps: /^(?:instructions?|directions?|method|steps?|preparation)\s*:?\s*$/i,
	};
	const metadataLabels = {
		title: /^(?:title|recipe name)\s*:\s*(.+)$/i,
		author: /^(?:author|by)\s*:\s*(.+)$/i,
		category: /^category\s*:\s*(.+)$/i,
		description: /^description\s*:\s*(.+)$/i,
		servings: /^(?:serves|servings|yield)\s*:\s*(.+)$/i,
		totalTime: /^(?:total time|time)\s*:\s*(.+)$/i,
		prepTime: /^prep time\s*:\s*(.+)$/i,
		cookTime: /^cook time\s*:\s*(.+)$/i,
	};
	const ingredients = [];
	const steps = [];
	const metadata = {};
	let section = '';
	let title = '';

	for (const sourceLine of contents.split(/\r?\n/)) {
		const line = sourceLine.trim();
		if (!line) continue;

		if (sections.ingredients.test(line)) {
			section = 'ingredients';
			continue;
		}
		if (sections.steps.test(line)) {
			section = 'steps';
			continue;
		}
		if (section && /^(?:notes?|nutrition(?: facts)?|recipe notes)\s*:?\s*$/i.test(line)) {
			section = '';
			continue;
		}

		const metadataMatch = Object.entries(metadataLabels)
			.map(([field, expression]) => [field, line.match(expression)])
			.find(([, match]) => match);
		if (metadataMatch) {
			metadata[metadataMatch[0]] = metadataMatch[1][1].trim();
			continue;
		}

		if (!section) {
			if (!title && !/^(?:jump to recipe|print recipe)$/i.test(line)) title = line;
			continue;
		}

		const recipeLine = line.replace(/^(?:(?:step\s*)?\d+[.)-]\s*|[-*•]\s*)/, '').trim();
		if (!recipeLine) continue;
		if (section === 'ingredients') ingredients.push(recipeLine);
		else steps.push(recipeLine);
	}

	const time = getMinutesFromText(metadata.totalTime)
		?? (() => {
			const prepTime = getMinutesFromText(metadata.prepTime);
			const cookTime = getMinutesFromText(metadata.cookTime);
			return prepTime != null && cookTime != null ? prepTime + cookTime : prepTime ?? cookTime;
		})();
	const recipeTitle = metadata.title || title;
	if (!recipeTitle || !ingredients.length || !steps.length) {
		throw new Error('Could not find a recipe name, Ingredients section, and Instructions section in that text.');
	}

	return {
		title: recipeTitle,
		category: metadata.category || 'My recipes',
		description: metadata.description || '',
		author: metadata.author || 'You',
		time: time == null ? '' : String(time),
		servings: metadata.servings || '',
		ingredients,
		steps,
	};
}

function parseTextRecipe(block) {
	const fields = {};
	const ingredients = [];
	const steps = [];
	let section = '';

	for (const line of block.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		if (/^ingredients:$/i.test(trimmed)) {
			section = 'ingredients';
			continue;
		}
		if (/^(?:steps|instructions):$/i.test(trimmed)) {
			section = 'steps';
			continue;
		}
		if (/^END RECIPE$/i.test(trimmed) || /^GATHER RECIPE TEXT V1$/i.test(trimmed)) continue;

		if (section === 'ingredients') {
			ingredients.push(trimmed.replace(/^[-*]\s*/, ''));
		} else if (section === 'steps') {
			steps.push(trimmed.replace(/^\d+[.)]\s*/, ''));
		} else {
			const separator = trimmed.indexOf(':');
			if (separator >= 0) fields[trimmed.slice(0, separator).trim().toLowerCase()] = trimmed.slice(separator + 1).trim();
		}
	}

	return normalizeRecipe({
		title: fields.title,
		category: fields.category,
		description: fields.description,
		author: fields.author,
		time: fields['time (minutes)'] || null,
		servings: fields.servings,
		image: fields['image url'],
		source: fields.source,
		sourceUrl: fields['source url'],
		originalSourceUrl: fields['original source url'],
		attribution: fields.attribution,
		id: fields.id,
		ingredients,
		steps,
	});
}

export function parseRecipeFile(contents, fileName = 'recipes.json') {
	if (typeof contents !== 'string' || !contents.trim()) throw new Error('The selected file is empty.');
	if (new Blob([contents]).size > MAX_FILE_SIZE) throw new Error('Recipe files must be 5 MB or smaller.');

	if (/\.txt$/i.test(fileName) || contents.trimStart().startsWith('GATHER RECIPE TEXT V1')) {
		const recipes = contents
			.split(new RegExp(`^${TEXT_SEPARATOR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'))
			.map((block) => block.trim())
			.filter(Boolean)
			.map(parseTextRecipe);
		if (!recipes.length) throw new Error('No Grassy recipes were found in this text file.');
		if (recipes.length > MAX_RECIPES) throw new Error(`A file may contain at most ${MAX_RECIPES} recipes.`);
		return recipes;
	}

	let parsed;
	try {
		parsed = JSON.parse(contents);
	} catch (error) {
		throw new Error('This file is not valid recipe JSON or Grassy recipe text.');
	}
	const recipes = Array.isArray(parsed) ? parsed : parsed?.recipes;
	if (!Array.isArray(recipes) || !recipes.length) throw new Error('The JSON file must contain a recipes array.');
	if (recipes.length > MAX_RECIPES) throw new Error(`A file may contain at most ${MAX_RECIPES} recipes.`);
	return recipes.map(normalizeRecipe);
}

function oneLine(value) {
	return String(value || '').replace(/\s+/g, ' ').trim();
}

export function exportRecipesJson(recipes) {
	return JSON.stringify({ format: 'gather-recipes', version: 1, recipes }, null, 2);
}

export function exportRecipesText(recipes) {
	return recipes
		.map((recipe) =>
			[
				'GATHER RECIPE TEXT V1',
				`Title: ${oneLine(recipe.title)}`,
				`Category: ${oneLine(recipe.category)}`,
				`Description: ${oneLine(recipe.description)}`,
				`Author: ${oneLine(recipe.author)}`,
				`Time (minutes): ${recipe.time || ''}`,
				`Servings: ${oneLine(recipe.servings)}`,
				`Image URL: ${oneLine(recipe.image)}`,
				`Source: ${oneLine(recipe.source)}`,
				`Source URL: ${oneLine(recipe.sourceUrl)}`,
				`Original source URL: ${oneLine(recipe.originalSourceUrl)}`,
				`Attribution: ${oneLine(recipe.attribution)}`,
				`ID: ${oneLine(recipe.id)}`,
				'Ingredients:',
				...recipe.ingredients.map((ingredient) => `- ${oneLine(ingredient)}`),
				'Instructions:',
				...recipe.steps.map((step, index) => `${index + 1}. ${oneLine(step)}`),
				'END RECIPE',
			].join('\n'),
		)
		.join(`\n${TEXT_SEPARATOR}\n`);
}

export { normalizeRecipe };
