import { useEffect, useMemo, useRef, useState } from 'react';
import {
	ArrowDown,
	ArrowRight as ArrowForward,
	Check,
	ChevronDown,
	Clock,
	Coffee,
	Heart,
	HelpCircle,
	Leaf,
	Menu,
	Minus,
	Search,
	Settings,
	Shuffle,
	SlidersHorizontal,
	Sparkles,
	Star,
	Sun,
	Utensils,
	X,
} from 'lucide-react';

import RecipeLibrary from './RecipeLibrary';
import { getRecipeImageSrc, parseRecipeFile } from '../../utils/recipeFiles';
import './recipes.css';

const RECIPES = [
	{
		id: 1,
		title: 'Creamy lemon orzo with greens',
		category: 'Weeknight',
		time: 25,
		servings: 4,
		rating: 4.9,
		reviews: 128,
		difficulty: 'Easy',
		ingredients: [
			'1 1/2 cups Orzo',
			'1 Lemon, zested and juiced',
			'3 cups Baby spinach',
			'1/2 cup Finely grated Parmesan',
			'2 cloves Garlic, thinly sliced',
			'4 cups Vegetable broth',
			'1 tablespoon Olive oil',
			'1/2 teaspoon Fine salt',
			'1/4 teaspoon Black pepper',
		],
		image:
			'https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=1100&q=85',
		color: 'sage',
		description:
			'A one-pan bowl of silky orzo, bright lemon, and a handful of greens. Comforting enough for a slow Sunday, quick enough for Tuesday.',
		author: 'Mia Chen',
		steps: [
			'Warm olive oil in a deep skillet. Add sliced garlic and cook until fragrant, about 30 seconds.',
			'Stir in the orzo and toast for a minute. Pour in the broth and bring to a gentle simmer.',
			'Cook, stirring often, until the orzo is tender and most of the broth has been absorbed.',
			'Fold in spinach, lemon zest, lemon juice, and parmesan. Season to taste and serve warm.',
		],
	},
	{
		id: 2,
		title: 'Crispy chickpea & avocado bowls',
		category: 'Plant-based',
		time: 30,
		servings: 2,
		rating: 4.8,
		reviews: 96,
		difficulty: 'Easy',
		ingredients: [
			'15 ounces Canned chickpeas, drained and patted dry',
			'1 Avocado, sliced',
			'1/2 English cucumber, sliced',
			'1 1/2 cups Cooked rice',
			'2 tablespoons Tahini',
			'1 Lemon, juiced',
			'1 tablespoon Olive oil',
			'1/2 teaspoon Smoked paprika',
			'1/4 teaspoon Fine salt',
			'2 tablespoons Water, for thinning the tahini',
		],
		image:
			'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1100&q=85',
		color: 'peach',
		description:
			'Crunchy, creamy, and generously drizzled with lemony tahini. The sort of colorful lunch you look forward to all morning.',
		author: 'Jo Rivera',
		steps: [
			'Pat the chickpeas dry and toss with olive oil, smoked paprika, and a pinch of salt.',
			'Roast at 425°F (220°C) until crisp, about 20 minutes, shaking the pan once.',
			'Whisk tahini, lemon juice, and a splash of water until smooth.',
			'Build bowls with rice, sliced cucumber, avocado, chickpeas, and tahini dressing.',
		],
	},
	{
		id: 3,
		title: 'Sunday tomato butter beans',
		category: 'One-pot',
		time: 35,
		servings: 4,
		rating: 5.0,
		reviews: 204,
		difficulty: 'Easy',
		ingredients: [
			'30 ounces Butter beans, drained',
			'14.5 ounces Crushed tomatoes',
			'1 Shallot, finely chopped',
			'1/3 cup Heavy cream',
			'1/4 cup Fresh basil leaves',
			'4 slices Sourdough bread',
			'1 tablespoon Olive oil',
			'1/2 teaspoon Fine salt',
		],
		image:
			'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1100&q=85',
		color: 'rose',
		description:
			'Big creamy beans tucked into a jammy tomato sauce with basil on top. Grab a piece of toast and make a meal of it.',
		author: 'Mia Chen',
		steps: [
			'Soften a finely chopped shallot in olive oil over medium heat.',
			'Add crushed tomatoes and a pinch of salt. Simmer until thick and glossy, about 12 minutes.',
			'Stir through the drained butter beans and cream. Simmer gently for 8 minutes.',
			'Tear over fresh basil and serve with lots of toasted sourdough.',
		],
	},
	{
		id: 4,
		title: 'Golden miso butter noodles',
		category: 'Quick & easy',
		time: 20,
		servings: 2,
		rating: 4.9,
		reviews: 87,
		difficulty: 'Easy',
		ingredients: [
			'8 ounces Dried noodles',
			'2 tablespoons White miso',
			'3 tablespoons Softened unsalted butter',
			'2 Scallions, thinly sliced',
			'1 tablespoon Sesame seeds',
			'1 Lime, juiced',
			'8 cups Water, for boiling the noodles',
			'1 tablespoon Kosher salt, for the pasta water',
			'1/2 cup Reserved noodle water',
			'2 Eggs, optional',
		],
		image:
			'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1100&q=85',
		color: 'butter',
		description:
			'Glossy, savory noodles with the easiest sauce in your back pocket. Add a jammy egg if you have one.',
		author: 'Dev Patel',
		steps: [
			'Boil the noodles in well-salted water until just tender. Save a mug of cooking water.',
			'Mix softened butter, white miso, and a squeeze of lime in a warm bowl.',
			'Toss hot noodles with the miso butter and a splash of cooking water until silky.',
			'Finish with scallions and sesame seeds. Add a jammy egg to each bowl if desired. Taste and add more lime if you like.',
		],
	},
	{
		id: 5,
		title: 'Herby green goddess toast',
		category: 'Plant-based',
		time: 15,
		servings: 2,
		rating: 4.7,
		reviews: 61,
		difficulty: 'Easy',
		ingredients: [
			'4 slices Thick-cut sourdough bread',
			'1 cup Peas',
			'2 tablespoons Chopped fresh mint',
			'1 Lemon, zested and juiced',
			'1/2 cup Ricotta',
			'2 tablespoons Chopped chives',
			'1/4 teaspoon Fine salt',
			'1/8 teaspoon Black pepper',
		],
		image:
			'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=1100&q=85',
		color: 'sage',
		description:
			'Thick toast piled with lemony whipped ricotta, smashed peas, and all the soft herbs you can find.',
		author: 'Jo Rivera',
		steps: [
			'Blanch the peas for two minutes, then drain and lightly smash with lemon zest.',
			'Whip ricotta with lemon juice, salt, and black pepper until fluffy.',
			'Toast thick slices of sourdough until crisp on the edges.',
			'Spread each slice with ricotta, top with peas, and finish with chopped herbs.',
		],
	},
	{
		id: 6,
		title: 'Brown butter apple oat bars',
		category: 'Something sweet',
		time: 45,
		servings: 9,
		rating: 4.9,
		reviews: 143,
		difficulty: 'A little project',
		ingredients: [
			'2 cups Diced apples',
			'1 1/2 cups Rolled oats',
			'1/2 cup Unsalted butter',
			'3/4 cup Light brown sugar, divided',
			'1 1/2 teaspoons Ground cinnamon',
			'1 1/4 cups All-purpose flour',
			'1/2 teaspoon Fine salt',
		],
		image:
			'https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?auto=format&fit=crop&w=1100&q=85',
		color: 'peach',
		description:
			'Crumbly oat bars with soft spiced apples and nutty brown butter. Lovely warm, even better the next day.',
		author: 'Dev Patel',
		steps: [
			'Brown the butter in a small pan, swirling until the milk solids turn golden and smell nutty.',
			'Toss diced apples with cinnamon and 1 tablespoon of the brown sugar.',
			'Mix oats, flour, salt, remaining sugar, and brown butter into a crumbly dough. Press two thirds into a lined pan.',
			'Add the apples, crumble the rest of the dough on top, and bake at 350°F (175°C) until golden.',
		],
	},
];

const CATEGORIES = ['Everything', 'Weeknight', 'Plant-based', 'One-pot', 'Quick & easy', 'Something sweet', 'Imported collection', 'My recipes'];
const INGREDIENTS = ['tomato', 'spinach', 'lemon', 'chickpeas', 'butter', 'avocado', 'garlic'];
const STORE_KEY = 'gather-kitchen-preferences';
const USER_RECIPE_STORE_KEY = 'gather-user-recipes';
const RECIPES_PER_PAGE = 9;
const MEASUREMENT_NUMBER = String.raw`(?:\d+\s+\d+\/\d+|\d+(?:\.\d+)?(?:\/\d+)?|\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞])`;
const MEASUREMENT_UNIT = String.raw`(?:cups?|c|tbsp(?:s)?|tablespoons?|tsp(?:s)?|teaspoons?|ozs?|ounces?|lbs?|pounds?|grams?|gs?|kgs?|mls?|liters?|litres?|ls?|fluid\s+ounces?|pints?|quarts?|gals?|cloves?|slices?|pieces?|large|medium|small|handfuls?|pinch(?:es)?|dash(?:es)?|cans?|packages?|bunch(?:es)?|sticks?|sprigs?|heads?|stalks?|sheets?|leaves?|drops?|tins?|jars?)`;
const MEASUREMENT_PREFIX = new RegExp(
	`^\\s*((?:about\\s+)?${MEASUREMENT_NUMBER}(?:\\s*(?:[-–]|to)\\s*${MEASUREMENT_NUMBER})?(?:\\s+${MEASUREMENT_UNIT}\\b)?(?:\\s*\\([^)]*\\))?)(?:\\s+of)?\\s+(.+)$`,
	'i',
);
const IMAGE_FALLBACK =
	'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1100&q=85';

function readPreferences() {
	try {
		const saved = window.localStorage.getItem(STORE_KEY);
		return saved ? JSON.parse(saved) : {};
	} catch (error) {
		console.error('Unable to load saved kitchen preferences.', error);
		return {};
	}
}

function readUserRecipes() {
	try {
		const saved = window.localStorage.getItem(USER_RECIPE_STORE_KEY);
		if (!saved) return [];
		const parsed = JSON.parse(saved);
		return Array.isArray(parsed) && !parsed.length ? [] : parseRecipeFile(saved);
	} catch (error) {
		console.error('Unable to load saved personal recipes.', error);
		return [];
	}
}

function RecipeHome() {
	const [preferences, setPreferences] = useState(readPreferences);
	const [favorites, setFavorites] = useState(() => new Set(readPreferences().favorites || []));
	const [search, setSearch] = useState('');
	const [category, setCategory] = useState('Everything');
	const [activePage, setActivePage] = useState('Home');
	const [selectedRecipe, setSelectedRecipe] = useState(null);
	const [showSettings, setShowSettings] = useState(false);
	const [showFridge, setShowFridge] = useState(false);
	const [showHelp, setShowHelp] = useState(false);
	const [showMobileNav, setShowMobileNav] = useState(false);
	const [includeIngredients, setIncludeIngredients] = useState([]);
	const [excludeIngredients, setExcludeIngredients] = useState([]);
	const [randomRecipe, setRandomRecipe] = useState(null);
	const [randomRequest, setRandomRequest] = useState(0);
	const [currentPage, setCurrentPage] = useState(1);
	const [navigationRequest, setNavigationRequest] = useState(null);
	const navigationRequestId = useRef(0);
	const settingsButtonRef = useRef(null);
	const settingsPopoverRef = useRef(null);
	const [openRecipes, setOpenRecipes] = useState([]);
	const [userRecipes, setUserRecipes] = useState(readUserRecipes);

	useEffect(() => {
		if (!showSettings) return undefined;

		const closeOnOutsidePointer = (event) => {
			if (
				!settingsButtonRef.current?.contains(event.target) &&
				!settingsPopoverRef.current?.contains(event.target)
			) {
				setShowSettings(false);
			}
		};

		document.addEventListener('pointerdown', closeOnOutsidePointer);
		return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
	}, [showSettings]);

	useEffect(() => {
		let isCurrent = true;
		fetch('/recipes.json')
			.then((response) => {
				if (!response.ok) throw new Error(`Recipe dataset request failed: ${response.status}`);
				return response.json();
			})
			.then((data) => {
				if (!Array.isArray(data)) throw new Error('Recipe dataset must be a JSON array.');
				if (isCurrent) setOpenRecipes(data);
			})
			.catch((error) => console.error('Unable to load the open recipe collection.', error));

		return () => {
			isCurrent = false;
		};
	}, []);

	const updatePreferences = (updates) => {
		const next = { ...preferences, ...updates };
		setPreferences(next);
		try {
			window.localStorage.setItem(STORE_KEY, JSON.stringify({ ...next, favorites: [...favorites] }));
		} catch (error) {
			console.error('Unable to save kitchen preferences.', error);
		}
	};

	const toggleFavorite = (recipeId) => {
		const next = new Set(favorites);
		if (next.has(recipeId)) next.delete(recipeId);
		else next.add(recipeId);
		setFavorites(next);
		try {
			window.localStorage.setItem(STORE_KEY, JSON.stringify({ ...preferences, favorites: [...next] }));
		} catch (error) {
			console.error('Unable to save favorite recipes.', error);
		}
	};

	const recipes = useMemo(() => {
		const normalizedSearch = search.trim().toLowerCase();
		return [...RECIPES, ...openRecipes, ...userRecipes].filter((recipe) => {
			const ingredientNames = recipe.ingredients.map((item) => (typeof item === 'string' ? item : item.name));
			const matchesSearch =
				!normalizedSearch ||
				`${recipe.title} ${recipe.category} ${ingredientNames.join(' ')}`.toLowerCase().includes(normalizedSearch);
			const matchesCategory = category === 'Everything' || recipe.category === category;
			const matchesFavorite = activePage !== 'Favorites' || favorites.has(recipe.id);
			const matchesIncluded = includeIngredients.every((ingredient) =>
				ingredientNames.some((item) => item.toLowerCase().includes(ingredient)),
			);
			const matchesExcluded = excludeIngredients.every(
				(ingredient) => !ingredientNames.some((item) => item.toLowerCase().includes(ingredient)),
			);
			return matchesSearch && matchesCategory && matchesFavorite && matchesIncluded && matchesExcluded;
		});
	}, [activePage, category, excludeIngredients, favorites, includeIngredients, openRecipes, search, userRecipes]);
	const pageCount = Math.max(1, Math.ceil(recipes.length / RECIPES_PER_PAGE));
	const displayedPage = Math.min(currentPage, pageCount);
	const visibleRecipes = recipes.slice(
		(displayedPage - 1) * RECIPES_PER_PAGE,
		displayedPage * RECIPES_PER_PAGE,
	);

	useEffect(() => {
		if (randomRecipe === null) return undefined;

		document.getElementById(`recipe-${randomRecipe}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		const timeout = window.setTimeout(() => setRandomRecipe(null), 2000);
		return () => window.clearTimeout(timeout);
	}, [randomRecipe, randomRequest]);

	useEffect(() => {
		if (!navigationRequest) return undefined;

		let cleanupTimer;
		const cleanup = () => {
			window.clearTimeout(cleanupTimer);
			window.removeEventListener('wheel', cancelNavigationScroll);
			window.removeEventListener('touchstart', cancelNavigationScroll);
			window.removeEventListener('pointerdown', cancelScrollbarDrag);
			window.removeEventListener('keydown', cancelOnScrollKey);
		};
		const cancelNavigationScroll = () => {
			cleanup();
			window.scrollTo(window.scrollX, window.scrollY);
		};
		const cancelScrollbarDrag = (event) => {
			if (event.clientX >= document.documentElement.clientWidth) cancelNavigationScroll();
		};
		const cancelOnScrollKey = (event) => {
			if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(event.key) || event.code === 'Space') {
				cancelNavigationScroll();
			}
		};

		window.addEventListener('wheel', cancelNavigationScroll, { passive: true });
		window.addEventListener('touchstart', cancelNavigationScroll, { passive: true });
		window.addEventListener('pointerdown', cancelScrollbarDrag);
		window.addEventListener('keydown', cancelOnScrollKey);

		if (navigationRequest.target === 'top') {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		} else {
			document.getElementById(navigationRequest.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}

		cleanupTimer = window.setTimeout(cleanup, 3000);
		return cleanup;
	}, [navigationRequest]);

	const handleNavigate = (page) => {
		setActivePage(page);
		setCategory('Everything');
		setCurrentPage(1);
		setRandomRecipe(null);
		setShowMobileNav(false);
		if (page === 'Help') {
			setShowHelp(true);
			return;
		}
		const target = page === 'Home' ? 'top' : page === 'About' ? 'about' : page === 'My recipes' ? 'my-recipes' : 'discover';
		setNavigationRequest({ id: ++navigationRequestId.current, target });
	};

	const persistUserRecipes = (nextRecipes) => {
		window.localStorage.setItem(USER_RECIPE_STORE_KEY, JSON.stringify(nextRecipes));
		setUserRecipes(nextRecipes);
	};

	const saveUserRecipe = (recipe) => {
		persistUserRecipes([...userRecipes.filter((item) => item.id !== recipe.id), recipe]);
	};

	const importUserRecipes = (importedRecipes) => {
		const recipesById = new Map(userRecipes.map((recipe) => [recipe.id, recipe]));
		importedRecipes.forEach((recipe) => recipesById.set(recipe.id, recipe));
		persistUserRecipes([...recipesById.values()]);
	};

	const deleteUserRecipe = (recipeId) => {
		const nextRecipes = userRecipes.filter((recipe) => recipe.id !== recipeId);
		const nextFavorites = new Set(favorites);
		nextFavorites.delete(recipeId);
		window.localStorage.setItem(USER_RECIPE_STORE_KEY, JSON.stringify(nextRecipes));
		if (nextFavorites.size !== favorites.size) {
			window.localStorage.setItem(STORE_KEY, JSON.stringify({ ...preferences, favorites: [...nextFavorites] }));
			setFavorites(nextFavorites);
		}
		setUserRecipes(nextRecipes);
	};

	const chooseRandom = () => {
		if (!recipes.length) return;
		const randomIndex = Math.floor(Math.random() * recipes.length);
		const choice = recipes[randomIndex];
		setCurrentPage(Math.floor(randomIndex / RECIPES_PER_PAGE) + 1);
		setRandomRecipe(choice.id);
		setRandomRequest((request) => request + 1);
	};

	const changeRecipePage = (page) => {
		setCurrentPage(page);
		setRandomRecipe(null);
		document.getElementById('discover')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	const resetRecipePage = () => {
		setCurrentPage(1);
		setRandomRecipe(null);
	};

	const toggleFridgeIngredient = (ingredient, list, setter) => {
		setter(list.includes(ingredient) ? list.filter((item) => item !== ingredient) : [...list, ingredient]);
	};

	return (
		<div
			className={`gather-app ${preferences.darkMode ? 'is-dark' : ''}`}
			style={{
				'--reading-size': `${preferences.textSize || 16}px`,
				'--reading-scale': (preferences.textSize || 16) / 16,
			}}
		>
			<header className="site-header">
				<a className="brand" href="#top" aria-label="Grassy home" onClick={() => handleNavigate('Home')}>
					<span className="brand-mark"><Leaf size={18} strokeWidth={2.2} /></span>
					<span>grassy<span className="brand-period">.</span></span>
				</a>
				<nav className={`main-nav ${showMobileNav ? 'is-mobile-open' : ''}`} aria-label="Main navigation">
					{['Home', 'Discover', 'Favorites', 'My recipes', 'About'].map((page) => (
						<button
							className={`nav-link ${activePage === page ? 'is-active' : ''}`}
							key={page}
							onClick={() => handleNavigate(page)}
							type="button"
						>
							{page === 'Favorites' && <Heart size={14} />}
							{page}
							{page === 'Favorites' && favorites.size > 0 && <span className="favorite-count">{favorites.size}</span>}
						</button>
					))}
				</nav>
				<div className="header-actions">
					<button className="help-button" onClick={() => setShowHelp(true)} type="button"><HelpCircle size={16} /> Help</button>
					<button
						className={`icon-button ${showSettings ? 'is-open' : ''}`}
						onClick={() => setShowSettings(!showSettings)}
						ref={settingsButtonRef}
						type="button"
						aria-label="Open display settings"
						aria-expanded={showSettings}
					>
						<Settings size={18} />
					</button>
						<button className="mobile-menu icon-button" onClick={() => setShowMobileNav(!showMobileNav)} type="button" aria-label={showMobileNav ? 'Close menu' : 'Open menu'} aria-expanded={showMobileNav}>{showMobileNav ? <X size={19} /> : <Menu size={19} />}</button>
				</div>
				{showSettings && (
					<div className="settings-popover" ref={settingsPopoverRef}>
						<div className="popover-heading"><span>Make yourself at home</span><button onClick={() => setShowSettings(false)} type="button" aria-label="Close settings"><X size={15} /></button></div>
						<label className="setting-row"><span><Sun size={16} /> Dark mode</span><input type="checkbox" checked={Boolean(preferences.darkMode)} onChange={(event) => updatePreferences({ darkMode: event.target.checked })} /></label>
						<label className="setting-slider"><span>Reading size <strong>{preferences.textSize || 16}px</strong></span><input aria-label="Reading text size" type="range" min="14" max="30" value={preferences.textSize || 16} onChange={(event) => updatePreferences({ textSize: Number(event.target.value) })} /></label>
						<label className="setting-row"><span><Utensils size={16} /> Show measurements</span><input type="checkbox" checked={preferences.showMeasurements !== false} onChange={(event) => updatePreferences({ showMeasurements: event.target.checked })} /></label>
						<p className="settings-note">Your favorites and preferences stay on this device.</p>
					</div>
				)}
			</header>

			<main id="top">
				<section className="welcome-strip">
					<div><span className="eyebrow"><Sparkles size={14} /> A little inspiration for today</span><p>Good food, no fuss. <span>Just the way it should be.</span></p></div>
					<button className="fridge-button" onClick={() => setShowFridge(true)} type="button"><span className="fridge-emoji">🥬</span> Cook with what I have <ArrowForward size={15} /></button>
				</section>

				{activePage === 'My recipes' ? (
					<RecipeLibrary
						recipes={userRecipes}
						onSave={saveUserRecipe}
						onDelete={deleteUserRecipe}
						onImport={importUserRecipes}
						onView={setSelectedRecipe}
					/>
				) : (
					<>
				<section className="hero-section">
					<div className="hero-copy">
						<span className="hero-kicker">YOUR EVERYDAY RECIPE CLUB</span>
						<h1>A little more joy<br />in <em>every bite.</em></h1>
						<p>Good things to cook, made simple. Find your next favorite and make it your own.</p>
						<div className="hero-actions">
							<button className="button-primary" onClick={() => document.getElementById('discover')?.scrollIntoView({ behavior: 'smooth' })} type="button">Find a recipe <ArrowForward size={16} /></button>
							<button className="button-text" onClick={chooseRandom} type="button"><Shuffle size={15} /> Surprise me</button>
						</div>
						<div className="hero-social-proof"><div className="avatar-stack"><span>M</span><span>J</span><span>D</span><span>+</span></div><span>Made with love by home cooks like you</span></div>
					</div>
					<div className="hero-image-wrap">
						<img src={RECIPES[0].image} alt="A cozy bowl of pasta with fresh greens" onError={(event) => { event.currentTarget.src = IMAGE_FALLBACK; }} />
						<div className="hero-image-tag"><span className="tag-sparkle">✳</span><span>THE 25-MINUTE<br /><strong>midweek favorite</strong></span></div>
						<div className="hero-caption"><span className="caption-dot" /> Fresh ideas, every day</div>
						<div className="hero-stamp"><span>made for</span><strong>real life</strong><span>♡</span></div>
					</div>
				</section>

				<section className="quick-stats" aria-label="Grassy recipe collection">
					<div><span className="stat-icon mint"><Utensils size={17} /></span><span><strong>Good recipes</strong><small>Tested & loved</small></span></div>
					<div><span className="stat-icon apricot"><Clock size={17} /></span><span><strong>Real-life timing</strong><small>Weeknight friendly</small></span></div>
					<div><span className="stat-icon lavender"><Heart size={17} /></span><span><strong>Your little cookbook</strong><small>Favorites, all in one place</small></span></div>
					<div><span className="stat-icon butter"><Coffee size={17} /></span><span><strong>Zero perfection</strong><small>Just really good food</small></span></div>
				</section>

				<section className="discover-section" id="discover">
					<div className="section-heading">
					<div><span className="eyebrow"><span className="eyebrow-line" /> A GOOD PLACE TO START</span><h2>{activePage === 'Favorites' ? 'Your saved recipes' : 'What sounds good?'}</h2><p>{activePage === 'Favorites' ? 'All your keepers, right here.' : openRecipes.length ? 'Community recipes from Wikibooks, TheMealDB, and connected sources.' : 'A few favorites from our kitchen to yours.'}</p></div>
						<button className="shuffle-button" onClick={chooseRandom} type="button"><Shuffle size={15} /> Pick for me</button>
					</div>
					<div className="recipe-toolbar">
						<div className="category-list" role="tablist" aria-label="Recipe categories">
							{CATEGORIES.map((item) => <button key={item} role="tab" aria-selected={category === item} className={`category-chip ${category === item ? 'is-selected' : ''}`} onClick={() => { resetRecipePage(); setCategory(item); }} type="button">{item}</button>)}
						</div>
						<div className="search-and-filter">
							<label className="search-box"><Search size={16} /><input value={search} onChange={(event) => { resetRecipePage(); setSearch(event.target.value); }} placeholder="Find something delicious…" aria-label="Search recipes or ingredients" />{search && <button type="button" onClick={() => { resetRecipePage(); setSearch(''); }} aria-label="Clear search"><X size={14} /></button>}</label>
							<button className={`filter-button ${includeIngredients.length || excludeIngredients.length ? 'has-filter' : ''}`} onClick={() => setShowFridge(true)} type="button" aria-label="Filter by ingredients"><SlidersHorizontal size={17} /><span>My kitchen</span>{Boolean(includeIngredients.length + excludeIngredients.length) && <i>{includeIngredients.length + excludeIngredients.length}</i>}</button>
						</div>
					</div>
					<div className="recipe-grid">
						{visibleRecipes.map((recipe, index) => <RecipeCard key={recipe.id} recipe={recipe} index={index} isFavorite={favorites.has(recipe.id)} isHighlighted={randomRecipe === recipe.id} onFavorite={toggleFavorite} onSelect={setSelectedRecipe} />)}
					</div>
					{recipes.length === 0 && <div className="empty-state"><span>🍋</span><h3>No recipes just yet</h3><p>Try a different search or ingredient combination.</p><button className="button-secondary" onClick={() => { resetRecipePage(); setSearch(''); setCategory('Everything'); setIncludeIngredients([]); setExcludeIngredients([]); setActivePage('Home'); }} type="button">Clear filters</button></div>}
					{recipes.length > 0 && <div className="recipe-pagination">
						<span className="recipe-page-summary">Showing {(displayedPage - 1) * RECIPES_PER_PAGE + 1}–{Math.min(displayedPage * RECIPES_PER_PAGE, recipes.length)} of {recipes.length} recipes</span>
						{pageCount > 1 && <nav aria-label="Recipe pages">
							<button className="recipe-page-button" onClick={() => changeRecipePage(displayedPage - 1)} type="button" disabled={displayedPage === 1} aria-label="Previous page">‹</button>
							{Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => <button key={page} className={`recipe-page-button ${displayedPage === page ? 'is-current' : ''}`} onClick={() => changeRecipePage(page)} type="button" aria-label={`Page ${page}`} aria-current={displayedPage === page ? 'page' : undefined}>{page}</button>)}
							<button className="recipe-page-button" onClick={() => changeRecipePage(displayedPage + 1)} type="button" disabled={displayedPage === pageCount} aria-label="Next page">›</button>
						</nav>}
					</div>}
				</section>

				<section className="quote-banner">
					<span className="quote-mark">“</span>
					<p>A recipe is just a starting point. The best ones are the ones you make your own.</p>
					<span className="quote-mark quote-mark-end">”</span>
					<span className="quote-credit">A note from our kitchen</span>
					<span className="quote-doodle">✳</span>
				</section>

				<section className="about-section" id="about">
					<div className="about-art"><div className="about-art-circle"><span>GOOD<br />FOOD<br /><em>lives here</em></span><Leaf size={42} /></div><span className="about-art-note">A place at the table for everyone <span>♡</span></span></div>
					<div className="about-copy"><span className="eyebrow"><span className="eyebrow-line" /> A NOTE FROM US</span><h2>Cooking should feel<br />like <em>coming home.</em></h2><p>We made Grassy for the everyday cooks, the recipe tinkerers, the “what’s in the fridge?” thinkers. The people who know a good meal doesn’t need to be complicated — it just needs a little love.</p><p>Pull up a chair. We saved you a spot.</p><button className="button-text" onClick={() => setShowHelp(true)} type="button">Get to know Grassy <ArrowForward size={15} /></button></div>
				</section>
					</>
				)}
			</main>

			<footer className="site-footer"><a className="brand footer-brand" href="#top"><span className="brand-mark"><Leaf size={17} /></span><span>grassy<span className="brand-period">.</span></span></a><span>Made with a little extra love. © 2026 Grassy Canteen</span><button onClick={() => document.getElementById('top')?.scrollIntoView({ behavior: 'smooth' })} type="button">Back to the top <ArrowDown size={14} className="rotate-arrow" /></button></footer>

			{selectedRecipe && <RecipeDialog recipe={selectedRecipe} isFavorite={favorites.has(selectedRecipe.id)} showMeasurements={preferences.showMeasurements !== false} onFavorite={toggleFavorite} onClose={() => setSelectedRecipe(null)} />}
			{showFridge && <FridgeDialog includeIngredients={includeIngredients} excludeIngredients={excludeIngredients} onInclude={(item) => { resetRecipePage(); if (!includeIngredients.includes(item)) setExcludeIngredients((current) => current.filter((ingredient) => ingredient !== item)); toggleFridgeIngredient(item, includeIngredients, setIncludeIngredients); }} onExclude={(item) => { resetRecipePage(); if (!excludeIngredients.includes(item)) setIncludeIngredients((current) => current.filter((ingredient) => ingredient !== item)); toggleFridgeIngredient(item, excludeIngredients, setExcludeIngredients); }} onClose={() => setShowFridge(false)} />}
			{showHelp && <HelpDialog onClose={() => setShowHelp(false)} />}
		</div>
	);
}

function RecipeCard({ recipe, index, isFavorite, isHighlighted, onFavorite, onSelect }) {
	return (
		<article id={`recipe-${recipe.id}`} className={`recipe-card ${isHighlighted ? 'is-highlighted' : ''}`} style={{ '--card-delay': `${index * 70}ms` }}>
			<button className="card-image-button" onClick={() => onSelect(recipe)} type="button" aria-label={`View ${recipe.title}`}>
				<RecipePhoto recipe={recipe} alt={recipe.title} loading="lazy" />
				<span className={`card-category ${recipe.color}`}>{recipe.category}</span>
			</button>
			<button className={`favorite-button ${isFavorite ? 'is-favorite' : ''}`} onClick={() => onFavorite(recipe.id)} type="button" aria-label={isFavorite ? `Remove ${recipe.title} from favorites` : `Save ${recipe.title} to favorites`}><Heart size={17} fill={isFavorite ? 'currentColor' : 'none'} /></button>
			<button className="recipe-card-content" onClick={() => onSelect(recipe)} type="button">
				{recipe.featured ? <span className="card-rating"><Sparkles size={13} /> Featured open recipe</span> : recipe.isUserRecipe ? <span className="card-rating"><Sparkles size={13} /> Your recipe</span> : recipe.source ? <span className="card-rating"><Sparkles size={13} /> {recipe.source}</span> : <span className="card-rating"><Star size={13} fill="currentColor" /> {recipe.rating} <span>({recipe.reviews})</span></span>}
				<h3>{recipe.title}</h3>
				<div className="card-meta"><span><Clock size={14} /> {recipe.time ? `${recipe.time} min` : 'Time varies'}</span><span className="meta-divider" /><span><Utensils size={14} /> {recipe.servings ? `Serves ${recipe.servings}` : 'Servings vary'}</span></div>
				<div className="card-author"><span className={`author-avatar avatar-${recipe.author.charCodeAt(0) % 3}`}>{recipe.source ? recipe.source[0] : recipe.author[0]}</span><span>{recipe.source ? <>from <strong>{recipe.source}</strong></> : <>by <strong>{recipe.author}</strong></>}</span><ArrowForward className="card-arrow" size={16} /></div>
			</button>
		</article>
	);
}

function RecipePhoto({ recipe, alt, loading }) {
	const { image } = recipe;
	if (!image) {
		return <span className="recipe-image-placeholder" role="img" aria-label={`${alt} image not provided`}><Utensils size={26} /></span>;
	}
	const imageUrl = getRecipeImageSrc(image, recipe.isUserRecipe);
	return <img src={imageUrl} alt={alt} loading={loading} onError={(event) => { event.currentTarget.src = IMAGE_FALLBACK; }} />;
}

function capitalizeIngredient(value) {
	return value.replace(/^(\s*)([a-z])/i, (_match, spacing, firstLetter) => `${spacing}${firstLetter.toUpperCase()}`);
}

function formatIngredient(ingredient) {
	const ingredientName = (typeof ingredient === 'string' ? ingredient : ingredient.name)
		.trim()
		.replace(/\s+([,;:])/g, '$1')
		.replace(/\(\s+/g, '(')
		.replace(/\s+\)/g, ')');
	const trailingMeasurement = ingredientName.match(/^(.+?)\s+[—–-]\s+(.+)$/);
	const reversedIngredient = trailingMeasurement && `${trailingMeasurement[2]} ${trailingMeasurement[1]}`;
	const normalized = reversedIngredient && MEASUREMENT_PREFIX.test(reversedIngredient) ? reversedIngredient : ingredientName;
	const match = normalized.match(MEASUREMENT_PREFIX);
	if (!match) return capitalizeIngredient(normalized);
	return `${match[1]} ${capitalizeIngredient(match[2])}`;
}

function stripIngredientMeasurement(ingredient) {
	const match = formatIngredient(ingredient).match(MEASUREMENT_PREFIX);
	return match ? match[2].trim() : formatIngredient(ingredient).trim();
}

function RecipeDialog({ recipe, isFavorite, showMeasurements, onFavorite, onClose }) {
	const [completedSteps, setCompletedSteps] = useState([]);
	const [checkedIngredients, setCheckedIngredients] = useState([]);
	const [showStory, setShowStory] = useState(false);
	const progress = Math.round((completedSteps.length / recipe.steps.length) * 100);
	const toggleStep = (index) => setCompletedSteps((current) => current.includes(index) ? current.filter((step) => step !== index) : [...current, index]);

	useEffect(() => {
		const previousBodyOverflow = document.body.style.overflow;
		const previousRootOverflow = document.documentElement.style.overflow;
		document.body.style.overflow = 'hidden';
		document.documentElement.style.overflow = 'hidden';

		return () => {
			document.body.style.overflow = previousBodyOverflow;
			document.documentElement.style.overflow = previousRootOverflow;
		};
	}, []);

	return (
		<div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
			<section className="recipe-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
				<button className="dialog-close" onClick={onClose} type="button" aria-label="Close recipe"><X size={20} /></button>
				<div className="dialog-image"><RecipePhoto recipe={recipe} alt={recipe.title} /><span className="card-category sage">{recipe.category}</span></div>
				<div className="dialog-body">
					<div className="dialog-title-row"><div><span className="eyebrow">{recipe.source ? `${recipe.source.toUpperCase()} · ${recipe.difficulty.toUpperCase()}` : recipe.isUserRecipe ? `YOUR RECIPE · ${recipe.difficulty.toUpperCase()}` : `A GRASSY FAVORITE · ${recipe.difficulty.toUpperCase()}`}</span><h2 id="dialog-title">{recipe.title}</h2><p className="dialog-subtitle">{recipe.description}</p></div><button className={`favorite-button dialog-favorite ${isFavorite ? 'is-favorite' : ''}`} onClick={() => onFavorite(recipe.id)} type="button" aria-label={isFavorite ? 'Remove from favorites' : 'Save to favorites'}><Heart size={19} fill={isFavorite ? 'currentColor' : 'none'} /></button></div>
					<div className="dialog-meta"><span><Clock size={16} /> {recipe.time ? `${recipe.time} minutes` : 'Time varies'}</span><span><Utensils size={16} /> {recipe.servings ? `Serves ${recipe.servings}` : 'Servings vary'}</span>{recipe.featured ? <span><Sparkles size={15} /> Featured open recipe</span> : recipe.isUserRecipe ? <span><Sparkles size={15} /> Your recipe</span> : recipe.source ? <span><Sparkles size={15} /> {recipe.source}</span> : <span><Star size={15} fill="currentColor" /> {recipe.rating} ({recipe.reviews})</span>}</div>
					<div className="recipe-detail-grid">
						<div className="ingredients-panel"><div className="detail-heading"><h3>What you’ll need</h3><span>{recipe.ingredients.length} ingredients</span></div>{recipe.ingredients.map((ingredient, index) => { const name = formatIngredient(typeof ingredient === 'string' ? ingredient : ingredient.name); const displayName = showMeasurements ? name : stripIngredientMeasurement(name); return <label key={`${name}-${index}`} className={`ingredient-row ${checkedIngredients.includes(name) ? 'is-checked' : ''}`}><input type="checkbox" checked={checkedIngredients.includes(name)} onChange={() => setCheckedIngredients((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])} /><span>{displayName}</span></label>; })}<p className="ingredient-hint"><Check size={13} /> Tap an ingredient as you go</p></div>
						<div className="steps-panel"><div className="detail-heading"><h3>Let’s make it</h3><span>{completedSteps.length} of {recipe.steps.length} done</span></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div>{recipe.steps.map((step, index) => <button key={step} className={`step-row ${completedSteps.includes(index) ? 'is-complete' : ''}`} onClick={() => toggleStep(index)} type="button"><span className="step-number">{completedSteps.includes(index) ? <Check size={15} /> : index + 1}</span><span>{step}</span></button>)}{progress === 100 && <div className="complete-message">You made it! Dinner is served. <span>♡</span></div>}</div>
					</div>
					<div className="author-note"><span className={`author-avatar avatar-${recipe.author.charCodeAt(0) % 3}`}>{recipe.source ? recipe.source[0] : recipe.author[0]}</span><span>{recipe.source ? <>Recipe data from <strong>{recipe.attribution || recipe.source}</strong><small>Imported from {recipe.source}</small></> : recipe.isUserRecipe ? <>Created by <strong>{recipe.author}</strong><small>Saved on this device</small></> : <>A recipe by <strong>{recipe.author}</strong><small>Home cook & enthusiastic taste-tester</small></>}</span>{!recipe.source && !recipe.isUserRecipe && <button onClick={() => setShowStory(!showStory)} type="button">{showStory ? 'Hide story' : 'A note from the cook'} <ChevronDown size={14} className={showStory ? 'turned' : ''} /></button>}</div>
					{showStory && !recipe.source && !recipe.isUserRecipe && <p className="cook-story">“This is the kind of dinner I make when the day has been long and the fridge has a few odds and ends. It’s forgiving, cozy, and always better shared.”</p>}
					{recipe.sourceUrl ? <div className="source-link">Source & attribution: <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">{recipe.source || 'Original recipe'} <ArrowForward size={12} /></a>{recipe.originalSourceUrl && recipe.originalSourceUrl !== recipe.sourceUrl && <small>Original recipe: <a href={recipe.originalSourceUrl} target="_blank" rel="noreferrer">Visit source website</a></small>}{recipe.license && <small>Content: {recipe.license}{recipe.licenseUrl && <> · <a href={recipe.licenseUrl} target="_blank" rel="noreferrer">license details</a></>}</small>}<small>Attribution: {recipe.attribution || recipe.author}</small></div> : <div className="source-link">{recipe.isUserRecipe ? 'Saved in your personal recipe library.' : 'Grassy Canteen tested · Make it your own'}</div>}
				</div>
			</section>
		</div>
	);
}

function FridgeDialog({ includeIngredients, excludeIngredients, onInclude, onExclude, onClose }) {
	return (
		<div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
			<section className="fridge-dialog" role="dialog" aria-modal="true" aria-labelledby="fridge-title">
				<button className="dialog-close" onClick={onClose} type="button" aria-label="Close ingredient finder"><X size={20} /></button>
				<div className="fridge-illustration">🥕 🫑 🍋</div>
				<span className="eyebrow">A CLEVER LITTLE SHORTCUT</span><h2 id="fridge-title">What’s in your kitchen?</h2><p>Pick ingredients you have on hand and we’ll find recipes that use every one. You can also leave out anything you’re not in the mood for.</p>
				<h3><span className="ingredient-dot have-dot" /> I have these</h3><div className="fridge-ingredients">{INGREDIENTS.map((ingredient) => <button className={`fridge-chip ${includeIngredients.includes(ingredient) ? 'is-included' : ''}`} onClick={() => onInclude(ingredient)} type="button" key={ingredient}>{includeIngredients.includes(ingredient) && <Check size={13} />}{ingredient}</button>)}</div>
				<h3><span className="ingredient-dot skip-dot" /> Please leave out</h3><div className="fridge-ingredients">{INGREDIENTS.map((ingredient) => <button className={`fridge-chip ${excludeIngredients.includes(ingredient) ? 'is-excluded' : ''}`} onClick={() => onExclude(ingredient)} type="button" key={ingredient}>{excludeIngredients.includes(ingredient) && <Minus size={13} />}{ingredient}</button>)}</div>
				<div className="fridge-footer"><span>{includeIngredients.length + excludeIngredients.length ? `${includeIngredients.length + excludeIngredients.length} ingredient preferences set` : 'No ingredients selected yet'}</span><button className="button-primary" onClick={onClose} type="button">Show me recipes <ArrowForward size={15} /></button></div>
			</section>
		</div>
	);
}

function HelpDialog({ onClose }) {
	return (
		<div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
			<section className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
				<button className="dialog-close" onClick={onClose} type="button" aria-label="Close help"><X size={20} /></button>
				<span className="eyebrow">YOUR LITTLE GRASSY GUIDE</span><h2 id="help-title">You’re right at home.</h2><p className="help-intro">Grassy is your friendly corner of the internet for finding the next good thing to cook.</p>
				<div className="help-tip"><span>01</span><div><strong>Find your craving</strong><p>Search by recipe or ingredient, or browse by the kind of meal you feel like making.</p></div></div>
				<div className="help-tip"><span>02</span><div><strong>Make it yours</strong><p>Tap the heart to save a recipe. Your favorites stay tucked away on this device.</p></div></div>
				<div className="help-tip"><span>03</span><div><strong>Start where you are</strong><p>Choose “Cook with what I have” to find ideas around what’s already in your kitchen.</p></div></div>
				<div className="help-tip"><span>04</span><div><strong>Keep your own cookbook</strong><p>Add recipes from your kitchen, then import or export a local JSON or text backup.</p></div></div>
				<button className="button-primary help-done" onClick={onClose} type="button">Sounds lovely <Heart size={15} /></button>
			</section>
		</div>
	);
}

export default RecipeHome;
