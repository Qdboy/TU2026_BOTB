"""
Share of Voice (SOV) Stream System
=====================================
Tracks how often a brand appears in AI-generated shopping query responses
in real time. Designed for the company-facing analytics platform.

Components:
  1. QueryProcessor   - tags brands and attributes from AI responses
  2. ResponseStore    - stores raw AI responses per brand, extractable externally
  3. SOVTracker       - maintains rolling SOV calculations
  4. FeedStream       - emits live feed events as queries come in
  5. FastAPI app      - HTTP server wiring everything together

Run:
  pip install fastapi uvicorn openai sse-starlette --break-system-packages
  uvicorn share_of_voice:app --reload

OpenAI:
  Set OPENAI_API_KEY in your environment.
  Swap MODEL to any OpenAI model string.

Extracting responses to another script:
  Option A — same process (import):
    from share_of_voice import response_store
    entries = response_store.get("allbirds", limit=20)

  Option B — separate process (HTTP):
    GET http://localhost:8000/responses/allbirds?limit=20
    Returns a JSON array of ResponseEntry dicts.
"""

import os
import re
import json
import asyncio
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
from openai import AsyncOpenAI

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "sk-placeholder")
MODEL = "gpt-4o-mini"

# ---------------------------------------------------------------------------
# 1. DATA MODELS
# ---------------------------------------------------------------------------

@dataclass
class QueryEvent:
    query_id: str
    query_text: str
    category: str
    timestamp: float = field(default_factory=lambda: time.time())
    brands_mentioned: list[str] = field(default_factory=list)
    attributes_mentioned: list[str] = field(default_factory=list)
    raw_ai_response: str = ""


@dataclass
class SOVSnapshot:
    brand: str
    category: str
    appearances: int
    total_queries: int
    sov_pct: float
    delta_vs_last_window: float
    top_trigger_attribute: str
    timestamp: float = field(default_factory=lambda: time.time())


@dataclass
class ResponseEntry:
    """Shape of a stored response — what gets exported to other scripts."""
    query_id: str
    query_text: str
    category: str
    raw_ai_response: str
    brands_mentioned: list[str]
    attributes_mentioned: list[str]
    iso_time: str


# ---------------------------------------------------------------------------
# 2. RESPONSE STORE  ← the extractable piece
# ---------------------------------------------------------------------------

class ResponseStore:
    """
    Holds the last MAX_PER_BRAND responses per brand.

    Two ways another script can consume this:

      Option A — same process (import):
        from share_of_voice import response_store
        entries = response_store.get("allbirds", limit=20)
        for e in entries:
            print(e.raw_ai_response)

      Option B — separate process (HTTP):
        GET http://localhost:8000/responses/allbirds?limit=20
        Returns a JSON array of ResponseEntry dicts.
    """

    MAX_PER_BRAND = 200

    def __init__(self):
        self._store: dict[str, deque[ResponseEntry]] = defaultdict(
            lambda: deque(maxlen=self.MAX_PER_BRAND)
        )

    def push(self, brand: str, entry: ResponseEntry) -> None:
        """Append a new entry. Newest entries are at index 0 (appendleft)."""
        self._store[brand.lower()].appendleft(entry)

    def get(self, brand: str, limit: int = 50) -> list[ResponseEntry]:
        """Return the last N responses for a brand, newest first."""
        entries = list(self._store.get(brand.lower(), []))
        return entries[:limit]

    def brands(self) -> list[str]:
        """All brands currently tracked."""
        return list(self._store.keys())


# Module-level singleton — import this from other scripts
response_store = ResponseStore()


# ---------------------------------------------------------------------------
# 3. QUERY PROCESSOR
# ---------------------------------------------------------------------------

class QueryProcessor:

    SYSTEM_PROMPT = """
    You are a shopping assistant. Answer the user's question with a helpful
    product recommendation. Keep your response concise (2-3 sentences).
    """

    TAG_PROMPT = """
    Given this AI shopping response, extract:
    1. Every brand name mentioned (proper nouns only)
    2. Every product attribute emphasized (e.g. 'sustainable', 'wide fit', 'under $150')

    Response to analyze:
    {response}

    Reply ONLY with valid JSON in this exact shape, nothing else:
    {{"brands": ["Brand1", "Brand2"], "attributes": ["attr1", "attr2"]}}
    """

    def __init__(self):
        self.client = AsyncOpenAI(api_key=OPENAI_API_KEY)

    async def process(self, event: QueryEvent) -> QueryEvent:
        # Step 1 — get the recommendation
        rec_response = await self.client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": event.query_text},
            ],
            max_tokens=200,
        )
        event.raw_ai_response = rec_response.choices[0].message.content.strip()

        # Step 2 — extract brands and attributes from that response
        tag_response = await self.client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "user",
                    "content": self.TAG_PROMPT.format(response=event.raw_ai_response),
                }
            ],
            max_tokens=200,
        )
        raw_json = tag_response.choices[0].message.content.strip()
        raw_json = re.sub(r"```(?:json)?|```", "", raw_json).strip()

        try:
            tags = json.loads(raw_json)
            event.brands_mentioned = [b.lower() for b in tags.get("brands", [])]
            event.attributes_mentioned = tags.get("attributes", [])
        except json.JSONDecodeError:
            event.brands_mentioned = []
            event.attributes_mentioned = []

        return event


# ---------------------------------------------------------------------------
# 4. SOV TRACKER
# ---------------------------------------------------------------------------

class SOVTracker:

    def __init__(self, window_seconds: int = 3600):
        self.window = window_seconds
        self._appearances: dict[str, deque] = defaultdict(deque)
        self._all_queries: deque = deque()
        self._attribute_counts: dict[str, dict[str, int]] = defaultdict(
            lambda: defaultdict(int)
        )
        self._prev_window_sov: dict[str, float] = {}

    def record(self, event: QueryEvent) -> None:
        now = event.timestamp
        self._all_queries.append(now)
        self._evict(now)

        for brand in event.brands_mentioned:
            self._appearances[brand].append(now)
            for attr in event.attributes_mentioned:
                self._attribute_counts[brand][attr] += 1

    def snapshot(self, brand: str, category: str) -> SOVSnapshot:
        now = time.time()
        self._evict(now)

        appearances = len(self._appearances.get(brand, []))
        total = len(self._all_queries)
        sov_pct = round((appearances / total * 100), 1) if total > 0 else 0.0

        prev = self._prev_window_sov.get(brand, sov_pct)
        delta = round(sov_pct - prev, 1)

        attr_counts = self._attribute_counts.get(brand, {})
        top_attr = max(attr_counts, key=attr_counts.get) if attr_counts else "—"

        return SOVSnapshot(
            brand=brand,
            category=category,
            appearances=appearances,
            total_queries=total,
            sov_pct=sov_pct,
            delta_vs_last_window=delta,
            top_trigger_attribute=top_attr,
        )

    def update_prev_window(self, brand: str) -> None:
        snap = self.snapshot(brand, category="")
        self._prev_window_sov[brand] = snap.sov_pct

    def _evict(self, now: float) -> None:
        cutoff = now - self.window
        while self._all_queries and self._all_queries[0] < cutoff:
            self._all_queries.popleft()
        for brand_deque in self._appearances.values():
            while brand_deque and brand_deque[0] < cutoff:
                brand_deque.popleft()


# ---------------------------------------------------------------------------
# 5. FEED STREAM
# ---------------------------------------------------------------------------

class FeedStream:

    def __init__(self, tracker: SOVTracker, processor: QueryProcessor):
        self.tracker = tracker
        self.processor = processor
        self._subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)

    def subscribe(self, brand: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers[brand.lower()].append(q)
        return q

    def unsubscribe(self, brand: str, q: asyncio.Queue) -> None:
        try:
            self._subscribers[brand.lower()].remove(q)
        except ValueError:
            pass

    async def ingest(self, query_text: str, category: str) -> QueryEvent:
        event = QueryEvent(
            query_id=f"q_{int(time.time() * 1000)}",
            query_text=query_text,
            category=category,
        )

        event = await self.processor.process(event)
        self.tracker.record(event)

        iso_time = datetime.now(timezone.utc).isoformat()

        for brand in event.brands_mentioned:
            # Push into ResponseStore — makes it extractable externally
            response_store.push(brand, ResponseEntry(
                query_id=event.query_id,
                query_text=event.query_text,
                category=event.category,
                raw_ai_response=event.raw_ai_response,
                brands_mentioned=event.brands_mentioned,
                attributes_mentioned=event.attributes_mentioned,
                iso_time=iso_time,
            ))

            snapshot = self.tracker.snapshot(brand, category)
            payload = {
                "event": asdict(event),
                "snapshot": asdict(snapshot),
                "iso_time": iso_time,
            }
            for q in self._subscribers.get(brand, []):
                await q.put(payload)

        return event

    async def stream(self, brand: str) -> AsyncGenerator[dict, None]:
        q = self.subscribe(brand)
        try:
            while True:
                payload = await q.get()
                yield {"data": json.dumps(payload)}
        except asyncio.CancelledError:
            pass
        finally:
            self.unsubscribe(brand, q)


# ---------------------------------------------------------------------------
# 6. FASTAPI APP
# ---------------------------------------------------------------------------

app = FastAPI(title="Share of Voice Stream API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

tracker = SOVTracker(window_seconds=3600)
processor = QueryProcessor()
feed = FeedStream(tracker=tracker, processor=processor)


@app.post("/query")
async def ingest_query(query_text: str, category: str = "general"):
    """Consumer-side endpoint — submit a shopping query."""
    event = await feed.ingest(query_text, category)
    return {
        "query_id": event.query_id,
        "raw_ai_response": event.raw_ai_response,
        "brands_detected": event.brands_mentioned,
        "attributes_detected": event.attributes_mentioned,
    }


@app.get("/stream/{brand}")
async def stream_brand(brand: str):
    """Company-facing SSE stream — live events for a brand."""
    return EventSourceResponse(feed.stream(brand.lower()))


@app.get("/snapshot/{brand}")
async def get_snapshot(brand: str, category: str = Query(default="general")):
    """On-demand SOV snapshot for initial page load."""
    snap = tracker.snapshot(brand.lower(), category)
    return JSONResponse(content=asdict(snap))


@app.get("/responses/{brand}")
async def get_responses(brand: str, limit: int = Query(default=50)):
    """
    Response extraction endpoint — Option B for external scripts.

    Returns the last N raw AI responses for queries where this brand
    was mentioned. Newest first.

    Another script consumes it like:
      import httpx
      entries = httpx.get("http://localhost:8000/responses/allbirds?limit=20").json()
      for e in entries:
          print(e["raw_ai_response"])
    """
    entries = response_store.get(brand.lower(), limit=limit)
    return JSONResponse(content=[asdict(e) for e in entries])


# ---------------------------------------------------------------------------
# 7. ENTRY POINT
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("share_of_voice:app", host="0.0.0.0", port=8000, reload=True)
