import requests
from bs4 import BeautifulSoup
import csv

# Target website
URL = "https://fakestoreapi.com/products"

headers = {
    "User-Agent": "Mozilla/5.0"
}

def load_keywords(file_path="keywords.txt"):
    """Load keywords from a text file into a list"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            keywords = [line.strip().lower() for line in f if line.strip()]
        return keywords
    except FileNotFoundError:
        print(f"{file_path} not found. Scraper will run without filtering.")
        return []

def fetch_page(url):
    """Fetch the webpage content"""
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.text
    except requests.exceptions.RequestException as e:
        print("Error fetching page:", e)
        return None

def parse_page(html, keywords):
    """Extract book titles and prices, filtering by keywords"""
    soup = BeautifulSoup(html, "html.parser")
    results = []

    # Find all products
    items = soup.find_all("article", class_="product_pod")

    for item in items:
        title = item.h3.a["title"]
        price = item.find("p", class_="price_color").text

        # Only include if title contains any keyword
        if keywords:
            title_lower = title.lower()
            if not any(k in title_lower for k in keywords):
                continue

        results.append({
            "title": title,
            "price": price
        })

    return results

def save_to_csv(data):
    """Save scraped data to CSV"""
    with open("scraped_data.csv", "w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=["title", "price"])
        writer.writeheader()
        writer.writerows(data)

    print(f"Data saved to scraped_data.csv ({len(data)} items)")

def main():
    print("Starting scraper...")

    keywords = load_keywords()
    if keywords:
        print(f"Filtering with keywords: {keywords}")
    else:
        print("No keywords loaded. All items will be scraped.")

    html = fetch_page(URL)

    if html:
        data = parse_page(html, keywords)

        if data:
            save_to_csv(data)
        else:
            print("No data found for the given keywords.")
    else:
        print("Failed to retrieve page.")

    print("Scraper finished.")

if __name__ == "__main__":
    main()