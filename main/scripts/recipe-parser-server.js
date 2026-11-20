import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const MAX_HTML_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_BODY_BYTES = 16 * 1024;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 12000;
const rateLimits = new Map();
const imageRateLimits = new Map();
const privateIpv4Ranges = [
	[0x00000000n, 8],
	[0x0a000000n, 8],
	[0x64400000n, 10],
	[0x7f000000n, 8],
	[0xa9fe0000n, 16],
	[0xac100000n, 12],
	[0xc0000000n, 24],
	[0xc0000200n, 24],
	[0xc0586300n, 24],
	[0xc0a80000n, 16],
	[0xc6120000n, 15],
	[0xc6336400n, 24],
	[0xcb007100n, 24],
	[0xe0000000n, 4],
	[0xf0000000n, 4],
];

export function isPublicIpv4(address) {
	if (isIP(address) !== 4) return false;
	const value = address.split('.').reduce((result, part) => (result << 8n) + BigInt(part), 0n);
	return !privateIpv4Ranges.some(
		([network, prefix]) => value >> BigInt(32 - prefix) === network >> BigInt(32 - prefix),
	);
}

function validateUrl(value) {
	let url;
	try {
		if (typeof value !== 'string' || value.length > 2048) throw new Error('Invalid URL length.');
		url = new URL(value);
	} catch (error) {
		throw new Error('Enter a complete recipe page URL.');
	}
	if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http and https recipe pages are supported.');
	if (url.username || url.password) throw new Error('URLs containing login credentials are not supported.');
	const standardPort = url.protocol === 'https:' ? '443' : '80';
	if (url.port && url.port !== standardPort) throw new Error('Recipe pages must use the standard web ports.');
	if (
		!url.hostname ||
		url.hostname === 'localhost' ||
		url.hostname.endsWith('.localhost') ||
		url.hostname.endsWith('.local') ||
		url.hostname.endsWith('.internal')
	) {
		throw new Error('Local or private network addresses are not supported.');
	}
	url.hash = '';
	return url;
}

async function resolvePublicIpv4(url) {
	const literalFamily = isIP(url.hostname);
	if (literalFamily === 4) {
		if (!isPublicIpv4(url.hostname)) throw new Error('Local or private network addresses are not supported.');
		return url.hostname;
	}
	if (literalFamily === 6) throw new Error('IPv6 recipe URLs are not supported by this local importer.');

	let records;
	try {
		records = await lookup(url.hostname, { all: true, verbatim: true });
	} catch (error) {
		throw new Error('The recipe website hostname could not be resolved.');
	}
	const publicAddress = records.find((record) => record.family === 4 && isPublicIpv4(record.address));
	if (!publicAddress) throw new Error('The recipe website does not resolve to a public IPv4 address.');
	return publicAddress.address;
}

function requestPublicResource(url, address, redirects, options) {
	return new Promise((resolve, reject) => {
		const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
			{
				protocol: url.protocol,
				hostname: url.hostname,
				port: url.port || undefined,
				path: `${url.pathname}${url.search}`,
				method: 'GET',
				headers: {
					Accept: options.accept,
					'Accept-Encoding': 'identity',
					'User-Agent': 'GrassyRecipeImporter/1.0 (user-requested recipe page)',
					Host: url.host,
				},
				lookup: (_hostname, options, callback) => {
					if (options.all) callback(null, [{ address, family: 4 }]);
					else callback(null, address, 4);
				},
				servername: isIP(url.hostname) ? undefined : url.hostname,
				timeout: REQUEST_TIMEOUT_MS,
			},
			(response) => {
				const redirectCode = [301, 302, 303, 307, 308].includes(response.statusCode);
				if (redirectCode && response.headers.location) {
					response.resume();
					response.once('end', async () => {
						if (redirects >= MAX_REDIRECTS) {
							reject(new Error(options.redirectError));
							return;
						}
						try {
							const nextUrl = validateUrl(new URL(response.headers.location, url).href);
							const nextAddress = await resolvePublicIpv4(nextUrl);
							resolve(await requestPublicResource(nextUrl, nextAddress, redirects + 1, options));
						} catch (error) {
							reject(error);
						}
					});
					return;
				}
				if (response.statusCode !== 200) {
					response.resume();
					reject(new Error(`${options.statusErrorPrefix} HTTP ${response.statusCode || 'unknown'}.`));
					return;
				}
				const contentType = response.headers['content-type'] || '';
				if (!options.contentType.test(contentType)) {
					response.resume();
					reject(new Error(options.contentTypeError));
					return;
				}
				const contentLength = Number(response.headers['content-length'] || 0);
				if (contentLength > options.maxBytes) {
					response.resume();
					reject(new Error(options.tooLargeError));
					return;
				}
				const chunks = [];
				let bytes = 0;
				let settled = false;
				response.on('data', (chunk) => {
					bytes += chunk.length;
					if (bytes > options.maxBytes) {
						settled = true;
						response.destroy();
						reject(new Error(options.tooLargeError));
						return;
					}
					chunks.push(chunk);
				});
				response.once('end', () => {
					if (settled) return;
					resolve({ body: Buffer.concat(chunks), contentType });
				});
				response.once('error', (error) => {
					if (!settled) reject(error);
				});
			},
		);
		request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error('The recipe website took too long to respond.')));
		request.once('error', reject);
		request.end();
	});
}

function requestHtml(url, address, redirects) {
	return requestPublicResource(url, address, redirects, {
		accept: 'text/html,application/xhtml+xml',
		contentType: /^(text\/html|application\/xhtml\+xml)(?:\s*;|$)/i,
		contentTypeError: 'The URL did not return an HTML recipe page.',
		maxBytes: MAX_HTML_BYTES,
		redirectError: 'The recipe website redirected too many times.',
		statusErrorPrefix: 'The recipe website returned',
		tooLargeError: 'The recipe page is too large to import.',
	}).then(({ body }) => body.toString('utf8'));
}

function parseDuration(value) {
	if (typeof value !== 'string') return null;
	const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i);
	if (!match) return null;
	const [, days = '0', hours = '0', minutes = '0'] = match;
	const total = Number(days) * 1440 + Number(hours) * 60 + Number(minutes);
	return Number.isSafeInteger(total) && total > 0 ? total : null;
}

function htmlDecode(value) {
	return value
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&amp;/gi, '&')
		.replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(Number(decimal)));
}

function recipeNodes(value, output = []) {
	if (Array.isArray(value)) {
		value.forEach((item) => recipeNodes(item, output));
		return output;
	}
	if (!value || typeof value !== 'object') return output;

	const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
	if (types.some((type) => typeof type === 'string' && /(?:^|[/#])recipe$/i.test(type))) output.push(value);
	Object.values(value).forEach((item) => recipeNodes(item, output));
	return output;
}

function collectInstructions(value, output = []) {
	if (typeof value === 'string') {
		const text = value.trim();
		if (text) output.push(text);
		return output;
	}
	if (Array.isArray(value)) {
		value.forEach((item) => collectInstructions(item, output));
		return output;
	}
	if (!value || typeof value !== 'object') return output;
	if (typeof value.text === 'string' && value.text.trim()) {
		output.push(value.text.trim());
		return output;
	}
	collectInstructions(value.itemListElement || value.recipeInstructions || value.steps, output);
	return output;
}

function firstString(value) {
	if (typeof value === 'string') return value.trim();
	if (typeof value === 'number') return String(value);
	if (Array.isArray(value)) return firstString(value[0]);
	if (value && typeof value === 'object') return firstString(value.name || value.url || value.contentUrl);
	return '';
}

function authorName(value) {
	if (Array.isArray(value)) return value.map(authorName).filter(Boolean).join(', ');
	if (typeof value === 'string') return value.trim();
	if (value && typeof value === 'object') return firstString(value.name);
	return '';
}

function normalizeJsonLd(html) {
	const recipes = [];
	const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
	let match;
	while ((match = scriptPattern.exec(html))) {
		if (!/\btype\s*=\s*["']application\/ld\+json(?:\s*;[^"']*)?["']/i.test(match[1])) continue;
		const source = match[2].trim().replace(/^<!--|-->$/g, '').trim();
		try {
			recipes.push(...recipeNodes(JSON.parse(source)));
		} catch (error) {
			try {
				recipes.push(...recipeNodes(JSON.parse(htmlDecode(source))));
			} catch (decodeError) {
				continue;
			}
		}
	}
	return recipes;
}

export function parseRecipeHtml(html, sourceUrl) {
	const recipe = normalizeJsonLd(html).find((candidate) => {
		const ingredients = candidate.recipeIngredient;
		const instructions = candidate.recipeInstructions;
		return Array.isArray(ingredients) && ingredients.length && instructions;
	});
	if (!recipe) {
		throw new Error('No complete Schema.org Recipe data was found on this page.');
	}

	const title = firstString(recipe.name);
	const ingredients = (Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [])
		.map((item) => (typeof item === 'string' ? item.trim() : ''))
		.filter(Boolean);
	const steps = collectInstructions(recipe.recipeInstructions);
	if (!title || !ingredients.length || !steps.length) {
		throw new Error('The page has recipe metadata, but it is missing a title, ingredients, or instructions.');
	}

	const source = new URL(sourceUrl).hostname.replace(/^www\./i, '');
	const imageValue = firstString(recipe.image);
	let image = '';
	if (imageValue) {
		try {
			image = new URL(imageValue, sourceUrl).href;
		} catch (error) {
			image = '';
		}
	}
	const prepTime = parseDuration(recipe.prepTime);
	const cookTime = parseDuration(recipe.cookTime);
	const time = parseDuration(recipe.totalTime) || (prepTime || cookTime ? (prepTime || 0) + (cookTime || 0) : null);

	return {
		title,
		category: firstString(recipe.recipeCategory) || 'My recipes',
		description: firstString(recipe.description),
		author: authorName(recipe.author) || 'You',
		time,
		servings: firstString(recipe.recipeYield),
		image,
		ingredients,
		steps,
		source,
		sourceUrl,
		originalSourceUrl: sourceUrl,
		attribution: authorName(recipe.author) || source,
	};
}

export async function fetchRecipeFromUrl(value) {
	const url = validateUrl(value);
	const address = await resolvePublicIpv4(url);
	const html = await requestHtml(url, address, 0);
	return parseRecipeHtml(html, url.href);
}

export async function fetchRecipeImage(value) {
	const url = validateUrl(value);
	const address = await resolvePublicIpv4(url);
	return requestPublicResource(url, address, 0, {
		accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif',
		contentType: /^image\/(?:avif|gif|jpeg|png|webp)(?:\s*;|$)/i,
		contentTypeError: 'The image URL did not return a supported image.',
		maxBytes: MAX_IMAGE_BYTES,
		redirectError: 'The image server redirected too many times.',
		statusErrorPrefix: 'The image server returned',
		tooLargeError: 'The recipe image is too large to load.',
	});
}

async function readRequestBody(request) {
	if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '')) {
		throw new Error('Send the recipe URL as a JSON request.');
	}
	const chunks = [];
	let bytes = 0;
	for await (const chunk of request) {
		bytes += chunk.length;
		if (bytes > MAX_BODY_BYTES) throw new Error('The URL request is too large.');
		chunks.push(chunk);
	}
	try {
		return JSON.parse(Buffer.concat(chunks).toString('utf8'));
	} catch (error) {
		throw new Error('The URL request is not valid JSON.');
	}
}

function sendJson(response, status, value) {
	response.statusCode = status;
	response.setHeader('Content-Type', 'application/json; charset=utf-8');
	response.setHeader('Cache-Control', 'no-store');
	response.end(JSON.stringify(value));
}

function rateLimited(request, limits = rateLimits, maximum = 10) {
	const now = Date.now();
	const client = request.socket.remoteAddress || 'unknown';
	const history = (limits.get(client) || []).filter((timestamp) => now - timestamp < 60000);
	if (history.length >= maximum) return true;
	history.push(now);
	limits.set(client, history);
	return false;
}

async function handleParseRequest(request, response) {
	if (request.method !== 'POST') {
		sendJson(response, 405, { error: 'Use POST to import a recipe URL.' });
		return;
	}
	if (rateLimited(request)) {
		sendJson(response, 429, { error: 'Too many recipe imports. Please wait a minute and try again.' });
		return;
	}
	try {
		const body = await readRequestBody(request);
		if (!body || typeof body.url !== 'string') throw new Error('Enter a recipe page URL.');
		if (body.permissionConfirmed !== true) throw new Error('Confirm that you own or have permission to reuse this recipe.');
		const recipe = await fetchRecipeFromUrl(body.url);
		sendJson(response, 200, { recipe });
	} catch (error) {
		sendJson(response, 422, { error: error.message || 'The recipe page could not be imported.' });
	}
}

async function handleImageRequest(request, response) {
	if (request.method !== 'GET') {
		sendJson(response, 405, { error: 'Use GET to load a recipe image.' });
		return;
	}
	if (rateLimited(request, imageRateLimits, 60)) {
		sendJson(response, 429, { error: 'Too many recipe images. Please wait a minute and try again.' });
		return;
	}
	try {
		const imageUrl = new URL(request.url || '/', 'http://localhost').searchParams.get('url');
		if (!imageUrl) throw new Error('Enter an image URL.');
		const { body, contentType } = await fetchRecipeImage(imageUrl);
		response.statusCode = 200;
		response.setHeader('Content-Type', contentType.split(';', 1)[0].toLowerCase());
		response.setHeader('Content-Length', body.length);
		response.setHeader('Cache-Control', 'private, max-age=3600');
		response.setHeader('X-Content-Type-Options', 'nosniff');
		response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
		response.end(body);
	} catch (error) {
		sendJson(response, 422, { error: error.message || 'The recipe image could not be loaded.' });
	}
}

export function recipeParserPlugin() {
	return {
		name: 'gather-recipe-url-import',
		configureServer(server) {
			server.middlewares.use('/api/recipes/parse', handleParseRequest);
			server.middlewares.use('/api/recipes/image', handleImageRequest);
		},
		configurePreviewServer(server) {
			server.middlewares.use('/api/recipes/parse', handleParseRequest);
			server.middlewares.use('/api/recipes/image', handleImageRequest);
		},
	};
}
