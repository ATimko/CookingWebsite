BOT_NAME = "gather_recipe_importer"

SPIDER_MODULES = ["gather_scraper.spiders"]
NEWSPIDER_MODULE = "gather_scraper.spiders"

ROBOTSTXT_OBEY = True
CONCURRENT_REQUESTS = 2
DOWNLOAD_DELAY = 1.0
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 1.0
AUTOTHROTTLE_MAX_DELAY = 10.0
RETRY_TIMES = 3
USER_AGENT = "GrassyRecipeLibrary/1.0 (personal open-recipe importer)"

LOG_LEVEL = "INFO"
