import { useEffect, useId, useRef, useState } from 'react';
import {
	BookOpen,
	ChevronDown,
	ExternalLink,
	FileDown,
	FileUp,
	Globe2,
	ImagePlus,
	Pencil,
	Plus,
	Save,
	Trash2,
	Utensils,
	X,
} from 'lucide-react';

import {
	exportRecipesJson,
	exportRecipesText,
	getRecipeImageSrc,
	normalizeRecipe,
	parseRecipeFile,
} from '../../utils/recipeFiles';

const MAX_UPLOAD_FILE_BYTES = 20 * 1024 * 1024;
const MAX_RESIZED_IMAGE_BYTES = 180 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MEASUREMENT_UNITS = [
	'(Tsp) Teaspoon',
	'(Tbsp) Tablespoon',
	'(C) Cup',
	'(g) Gram',
	'(kg) Kilogram',
	'Dash',
	'Pinch',
	'(oz) Ounce',
	'(lb) Pound',
	'(mL) Milliliter',
	'(L) Liter',
	'(fl oz) Fluid Ounce',
	'(pt) Pint',
	'(qt) Quart',
	'(gal) Gallon',
];
const FRACTION_SHORTCUTS = ['3/4', '1/2', '1/3', '1/4', '1/8', '1/16'];
const QUANTITY_PATTERN_SOURCE = String.raw`(?:(?:\d+(?:\.\d+)?|\.\d+)\s+\d+\/\d+|\d+(?:\.\d+)?|\.\d+|\d+\/\d+)`;
const QUANTITY_PATTERN = new RegExp(`^${QUANTITY_PATTERN_SOURCE}$`);
const QUANTITY_LINE_PATTERN = new RegExp(`^(${QUANTITY_PATTERN_SOURCE})(?:\\s+(.*))?$`);
const MEASUREMENT_UNIT_PATTERN = new RegExp(
	`^(${MEASUREMENT_UNITS.slice().sort((first, second) => second.length - first.length).join('|')})(?:s)?(?:\\s+(.*))?$`,
	'i',
);

function createIngredientDraft(ingredient = '') {
	return { quantity: '', unit: '', name: ingredient };
}

function createInstructionDraft(text = '') {
	return { text };
}

function createEmptyDraft() {
	return {
		title: '',
		category: 'My recipes',
		description: '',
		author: 'You',
		time: '',
		servings: '',
		image: '',
		source: '',
		sourceUrl: '',
		originalSourceUrl: '',
		attribution: '',
		ingredients: [createIngredientDraft()],
		instructions: [createInstructionDraft()],
	};
}

function parseQuantityValue(value) {
	const quantity = value.trim();
	if (!quantity) return null;
	if (!QUANTITY_PATTERN.test(quantity)) return Number.NaN;

	const mixedFraction = quantity.match(/^((?:\d+(?:\.\d+)?|\.\d+))\s+(\d+)\/(\d+)$/);
	if (mixedFraction) {
		const denominator = Number(mixedFraction[3]);
		return denominator ? Number(mixedFraction[1]) + Number(mixedFraction[2]) / denominator : Number.NaN;
	}

	const fraction = quantity.match(/^(\d+)\/(\d+)$/);
	if (fraction) {
		const denominator = Number(fraction[2]);
		return denominator ? Number(fraction[1]) / denominator : Number.NaN;
	}

	return Number(quantity);
}

function applyFractionShortcut(quantity, fraction) {
	const currentQuantity = quantity.trim();
	const mixedFraction = currentQuantity.match(/^((?:\d+(?:\.\d+)?|\.\d+))\s+\d+\/\d+$/);
	if (mixedFraction) return `${mixedFraction[1]} ${fraction}`;

	const wholeQuantity = currentQuantity.match(/^(?:\d+(?:\.\d+)?|\.\d+)$/);
	return wholeQuantity ? `${currentQuantity} ${fraction}` : fraction;
}

function parseIngredientLine(value) {
	const line = value.trim();
	const quantityMatch = line.match(QUANTITY_LINE_PATTERN);
	if (!quantityMatch) return createIngredientDraft(line);

	const quantity = quantityMatch[1];
	const remainder = quantityMatch[2] || '';
	const unitMatch = remainder.match(MEASUREMENT_UNIT_PATTERN);
	const unit = unitMatch
		? MEASUREMENT_UNITS.find((measurementUnit) => measurementUnit.toLowerCase() === unitMatch[1].toLowerCase())
		: '';

	return {
		quantity,
		unit,
		name: unitMatch ? unitMatch[2] || '' : remainder,
	};
}

function pluralizeUnit(unit, quantityValue) {
	if (!(quantityValue > 1)) return unit;
	return `${unit}'s`;
}

function ingredientRowsToStrings(rows) {
	return rows
		.map((row) => ({
			quantity: row.quantity.trim(),
			unit: row.unit,
			name: row.name.trim().replace(/^./, (firstLetter) => firstLetter.toUpperCase()),
		}))
		.filter((row) => row.quantity || row.unit || row.name)
		.map((row) => {
			const quantityValue = parseQuantityValue(row.quantity);
			if (Number.isNaN(quantityValue)) {
				throw new Error('Ingredient quantities must be numbers or fractions, such as 1, 0.5, or 3/4.');
			}
			if (row.unit && quantityValue === null) {
				throw new Error('Enter a quantity before selecting a measurement.');
			}
			if (!row.name) {
				throw new Error('Enter an ingredient name for each row with a quantity or measurement.');
			}

			const unit = row.unit ? pluralizeUnit(row.unit, quantityValue) : '';
			return [row.quantity, unit, row.name].filter(Boolean).join(' ');
		});
}

function getBase64Size(dataUrl) {
	const payload = dataUrl.slice(dataUrl.indexOf(',') + 1);
	const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
	return (payload.length * 3) / 4 - padding;
}

async function resizeRecipeImage(file) {
	if (!IMAGE_TYPES.has(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.');
	if (file.size > MAX_UPLOAD_FILE_BYTES) throw new Error('Image files must be 20 MB or smaller.');

	const objectUrl = URL.createObjectURL(file);
	try {
		const image = new Image();
		await new Promise((resolve, reject) => {
			image.onload = resolve;
			image.onerror = () => reject(new Error('This image could not be opened.'));
			image.src = objectUrl;
		});
		if (!image.naturalWidth || !image.naturalHeight) throw new Error('This image has invalid dimensions.');

		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d');
		if (!context) throw new Error('Image resizing is not supported in this browser.');

		for (let width = 1200; width >= 480; width = Math.floor(width * 0.8)) {
			const height = Math.round((width * 2) / 3);
			canvas.width = width;
			canvas.height = height;
			const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
			const drawnWidth = image.naturalWidth * scale;
			const drawnHeight = image.naturalHeight * scale;
			context.fillStyle = '#fff';
			context.fillRect(0, 0, width, height);
			context.drawImage(image, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight);

			for (const quality of [0.82, 0.72, 0.62, 0.52]) {
				const resized = canvas.toDataURL('image/jpeg', quality);
				if (getBase64Size(resized) <= MAX_RESIZED_IMAGE_BYTES) return resized;
			}
		}
		throw new Error('This image could not be compressed enough. Try a different image.');
	} finally {
		URL.revokeObjectURL(objectUrl);
	}
}

function downloadFile(filename, type, contents) {
	const url = URL.createObjectURL(new Blob([contents], { type }));
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.hidden = true;
	document.body.append(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toDraft(recipe) {
	return {
		...createEmptyDraft(),
		...recipe,
		time: recipe.time ? String(recipe.time) : '',
		image: recipe.image || '',
		ingredients: recipe.ingredients.map(parseIngredientLine),
		instructions: recipe.steps.map(createInstructionDraft),
	};
}

function sourceName(url) {
	try {
		return new URL(url).hostname.replace(/^www\./i, '');
	} catch (error) {
		return '';
	}
}

function MeasurementDropdown({ label, onChange, quantity, value }) {
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef(null);
	const triggerRef = useRef(null);
	const optionRefs = useRef([]);
	const listId = `measurement-options-${useId()}`;
	const selectedIndex = value ? MEASUREMENT_UNITS.indexOf(value) + 1 : 0;
	const options = ['', ...MEASUREMENT_UNITS];

	useEffect(() => {
		if (!isOpen) return undefined;
		const closeOnOutsideClick = (event) => {
			if (!dropdownRef.current?.contains(event.target)) setIsOpen(false);
		};
		document.addEventListener('pointerdown', closeOnOutsideClick);
		return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) return;
		const selectedOption = optionRefs.current[selectedIndex] || optionRefs.current[0];
		selectedOption?.scrollIntoView({ block: 'nearest' });
		selectedOption?.focus();
	}, [isOpen, selectedIndex]);

	const focusOption = (index) => {
		const nextIndex = (index + options.length) % options.length;
		optionRefs.current[nextIndex]?.focus();
	};

	const handleTriggerKeyDown = (event) => {
		if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return;
		event.preventDefault();
		setIsOpen(true);
	};

	const handleOptionKeyDown = (event, index) => {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			focusOption(index + 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			focusOption(index - 1);
		} else if (event.key === 'Home') {
			event.preventDefault();
			focusOption(0);
		} else if (event.key === 'End') {
			event.preventDefault();
			focusOption(options.length - 1);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			setIsOpen(false);
			triggerRef.current?.focus();
		}
	};

	const selectUnit = (unit) => {
		onChange(unit);
		setIsOpen(false);
		triggerRef.current?.focus();
	};

	return (
		<div
			className="measurement-dropdown"
			onBlur={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
			}}
			ref={dropdownRef}
		>
			<button
				aria-controls={listId}
				aria-expanded={isOpen}
				aria-haspopup="listbox"
				aria-label={label}
				className="editor-control measurement-dropdown-trigger"
				onClick={() => setIsOpen((open) => !open)}
				onKeyDown={handleTriggerKeyDown}
				ref={triggerRef}
				type="button"
			>
				<span>{value ? pluralizeUnit(value, quantity) : 'Unit'}</span>
				<ChevronDown size={14} aria-hidden="true" />
			</button>
			{isOpen && (
				<div aria-label={`${label} options`} className="measurement-dropdown-menu" id={listId} role="listbox">
					{options.map((unit, index) => (
						<button
							aria-selected={value === unit}
							className="measurement-dropdown-option"
							key={unit || 'empty-unit'}
							onClick={() => selectUnit(unit)}
							onKeyDown={(event) => handleOptionKeyDown(event, index)}
							ref={(element) => { optionRefs.current[index] = element; }}
							role="option"
							tabIndex={index === selectedIndex ? 0 : -1}
							type="button"
						>
							{unit ? pluralizeUnit(unit, quantity) : 'Unit'}
						</button>
					))}
				</div>
			)}
		</div>
	);
}

export default function RecipeLibrary({ recipes, onSave, onDelete, onImport, onView }) {
	const [draft, setDraft] = useState(createEmptyDraft);
	const [editingId, setEditingId] = useState('');
	const [recipeUrl, setRecipeUrl] = useState('');
	const [permissionConfirmed, setPermissionConfirmed] = useState(false);
	const [isParsing, setIsParsing] = useState(false);
	const [isProcessingImage, setIsProcessingImage] = useState(false);
	const [isDraggingImage, setIsDraggingImage] = useState(false);
	const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
	const [message, setMessage] = useState(null);
	const fileInput = useRef(null);
	const imageFileInput = useRef(null);
	const hasAnyIngredient = draft.ingredients.some((ingredient) => (
		ingredient.quantity.trim() || ingredient.unit || ingredient.name.trim()
	));
	const hasAnyInstruction = draft.instructions.some((instruction) => instruction.text.trim());

	const updateDraft = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
	const updateIngredient = (index, field, value) => setDraft((current) => ({
		...current,
		ingredients: current.ingredients.map((ingredient, ingredientIndex) => (
			ingredientIndex === index ? { ...ingredient, [field]: value } : ingredient
		)),
	}));
	const updateInstruction = (index, text) => setDraft((current) => ({
		...current,
		instructions: current.instructions.map((instruction, instructionIndex) => (
			instructionIndex === index ? { ...instruction, text } : instruction
		)),
	}));
	const addIngredient = () => setDraft((current) => ({
		...current,
		ingredients: [...current.ingredients, createIngredientDraft()],
	}));
	const addInstruction = () => setDraft((current) => ({
		...current,
		instructions: [...current.instructions, createInstructionDraft()],
	}));
	const removeIngredient = (index) => setDraft((current) => {
		if (current.ingredients.length === 1) {
			const ingredient = current.ingredients[0];
			if (!ingredient.quantity.trim() && !ingredient.unit && !ingredient.name.trim()) return current;
			return { ...current, ingredients: [createIngredientDraft()] };
		}

		return { ...current, ingredients: current.ingredients.filter((_, ingredientIndex) => ingredientIndex !== index) };
	});
	const removeInstruction = (index) => setDraft((current) => {
		if (current.instructions.length === 1) {
			if (!current.instructions[0].text.trim()) return current;
			return { ...current, instructions: [createInstructionDraft()] };
		}
		return { ...current, instructions: current.instructions.filter((_, instructionIndex) => instructionIndex !== index) };
	});

	const processImageFile = async (file) => {
		if (!file) return;
		setIsProcessingImage(true);
		setMessage(null);
		try {
			const resizedImage = await resizeRecipeImage(file);
			updateDraft('image', resizedImage);
			setMessage({ type: 'success', text: 'Image resized and ready. It replaces any image URL.' });
		} catch (error) {
			setMessage({ type: 'error', text: error.message });
		} finally {
			setIsProcessingImage(false);
			if (imageFileInput.current) imageFileInput.current.value = '';
		}
	};

	const dropImageFile = (event) => {
		event.preventDefault();
		setIsDraggingImage(false);
		if (!isProcessingImage) processImageFile(event.dataTransfer.files?.[0]);
	};

	const resetForm = () => {
		setDraft(createEmptyDraft());
		setEditingId('');
		setHasAttemptedSubmit(false);
	};

	const parseUrl = async () => {
		if (!permissionConfirmed) {
			setMessage({ type: 'error', text: 'Confirm that you own or have permission to reuse this recipe before importing it.' });
			return;
		}
		setIsParsing(true);
		setMessage(null);
		try {
			const response = await fetch('/api/recipes/parse', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: recipeUrl.trim(), permissionConfirmed }),
			});
			if (!response.headers.get('content-type')?.includes('application/json')) {
				throw new Error('URL import needs the local recipe parser. Run the app with npm run dev or npm run preview.');
			}
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || `Recipe import failed (${response.status}).`);
			setDraft({
				...createEmptyDraft(),
				...result.recipe,
				category: 'My recipes',
				ingredients: result.recipe.ingredients.map(parseIngredientLine),
				instructions: result.recipe.steps.map(createInstructionDraft),
				sourceUrl: result.recipe.sourceUrl || recipeUrl.trim(),
			});
			setEditingId('');
			setHasAttemptedSubmit(false);
			setMessage({ type: 'success', text: 'Recipe details found. Review and edit them before saving.' });
		} catch (error) {
			setMessage({
				type: 'error',
				text: error instanceof TypeError
					? 'The local recipe parser is unavailable. Restart the Vite development server and try again.'
					: error.message,
			});
		} finally {
			setIsParsing(false);
		}
	};

	const saveDraft = (event) => {
		event.preventDefault();
		try {
			const sourceUrl = draft.sourceUrl.trim();
			const recipe = normalizeRecipe({
				...draft,
				id: editingId || undefined,
				time: draft.time.trim() ? Number(draft.time) : null,
				ingredients: ingredientRowsToStrings(draft.ingredients),
				steps: draft.instructions.map((instruction) => instruction.text),
				source: draft.source.trim() || sourceName(sourceUrl),
				sourceUrl,
				originalSourceUrl: draft.originalSourceUrl || sourceUrl,
				attribution: draft.attribution || draft.author,
			});
			onSave(recipe);
			setMessage({ type: 'success', text: editingId ? 'Your recipe has been updated.' : 'Your recipe has been saved on this device.' });
			resetForm();
		} catch (error) {
			setMessage({ type: 'error', text: error.message });
		}
	};

	const importFile = async (event) => {
		const file = event.target.files?.[0];
		if (!file) return;
		setMessage(null);
		try {
			if (file.size > 5 * 1024 * 1024) throw new Error('Recipe files must be 5 MB or smaller.');
			const imported = parseRecipeFile(await file.text(), file.name);
			onImport(imported);
			setMessage({ type: 'success', text: `Imported ${imported.length} recipe${imported.length === 1 ? '' : 's'} into your collection.` });
		} catch (error) {
			setMessage({ type: 'error', text: error.message });
		} finally {
			event.target.value = '';
		}
	};

	const editRecipe = (recipe) => {
		setDraft(toDraft(recipe));
		setEditingId(recipe.id);
		setHasAttemptedSubmit(false);
		setMessage(null);
		document.getElementById('recipe-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	const removeRecipe = (recipe) => {
		if (!window.confirm(`Delete “${recipe.title}” from this device?`)) return;
		try {
			onDelete(recipe.id);
			if (editingId === recipe.id) resetForm();
			setMessage({ type: 'success', text: 'Recipe removed from this device.' });
		} catch (error) {
			setMessage({ type: 'error', text: error.message || 'The recipe could not be deleted.' });
		}
	};

	return (
		<section className="recipe-library" id="my-recipes">
			<div className="library-heading">
				<div>
					<span className="eyebrow"><span className="eyebrow-line" /> YOUR PERSONAL COOKBOOK</span>
					<h1>Recipes from your kitchen.</h1>
					<p>Create a recipe, bring in one you own from a website, or keep a local backup of your collection.</p>
				</div>
				<div className="library-file-actions">
					<button className="button-secondary" disabled={!recipes.length} onClick={() => downloadFile('grassy-recipes.json', 'application/json', exportRecipesJson(recipes))} type="button"><FileDown size={15} /> Export JSON</button>
					<button className="button-secondary" disabled={!recipes.length} onClick={() => downloadFile('grassy-recipes.txt', 'text/plain;charset=utf-8', exportRecipesText(recipes))} type="button"><FileDown size={15} /> Export text</button>
					<label className="button-secondary library-import-button"><FileUp size={15} /> Import file<input ref={fileInput} accept=".json,.txt,application/json,text/plain" onChange={importFile} type="file" /></label>
				</div>
			</div>

			{message && <p className={`library-message is-${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}

			<div className="library-grid">
				<div className="library-editor-column">
					<div className="url-import-card">
						<div className="library-card-heading"><span className="library-icon"><Globe2 size={17} /></span><div><h2>Fill from a recipe URL</h2><p>We’ll look for recipe details embedded on that page.</p></div></div>
						<div className="url-import-controls">
							<label className="library-field"><span>Recipe page URL</span><input autoComplete="url" onChange={(event) => setRecipeUrl(event.target.value)} placeholder="https://example.com/my-recipe" type="url" value={recipeUrl} /></label>
							<label className="permission-check"><input checked={permissionConfirmed} onChange={(event) => setPermissionConfirmed(event.target.checked)} type="checkbox" /><span>I own this recipe or have permission to reuse its ingredients, instructions, and any included image.</span></label>
							<button className="button-primary" disabled={isParsing || !recipeUrl.trim()} onClick={parseUrl} type="button">{isParsing ? 'Reading recipe…' : 'Parse this page'} <ExternalLink size={14} /></button>
						</div>
						<p className="library-hint">Only the recipe’s structured data is read. Pages without Schema.org recipe details can’t be auto-filled.</p>
					</div>

					<form
						className={`recipe-editor-card ${hasAttemptedSubmit ? 'has-validation-errors' : ''}`}
						id="recipe-editor"
						onInvalidCapture={() => setHasAttemptedSubmit(true)}
						onSubmit={saveDraft}
					>
						<div className="library-card-heading"><span className="library-icon"><BookOpen size={17} /></span><div><h2>{editingId ? 'Edit your recipe' : 'Add a recipe'}</h2><p>Everything stays in this browser until you export it.</p></div></div>
						<div className="recipe-form-grid">
							<label className="library-field full-field"><span>Recipe name *</span><input maxLength="160" onChange={(event) => updateDraft('title', event.target.value)} required value={draft.title} /></label>
							<label className="library-field"><span>Category</span><select onChange={(event) => updateDraft('category', event.target.value)} value={draft.category}><option>My recipes</option><option>Weeknight</option><option>Plant-based</option><option>One-pot</option><option>Quick &amp; easy</option><option>Something sweet</option></select></label>
							<label className="library-field"><span>By</span><input maxLength="100" onChange={(event) => updateDraft('author', event.target.value)} value={draft.author} /></label>
							<label className="library-field"><span>Total time (minutes)</span><input min="1" max="10080" onChange={(event) => updateDraft('time', event.target.value)} type="number" value={draft.time} /></label>
							<label className="library-field"><span>Servings</span><input maxLength="60" onChange={(event) => updateDraft('servings', event.target.value)} value={draft.servings} /></label>
							<label className="library-field full-field"><span>Short description</span><textarea maxLength="2000" onChange={(event) => updateDraft('description', event.target.value)} rows="2" value={draft.description} /></label>
							<div className="library-field full-field recipe-image-field">
								<span>Recipe image (optional) <small>Adding a file replaces the image URL, and entering a URL replaces the file.</small></span>
								<div
									className={`image-upload-zone ${isDraggingImage ? 'is-dragging' : ''}`}
									onDragEnter={(event) => { event.preventDefault(); setIsDraggingImage(true); }}
									onDragOver={(event) => event.preventDefault()}
									onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsDraggingImage(false); }}
									onDrop={dropImageFile}
								>
									{draft.image
										? <img className="image-upload-preview" src={getRecipeImageSrc(draft.image, true)} alt="Recipe image preview" />
										: <span className="image-upload-icon"><ImagePlus size={22} /></span>}
									<div className="image-upload-copy">
										<strong>{isProcessingImage ? 'Resizing image…' : draft.image?.startsWith('data:image/') ? 'Uploaded image selected' : draft.image ? 'Image URL selected' : 'Drop an image here'}</strong>
										<small>JPEG, PNG, or WebP up to 20 MB. Images are center-cropped to 3:2 and compressed for consistent recipe cards.</small>
									</div>
									<div className="image-upload-actions">
										<button className="button-secondary" disabled={isProcessingImage} onClick={() => imageFileInput.current?.click()} type="button">Choose image</button>
										{draft.image && <button className="button-secondary" disabled={isProcessingImage} onClick={() => updateDraft('image', '')} type="button">Remove</button>}
									</div>
									<input
										ref={imageFileInput}
										className="image-upload-input"
										accept="image/jpeg,image/png,image/webp"
										aria-label="Choose a recipe image file"
										disabled={isProcessingImage}
										onChange={(event) => processImageFile(event.target.files?.[0])}
										type="file"
									/>
								</div>
								<label className="library-field"><span>Or use an image URL</span><input disabled={isProcessingImage} maxLength="2048" onChange={(event) => updateDraft('image', event.target.value)} placeholder="https://…" type="url" value={draft.image?.startsWith('data:image/') ? '' : draft.image} /></label>
							</div>
							<label className="library-field full-field"><span>Source URL (optional)</span><input onChange={(event) => updateDraft('sourceUrl', event.target.value)} placeholder="Link back to the original recipe" type="url" value={draft.sourceUrl} /></label>
							<div className="recipe-list-editor full-field">
								<div className="recipe-list-heading"><span>Ingredients *</span><small>Enter a quantity, choose a unit, and name the ingredient.</small></div>
								<div className="ingredient-editor-list">
									{draft.ingredients.map((ingredient, index) => {
										const hasQuantity = Boolean(ingredient.quantity.trim());
										const hasMeasurement = Boolean(ingredient.unit);
										const requiresName = hasQuantity || hasMeasurement || (!hasAnyIngredient && index === 0);
										const quantityIsInvalid = hasQuantity && Number.isNaN(parseQuantityValue(ingredient.quantity));
										const hasRowError = hasAttemptedSubmit && (
											quantityIsInvalid
											|| (hasMeasurement && !hasQuantity)
											|| (requiresName && !ingredient.name.trim())
										);

										return (
										<div className={`ingredient-editor-row ${hasRowError ? 'has-validation-error' : ''}`} key={`ingredient-${index}`}>
											<input
												aria-label={`Ingredient ${index + 1} quantity`}
												aria-invalid={Boolean(
													(hasAttemptedSubmit && hasMeasurement && !hasQuantity)
													|| quantityIsInvalid,
												)}
												className="editor-control"
												inputMode="decimal"
												onChange={(event) => updateIngredient(index, 'quantity', event.target.value.replace(/[^0-9./ ]/g, ''))}
												onKeyDown={(event) => {
													if (
														event.key.length === 1
														&& !/[0-9./ ]/.test(event.key)
														&& !event.ctrlKey
														&& !event.metaKey
														&& !event.altKey
													) event.preventDefault();
												}}
												onPaste={(event) => event.preventDefault()}
												pattern={QUANTITY_PATTERN_SOURCE}
												placeholder="qty"
												required={hasMeasurement}
												title="Enter a number, decimal, fraction, or mixed fraction."
												value={ingredient.quantity}
											/>
											<MeasurementDropdown
												label={`Ingredient ${index + 1} measurement`}
												onChange={(unit) => updateIngredient(index, 'unit', unit)}
												quantity={parseQuantityValue(ingredient.quantity)}
												value={ingredient.unit}
											/>
											<input
												aria-label={`Ingredient ${index + 1} name`}
												aria-invalid={Boolean(hasAttemptedSubmit && requiresName && !ingredient.name.trim())}
												className="editor-control"
												onChange={(event) => updateIngredient(index, 'name', event.target.value)}
												placeholder="Ingredient name..."
												required={requiresName}
												value={ingredient.name}
											/>
											<button
												aria-label={`Remove ingredient ${index + 1}`}
												className="editor-remove-button"
												onClick={() => removeIngredient(index)}
												type="button"
											>
												<Trash2 size={16} />
											</button>
											<div aria-label={`Ingredient ${index + 1} fraction shortcuts`} className="fraction-shortcuts">
												{FRACTION_SHORTCUTS.map((fraction) => (
													<button
														aria-label={`Use ${fraction} fraction`}
														key={fraction}
														onClick={() => updateIngredient(index, 'quantity', applyFractionShortcut(ingredient.quantity, fraction))}
														type="button"
													>
														{fraction}
													</button>
												))}
											</div>
										</div>
										);
									})}
								</div>
								<button className="editor-add-button" onClick={addIngredient} type="button"><Plus size={15} /> Add ingredient</button>
							</div>
							<div className="recipe-list-editor full-field">
								<div className="recipe-list-heading"><span>Instructions *</span><small>Write one instruction in each row.</small></div>
								<div className="instruction-editor-list">
									{draft.instructions.map((instruction, index) => {
										const requiresInstruction = !hasAnyInstruction && index === 0;
										const instructionIsMissing = requiresInstruction && !instruction.text.trim();

										return (
										<div className={`instruction-editor-row ${hasAttemptedSubmit && instructionIsMissing ? 'has-validation-error' : ''}`} key={`instruction-${index}`}>
											<textarea
												aria-label={`Instruction ${index + 1}`}
												aria-invalid={Boolean(hasAttemptedSubmit && instructionIsMissing)}
												className="editor-control"
												onChange={(event) => updateInstruction(index, event.target.value)}
												placeholder={`Step ${index + 1}...`}
												required={requiresInstruction}
												rows="2"
												value={instruction.text}
											/>
											<button
												aria-label={`Remove instruction ${index + 1}`}
												className="editor-remove-button"
												onClick={() => removeInstruction(index)}
												type="button"
											>
												<Trash2 size={16} />
											</button>
										</div>
										);
									})}
								</div>
								<button className="editor-add-button" onClick={addInstruction} type="button"><Plus size={15} /> Add next instruction</button>
							</div>
						</div>
						<div className="recipe-editor-actions"><button className="button-primary" disabled={isProcessingImage} type="submit">{editingId ? <Save size={15} /> : <Plus size={15} />}{editingId ? 'Save changes' : 'Save recipe'}</button>{editingId && <button className="button-secondary" onClick={resetForm} type="button"><X size={14} /> Cancel edit</button>}</div>
					</form>
				</div>

				<aside className="saved-recipes-card">
					<div className="saved-recipes-heading"><div><span className="eyebrow">SAVED ON THIS DEVICE</span><h2>Your recipes <span>{recipes.length}</span></h2></div><Utensils size={19} /></div>
					{recipes.length ? <div className="saved-recipe-list">{[...recipes].reverse().map((recipe) => (
						<article className="saved-recipe" key={recipe.id}>
							<div className="saved-recipe-photo">{recipe.image ? <img alt="" loading="lazy" src={getRecipeImageSrc(recipe.image, true)} /> : <Utensils size={17} />}</div>
							<div className="saved-recipe-copy"><h3>{recipe.title}</h3><span>{recipe.category} · {recipe.ingredients.length} ingredients</span><div className="saved-recipe-actions"><button onClick={() => onView(recipe)} type="button">View</button><button aria-label={`Edit ${recipe.title}`} onClick={() => editRecipe(recipe)} type="button"><Pencil size={13} /> Edit</button><button aria-label={`Delete ${recipe.title}`} onClick={() => removeRecipe(recipe)} type="button"><Trash2 size={13} /> Delete</button></div></div>
						</article>
					))}</div> : <div className="saved-recipes-empty"><span>✳</span><p>Your personal recipes will show up here.</p><small>Add one above or import a backup file.</small></div>}
				</aside>
			</div>
		</section>
	);
}
