import requests
from bs4 import BeautifulSoup
import csv
import os
import re

headers = {
    "User-Agent": "Mozilla/5.0"
}

# ---- Shopping Intent Detection ----

SHOPPING_KEYWORDS = [
    "buy", "buying", "purchase", "shop", "shopping",
    "price", "pricing", "cost", "costs",
    "cheap", "cheapest", "affordable", "budget",
    "best", "top", "recommend", "recommendation",
    "compare", "comparison", "versus", "vs",
    "deal", "deals", "discount", "sale",
    "review", "reviews", "rating", "ratings",
    "specs", "specifications",
    "worth it", "worth buying",
    "upgrade", "alternative", "alternatives",
    "where to buy", "where can i get",
]

SHOPPING_PATTERNS = [
    re.compile(r"what('s| is) the best .+ (for|under|around)", re.I),
    re.compile(r"which .+ should i (buy|get|pick)", re.I),
    re.compile(r"looking for (a|an|the|some) .+", re.I),
    re.compile(r"recommend .+ (for|under|around)", re.I),
    re.compile(r"how much (does|do|is|are) .+", re.I),
    re.compile(r"is (the |it |this )?.+ worth", re.I),
    re.compile(r"\$\d+"),
    re.compile(r".+ or .+ \?", re.I),
    re.compile(r"best .+ (under|for|in) .+", re.I),
]


def is_shopping_intent(text: str) -> bool:
    """Returns True only if the text is shopping-related."""
    lower = text.lower()
    score = 0

    for kw in SHOPPING_KEYWORDS:
        if kw in lower:
            score += 1

    for pattern in SHOPPING_PATTERNS:
        if pattern.search(text):
            score += 2

    return score >= 2


# ---- Keyword Loading ----

def load_keywords(file_path=None):
    """Load keywords from a text file into a list."""
    if file_path is None:
        file_path = os.path.join(os.path.dirname(__file__), "keywords.txt")
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return [line.strip().lower() for line in f if line.strip()]
    except FileNotFoundError:
        return []


# ---- Fetching ----

def fetch_page(url):
    """Fetch the webpage content."""
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        return response
    except requests.exceptions.RequestException as e:
        print("Error fetching page:", e)
        return None


# ---- Parsing Strategies ----

def parse_product_pods(html, keywords):
    """Original parser: articles with class product_pod."""
    soup = BeautifulSoup(html, "html.parser")
    items = soup.find_all("article", class_="product_pod")
    results = []

    for item in items:
        title = item.h3.a["title"]
        price = item.find("p", class_="price_color").text

        if keywords:
            if not any(k in title.lower() for k in keywords):
                continue

        results.append({"name": title, "price": price})

    return results


def parse_json_products(data, keywords):
    """Parse JSON array of products (e.g., fakestoreapi.com)."""
    results = []

    for item in data:
        title = item.get("title", "")
        price = item.get("price")
        rating_info = item.get("rating", {})

        if keywords:
            if not any(k in title.lower() for k in keywords):
                continue

        results.append({
            "name": title,
            "price": f"${price}" if price else None,
            "rating": str(rating_info.get("rate", "")) or None,
            "category": item.get("category"),
        })

    return results


def parse_generic_product(html):
    """Fallback: try common selectors for product pages."""
    soup = BeautifulSoup(html, "html.parser")

    name_el = (
        soup.select_one("#productTitle")
        or soup.select_one(".sku-title h1")
        or soup.select_one('[itemprop="name"]')
        or soup.select_one("h1")
    )
    price_el = (
        soup.select_one(".a-price .a-offscreen")
        or soup.select_one('[itemprop="price"]')
        or soup.select_one(".price")
    )

    if name_el:
        return [{"name": name_el.text.strip(), "price": price_el.text.strip() if price_el else None}]
    return []


# ---- CSV Saving ----

def save_to_csv(data, prompt, file_path=None):
    """Save scraped data to CSV. Only called if prompt is shopping-related."""
    if file_path is None:
        file_path = os.path.join(os.path.dirname(__file__), "scraped_data.csv")

    file_exists = os.path.exists(file_path)

    with open(file_path, "a", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=["prompt", "name", "price", "rating", "category"])
        if not file_exists:
            writer.writeheader()
        for item in data:
            writer.writerow({
                "prompt": prompt,
                "name": item.get("name", ""),
                "price": item.get("price", ""),
                "rating": item.get("rating", ""),
                "category": item.get("category", ""),
            })

    print(f"Saved {len(data)} items for prompt: '{prompt[:60]}'")


# ---- Main Scrape Function (called by server.py) ----

def scrape_product(url: str, keywords: list = None, prompt: str = None) -> dict:
    """
    Scrape product data from a URL.
    If a prompt is provided, only saves to CSV when it's shopping-related.

    Args:
        url:      The page to scrape
        keywords: Optional keyword filter for products
        prompt:   The user's original message (used for shopping intent check)

    Returns:
        dict with name, price, rating, specs, products, saved
    """
    if keywords is None:
        keywords = load_keywords()

    response = fetch_page(url)
    if not response:
        return {
            "name": None, "price": None, "rating": None,
            "specs": {}, "products": [], "saved": False,
            "error": "Failed to fetch page.",
        }

    products = []

    # Strategy 1: JSON response
    try:
        json_data = response.json()
        if isinstance(json_data, list):
            products = parse_json_products(json_data, keywords)
        elif isinstance(json_data, dict) and "title" in json_data:
            products = [{
                "name": json_data.get("title"),
                "price": f"${json_data['price']}" if json_data.get("price") else None,
                "rating": str(json_data.get("rating", {}).get("rate", "")),
                "category": json_data.get("category"),
            }]
    except (ValueError, AttributeError):
        pass

    # Strategy 2: HTML product pods
    if not products:
        products = parse_product_pods(response.text, keywords)

    # Strategy 3: Generic product page
    if not products:
        products = parse_generic_product(response.text)

    # ---- Only save if the prompt is shopping-related ----
    saved = False
    if prompt and products:
        if is_shopping_intent(prompt):
            save_to_csv(products, prompt)
            saved = True
            print(f"[scraper] Shopping intent confirmed. Saved {len(products)} products.")
        else:
            print(f"[scraper] Not shopping-related: '{prompt[:60]}'. Skipping save.")

    first = products[0] if products else {}
    return {
        "name": first.get("name"),
        "price": first.get("price"),
        "rating": first.get("rating"),
        "specs": {"category": first.get("category")} if first.get("category") else {},
        "products": products,
        "saved": saved,
    }
