"""
backend/server.py
Minimal FastAPI server that matches the extension's API layer.

Run:
    pip install fastapi uvicorn
    uvicorn server:app --reload --port 8000
"""

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os

app = FastAPI(title="AI Shopping Extension Backend")

# ---- CORS (allow extension to talk to us) ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Lock this down in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Auth ----
API_KEY = os.environ.get("API_KEY", "dev-key-change-me")


def verify_api_key(request: Request):
    key = request.headers.get("X-API-Key")
    if key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


# ---- Models ----

class IntentRequest(BaseModel):
    text: str

class IntentResponse(BaseModel):
    is_shopping: bool
    confidence: float
    categories: list[str]

class EnrichRequest(BaseModel):
    query: str
    response: str

class ProductInfo(BaseModel):
    name: str
    price: Optional[str] = None
    rating: Optional[str] = None
    url: Optional[str] = None
    specs: Optional[dict] = None

class EnrichResponse(BaseModel):
    products: list[ProductInfo]
    comparison_url: Optional[str] = None

class ProductAnalyzeRequest(BaseModel):
    name: str
    price: Optional[str] = None
    rating: Optional[str] = None
    url: Optional[str] = None
    specs: Optional[dict] = None

class ScrapeRequest(BaseModel):
    url: str
    keywords: Optional[list[str]] = None  # Optional keyword filter
    prompt: Optional[str] = None          # User's original message (for shopping intent check)

class ScrapedProduct(BaseModel):
    name: Optional[str] = None
    price: Optional[str] = None
    rating: Optional[str] = None
    category: Optional[str] = None

class ScrapeResponse(BaseModel):
    name: Optional[str] = None
    price: Optional[str] = None
    rating: Optional[str] = None
    specs: Optional[dict] = None
    source_url: str
    products: list[ScrapedProduct] = []
    saved: bool = False                   # True if data was saved to CSV
    error: Optional[str] = None


# ---- Routes ----

@app.get("/health")
def health():
    """Connection test endpoint. The popup 'Test Connection' button hits this."""
    return {"status": "ok", "version": "0.1.0"}


@app.post("/detect-intent", response_model=IntentResponse, dependencies=[Depends(verify_api_key)])
def detect_intent(req: IntentRequest):
    """
    Analyze user message for shopping intent.
    Called by content-aichat.js when the user sends a message.

    TODO: Replace with your actual detection logic (keyword matching,
    ML classifier, LLM call, etc.)
    """
    text_lower = req.text.lower()
    shopping_keywords = ["buy", "price", "cheap", "best", "recommend", "compare", "deal", "review"]
    matches = [kw for kw in shopping_keywords if kw in text_lower]

    return IntentResponse(
        is_shopping=len(matches) >= 1,
        confidence=min(len(matches) / 3, 1.0),
        categories=matches,
    )


@app.post("/enrich", response_model=EnrichResponse, dependencies=[Depends(verify_api_key)])
def enrich_response(req: EnrichRequest):
    """
    Take the user's shopping query + AI response and return
    structured product data with links, specs, pricing.
    Called by content-aichat.js after the assistant responds.

    TODO: Replace with your actual enrichment logic (web scraping,
    price API calls, product database lookup, etc.)
    """
    return EnrichResponse(
        products=[
            ProductInfo(
                name="Example Product",
                price="$99.99",
                rating="4.5/5",
                url="https://example.com",
                specs={"placeholder": "Replace with real data"},
            )
        ],
        comparison_url=None,
    )


@app.post("/product/analyze", dependencies=[Depends(verify_api_key)])
def analyze_product(req: ProductAnalyzeRequest):
    """
    Analyze a product scraped from a shopping site.
    Called by content-shop.js when it detects a product page.

    TODO: Replace with your logic — price history, competitor
    comparison, review sentiment, deal scoring, etc.
    """
    return {
        "product": req.name,
        "analysis": {
            "price_rating": "average",
            "similar_products": [],
            "recommendation": "Replace this with your analysis logic.",
        },
    }


@app.post("/scrape", response_model=ScrapeResponse, dependencies=[Depends(verify_api_key)])
def scrape_product_page(req: ScrapeRequest):
    """
    Extension sends a URL, optional keywords, and the user's prompt.
    Only saves to CSV if the prompt is shopping-related.
    """
    try:
        from scraper import scrape_product
        data = scrape_product(req.url, keywords=req.keywords, prompt=req.prompt)

        return ScrapeResponse(
            name=data.get("name"),
            price=data.get("price"),
            rating=data.get("rating"),
            specs=data.get("specs"),
            source_url=req.url,
            products=[ScrapedProduct(**p) for p in data.get("products", [])],
            saved=data.get("saved", False),
            error=data.get("error"),
        )
    except ImportError:
        return ScrapeResponse(
            source_url=req.url,
            error="scraper.py not found.",
        )
    except Exception as e:
        return ScrapeResponse(
            source_url=req.url,
            error=str(e),
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
