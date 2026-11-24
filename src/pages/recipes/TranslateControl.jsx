import { useEffect, useId, useRef, useState } from 'react';
import { Languages } from 'lucide-react';

let googleTranslateLoadPromise;
let googleTranslateInitialized = false;

function initializeGoogleTranslate(widgetId) {
	const TranslateElement = window.google?.translate?.TranslateElement;
	if (!TranslateElement) throw new Error('Google Translate did not initialize.');

	new TranslateElement(
		{
			pageLanguage: 'en',
			autoDisplay: false,
			layout: TranslateElement.InlineLayout.HORIZONTAL,
		},
		widgetId,
	);
	googleTranslateInitialized = true;
}

function loadGoogleTranslate(widgetId) {
	if (googleTranslateInitialized) return Promise.resolve();

	if (window.google?.translate?.TranslateElement) {
		initializeGoogleTranslate(widgetId);
		return Promise.resolve();
	}

	if (googleTranslateLoadPromise) return googleTranslateLoadPromise;

	googleTranslateLoadPromise = new Promise((resolve, reject) => {
		window.googleTranslateElementInit = () => {
			try {
				initializeGoogleTranslate(widgetId);
				resolve();
			} catch (error) {
				reject(error);
			}
		};

		const script = document.createElement('script');
		script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
		script.async = true;
		script.onerror = () => reject(new Error('Google Translate could not be loaded.'));
		document.head.appendChild(script);
	}).catch((error) => {
		googleTranslateLoadPromise = undefined;
		throw error;
	});

	return googleTranslateLoadPromise;
}

export default function TranslateControl() {
	const [isOpen, setIsOpen] = useState(false);
	const [search, setSearch] = useState('');
	const [isSearchEnabled, setIsSearchEnabled] = useState(false);
	const [status, setStatus] = useState('Scroll the list or search by language name.');
	const buttonRef = useRef(null);
	const panelRef = useRef(null);
	const widgetRef = useRef(null);
	const observerRef = useRef(null);
	const widgetId = `google-translate-${useId().replace(/:/g, '')}`;

	const filterLanguageOptions = (searchTerm = search) => {
		const languageSelect = widgetRef.current?.querySelector('select.goog-te-combo');
		if (!languageSelect) return;

		const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
		let visibleLanguageCount = 0;
		Array.from(languageSelect.options).forEach((option, index) => {
			const matchesSearch = index === 0 || option.textContent.toLocaleLowerCase().includes(normalizedSearch);
			option.hidden = !matchesSearch;
			if (index > 0 && matchesSearch) visibleLanguageCount += 1;
		});

		if (normalizedSearch && visibleLanguageCount === 0) {
			setStatus('No languages match your search.');
		} else if (normalizedSearch) {
			setStatus(`${visibleLanguageCount} matching languages. Select one to translate.`);
		} else {
			setStatus('Scroll the list or search by language name.');
		}
	};

	const prepareLanguageSelect = () => {
		const languageSelect = widgetRef.current?.querySelector('select.goog-te-combo');
		if (!languageSelect) return false;

		languageSelect.size = 8;
		languageSelect.setAttribute('aria-label', 'Choose a language');
		setIsSearchEnabled(true);
		filterLanguageOptions();
		observerRef.current?.disconnect();
		return true;
	};

	useEffect(() => {
		if (!isOpen) return undefined;

		let isCurrent = true;
		setStatus('Loading translation options…');
		loadGoogleTranslate(widgetId)
			.then(() => {
				if (!isCurrent) return;
				if (!prepareLanguageSelect()) {
					observerRef.current = new MutationObserver(prepareLanguageSelect);
					observerRef.current.observe(widgetRef.current, { childList: true, subtree: true });
				}
			})
			.catch((error) => {
				if (!isCurrent) return;
				console.error(error);
				setStatus('Translation options could not be loaded. Close this panel and try again.');
			});

		return () => {
			isCurrent = false;
			observerRef.current?.disconnect();
		};
	}, [isOpen, widgetId]);

	useEffect(() => {
		if (!isOpen) return undefined;

		const closeOnOutsideClick = (event) => {
			if (!panelRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) {
				setIsOpen(false);
			}
		};
		const closeOnEscape = (event) => {
			if (event.key === 'Escape') {
				setIsOpen(false);
				buttonRef.current?.focus();
			}
		};

		document.addEventListener('click', closeOnOutsideClick);
		document.addEventListener('keydown', closeOnEscape);
		return () => {
			document.removeEventListener('click', closeOnOutsideClick);
			document.removeEventListener('keydown', closeOnEscape);
		};
	}, [isOpen]);

	return (
		<div className="translate-control">
			<button
				aria-controls="translate-panel"
				aria-expanded={isOpen}
				aria-label="Translate this site"
				className={`icon-button translate-button ${isOpen ? 'is-open' : ''}`}
				onClick={() => setIsOpen((open) => !open)}
				ref={buttonRef}
				title="Translate this site"
				type="button"
			>
				<Languages size={18} />
			</button>
			<div
				aria-label="Google Translate"
				className="translate-panel"
				hidden={!isOpen}
				id="translate-panel"
				ref={panelRef}
			>
				<p className="translate-panel-title">Translate this site</p>
				<label className="translate-search-label" htmlFor="translate-language-search">Search languages</label>
				<input
					autoComplete="off"
					className="translate-search"
					disabled={!isSearchEnabled}
					id="translate-language-search"
					onChange={(event) => {
						setSearch(event.target.value);
						filterLanguageOptions(event.target.value);
					}}
					placeholder="Type a language name"
					type="search"
					value={search}
				/>
				<p aria-live="polite" className="translate-status" role="status">{status}</p>
				<div className="google-translate-widget" id={widgetId} ref={widgetRef} />
			</div>
		</div>
	);
}
