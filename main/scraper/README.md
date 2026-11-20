# Recipe importers

Grassy imports recipes from the official APIs for TheMealDB, Recipe API, and
fatsecret, plus the Wikibooks Scrapy spider. API data is normalized to the
same recipe card format and merged into `main/public/recipes.json` by stable
provider ID. The app labels these recipes as an imported collection and keeps
their source and attribution with each record.

TheMealDB is a community database, not a live trending feed. The importer uses
its documented API and free development key `1`, keeps the returned meal image,
and credits TheMealDB. Each recipe links to its stable TheMealDB meal page; a
provider-supplied original recipe link is also retained when present.
The free key is intended for development and personal use; follow TheMealDB's
current terms and obtain production access before distributing a public app.

Recipe API's unauthenticated `/api/v1/dinner` endpoint supplies one sample
recipe. A registered free evaluation key enables recipe search; each full
recipe detail request uses one of the plan's limited detail credits. Keep the
number of requested details bounded.

fatsecret's Basic edition is free with registration and has a daily request
limit. Its OAuth client ID and secret are required. The importer reads those
credentials from environment variables, never from browser code or checked-in
files. fatsecret requires token requests from an IP address allowed in the
developer account, so local imports may need the machine's outbound IP
configured there.

Wikibooks remains an editor-featured, open collection, not a popularity or
trend ranking. Its spider obeys `robots.txt`, identifies itself, limits
concurrency, applies a delay and AutoThrottle, and exports pages only when it
finds ingredient and instruction sections. It does not download images.
Wikibooks page-specific license notices take precedence; the existing dataset
records CC BY-SA 4.0 attribution and license links for these entries.

## Import API recipes

From `main/scraper` in PowerShell, import 30 TheMealDB recipes and the public
Recipe API sample. Existing Wikibooks recipes are preserved and duplicate
provider IDs are replaced in place:

```powershell
py .\import_api_recipes.py
```

Options:

```powershell
py .\import_api_recipes.py --themealdb-limit 30 --recipe-api-limit 0 --fatsecret-limit 0
```

For Recipe API details, create a free key at recipe-api.com and set it only in
your local shell. Each detail is a metered request (the free evaluation
includes 50 lifetime details):

```powershell
$env:RECIPE_API_KEY = "your-key"
py .\import_api_recipes.py --themealdb-limit 30 --recipe-api-limit 5
```

For fatsecret, register an app, configure its allowed API access, then provide
the credentials through the shell. Its OAuth client secret must remain private:

```powershell
$env:FATSECRET_CLIENT_ID = "your-client-id"
$env:FATSECRET_CLIENT_SECRET = "your-client-secret"
py .\import_api_recipes.py --themealdb-limit 30 --fatsecret-limit 10 --fatsecret-search "chicken"
```

Leave credentials out of source control and do not put them in the React app.
The importer reports HTTP/auth failures rather than silently skipping a source.
Set a provider's limit to `0` to disable its keyed search; Recipe API still
contributes its one public sample.

The app reads `public/recipes.json` on startup. To refresh the Wikibooks source,
install Scrapy from `requirements.txt` and run:

```powershell
py -m scrapy crawl wikibooks -a max_candidates=60 -O ..\public\wikibooks-recipes.json
```

Then merge it with the API importer:

```powershell
py .\import_api_recipes.py --themealdb-limit 0 --wikibooks-file ..\public\wikibooks-recipes.json
```

Check each provider's current terms before publishing or sharing the generated
dataset; do not infer a license where a provider does not supply one.

## Personal recipe library

The Grassy app's **My recipes** tab stores user-created recipes in this
browser's local storage. Its JSON and plain-text exports can be imported again
on this or another device. The URL form reads Schema.org `Recipe` JSON-LD only;
it does not copy the full page or bypass access controls. The form asks the user
to confirm they have permission to reuse the recipe before parsing.
Recipe images can be uploaded or linked by URL; uploaded JPEG, PNG, and WebP
images are center-cropped to 3:2, compressed to 180 KB or less, and included in
recipe backups. Choosing an upload replaces the URL, and entering a URL replaces
the upload.

The URL parser is a Vite middleware route, so it works with `npm run dev` and
`npm run preview`. A static production host must provide an equivalent
same-origin `/api/recipes/parse` route. Requests are restricted to public
websites, bounded by response size, timeout, redirect count, and request rate.
User-recipe images load through a same-origin image route that revalidates each
redirect and public IP address, accepts only supported image formats, and limits
response size and request rate. A static production host must also provide an
equivalent `/api/recipes/image` route. Pages without complete structured recipe
data must be entered manually.

## Test

```powershell
py -m unittest discover -s tests -v
```

From `main`, run the app tests with:

```powershell
npm run test:recipes
```
