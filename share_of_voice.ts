/**
 * Share of Voice (SOV) Stream System
 * =====================================
 * Tracks how often a brand appears in AI-generated shopping query responses
 * in real time. Designed for the company-facing analytics platform.
 *
 * Components:
 *   1. QueryProcessor   - tags brands and attributes from AI responses
 *   2. ResponseStore    - stores raw AI responses per brand, extractable externally
 *   3. SOVTracker       - maintains rolling SOV calculations
 *   4. FeedStream       - emits live feed events as queries come in
 *   5. Hono app         - HTTP server wiring everything together
 *
 * Run:
 *   npm install hono openai @hono/node-server
 *   npx ts-node src/share_of_voice.ts
 *
 * OpenAI:
 *   Set OPENAI_API_KEY in your environment.
 *   Swap MODEL to any OpenAI model string.
 *
 * Extracting responses to another script:
 *   Option A — HTTP: GET /responses/:brand returns the last N raw AI responses
 *              for that brand as a JSON array. Any script can poll or fetch this.
 *   Option B — Import: if running in the same Node process, import { responseStore }
 *              and call responseStore.get("allbirds") directly.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { serve } from "@hono/node-server";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "sk-placeholder";
const MODEL = "gpt-4o-mini";

// ---------------------------------------------------------------------------
// 1. DATA MODELS
// ---------------------------------------------------------------------------

interface QueryEvent {
  queryId: string;
  queryText: string;
  category: string;
  timestamp: number;
  brandsMentioned: string[];
  attributesMentioned: string[];
  rawAiResponse: string;
}

interface SOVSnapshot {
  brand: string;
  category: string;
  appearances: number;
  totalQueries: number;
  sovPct: number;
  deltaVsLastWindow: number;
  topTriggerAttribute: string;
  timestamp: number;
}

interface FeedPayload {
  event: QueryEvent;
  snapshot: SOVSnapshot;
  isoTime: string;
}

// Shape of a stored response entry — what gets exported to other scripts
export interface ResponseEntry {
  queryId: string;
  queryText: string;
  category: string;
  rawAiResponse: string;
  brandsMentioned: string[];
  attributesMentioned: string[];
  isoTime: string;
}

// ---------------------------------------------------------------------------
// 2. RESPONSE STORE  ← the extractable piece
// ---------------------------------------------------------------------------

/**
 * ResponseStore holds the last MAX_PER_BRAND responses per brand.
 *
 * Two ways another script can consume this:
 *
 *   Option A — same Node process (import):
 *     import { responseStore } from "./share_of_voice";
 *     const entries = responseStore.get("allbirds");
 *
 *   Option B — separate process (HTTP):
 *     fetch("http://localhost:8000/responses/allbirds?limit=20")
 *       .then(r => r.json())
 *       .then(entries => { ... });
 */
export class ResponseStore {
  private MAX_PER_BRAND = 200;
  private store: Map<string, ResponseEntry[]> = new Map();

  push(brand: string, entry: ResponseEntry): void {
    const key = brand.toLowerCase();
    if (!this.store.has(key)) this.store.set(key, []);
    const list = this.store.get(key)!;
    list.unshift(entry); // newest first
    if (list.length > this.MAX_PER_BRAND) list.pop();
  }

  /**
   * Get the last N responses for a brand.
   * Default limit is 50. Pass Infinity to get all stored.
   */
  get(brand: string, limit = 50): ResponseEntry[] {
    return (this.store.get(brand.toLowerCase()) ?? []).slice(0, limit);
  }

  /** All brands currently tracked in the store */
  brands(): string[] {
    return [...this.store.keys()];
  }
}

export const responseStore = new ResponseStore();

// ---------------------------------------------------------------------------
// 3. QUERY PROCESSOR
// ---------------------------------------------------------------------------

class QueryProcessor {
  private client: OpenAI;

  private readonly SYSTEM_PROMPT = `
    You are a shopping assistant. Answer the user's question with a helpful
    product recommendation. Keep your response concise (2-3 sentences).
  `;

  private readonly TAG_PROMPT = `
    Given this AI shopping response, extract:
    1. Every brand name mentioned (proper nouns only)
    2. Every product attribute emphasized (e.g. 'sustainable', 'wide fit', 'under $150')

    Response to analyze:
    {response}

    Reply ONLY with valid JSON in this exact shape, nothing else:
    {"brands": ["Brand1", "Brand2"], "attributes": ["attr1", "attr2"]}
  `;

  constructor() {
    this.client = new OpenAI({ apiKey: OPENAI_API_KEY });
  }

  /**
   * Step 1: get the AI's shopping recommendation for the query.
   * Step 2: tag every brand and attribute the AI mentioned.
   * Returns the same event object, mutated in place.
   */
  async process(event: QueryEvent): Promise<QueryEvent> {
    // Step 1 — get the recommendation
    const recResponse = await this.client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: this.SYSTEM_PROMPT },
        { role: "user", content: event.queryText },
      ],
      max_tokens: 200,
    });
    event.rawAiResponse = recResponse.choices[0].message.content?.trim() ?? "";

    // Step 2 — extract brands and attributes from that response
    const tagResponse = await this.client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "user",
          content: this.TAG_PROMPT.replace("{response}", event.rawAiResponse),
        },
      ],
      max_tokens: 200,
    });

    let rawJson = tagResponse.choices[0].message.content?.trim() ?? "{}";

    // Strip markdown fences if the model added them anyway
    rawJson = rawJson.replace(/```(?:json)?|```/g, "").trim();

    try {
      const tags = JSON.parse(rawJson) as {
        brands?: string[];
        attributes?: string[];
      };
      event.brandsMentioned = (tags.brands ?? []).map((b) => b.toLowerCase());
      event.attributesMentioned = tags.attributes ?? [];
    } catch {
      event.brandsMentioned = [];
      event.attributesMentioned = [];
    }

    return event;
  }
}

// ---------------------------------------------------------------------------
// 4. SOV TRACKER
// ---------------------------------------------------------------------------

class SOVTracker {
  private windowSeconds: number;

  private appearances: Map<string, number[]> = new Map();
  private allQueries: number[] = [];
  private attributeCounts: Map<string, Map<string, number>> = new Map();
  private prevWindowSov: Map<string, number> = new Map();

  constructor(windowSeconds = 3600) {
    this.windowSeconds = windowSeconds;
  }

  record(event: QueryEvent): void {
    const now = event.timestamp;
    this.allQueries.push(now);
    this.evict(now);

    for (const brand of event.brandsMentioned) {
      if (!this.appearances.has(brand)) this.appearances.set(brand, []);
      this.appearances.get(brand)!.push(now);

      if (!this.attributeCounts.has(brand)) {
        this.attributeCounts.set(brand, new Map());
      }
      const attrMap = this.attributeCounts.get(brand)!;
      for (const attr of event.attributesMentioned) {
        attrMap.set(attr, (attrMap.get(attr) ?? 0) + 1);
      }
    }
  }

  snapshot(brand: string, category: string): SOVSnapshot {
    const now = Date.now() / 1000;
    this.evict(now);

    const appearances = this.appearances.get(brand)?.length ?? 0;
    const total = this.allQueries.length;
    const sovPct = total > 0 ? Math.round((appearances / total) * 1000) / 10 : 0;

    const prev = this.prevWindowSov.get(brand) ?? sovPct;
    const delta = Math.round((sovPct - prev) * 10) / 10;

    const attrMap = this.attributeCounts.get(brand);
    let topAttr = "—";
    if (attrMap && attrMap.size > 0) {
      topAttr = [...attrMap.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }

    return {
      brand,
      category,
      appearances,
      totalQueries: total,
      sovPct,
      deltaVsLastWindow: delta,
      topTriggerAttribute: topAttr,
      timestamp: now,
    };
  }

  updatePrevWindow(brand: string): void {
    const snap = this.snapshot(brand, "");
    this.prevWindowSov.set(brand, snap.sovPct);
  }

  private evict(now: number): void {
    const cutoff = now - this.windowSeconds;

    let i = 0;
    while (i < this.allQueries.length && this.allQueries[i] < cutoff) i++;
    if (i > 0) this.allQueries.splice(0, i);

    for (const [, timestamps] of this.appearances) {
      let j = 0;
      while (j < timestamps.length && timestamps[j] < cutoff) j++;
      if (j > 0) timestamps.splice(0, j);
    }
  }
}

// ---------------------------------------------------------------------------
// 5. FEED STREAM
// ---------------------------------------------------------------------------

class FeedStream {
  private tracker: SOVTracker;
  private processor: QueryProcessor;
  private subscribers: Map<string, Array<(payload: FeedPayload) => void>> =
    new Map();

  constructor(tracker: SOVTracker, processor: QueryProcessor) {
    this.tracker = tracker;
    this.processor = processor;
  }

  subscribe(brand: string, cb: (payload: FeedPayload) => void): () => void {
    const key = brand.toLowerCase();
    if (!this.subscribers.has(key)) this.subscribers.set(key, []);
    this.subscribers.get(key)!.push(cb);
    return () => {
      const list = this.subscribers.get(key) ?? [];
      const idx = list.indexOf(cb);
      if (idx !== -1) list.splice(idx, 1);
    };
  }

  async ingest(queryText: string, category: string): Promise<QueryEvent> {
    const event: QueryEvent = {
      queryId: `q_${Date.now()}`,
      queryText,
      category,
      timestamp: Date.now() / 1000,
      brandsMentioned: [],
      attributesMentioned: [],
      rawAiResponse: "",
    };

    const processed = await this.processor.process(event);
    this.tracker.record(processed);

    const isoTime = new Date().toISOString();

    for (const brand of processed.brandsMentioned) {
      // Push into ResponseStore — this is what makes it extractable
      responseStore.push(brand, {
        queryId: processed.queryId,
        queryText: processed.queryText,
        category: processed.category,
        rawAiResponse: processed.rawAiResponse,
        brandsMentioned: processed.brandsMentioned,
        attributesMentioned: processed.attributesMentioned,
        isoTime,
      });

      const snapshot = this.tracker.snapshot(brand, category);
      const payload: FeedPayload = { event: processed, snapshot, isoTime };
      for (const cb of this.subscribers.get(brand) ?? []) {
        cb(payload);
      }
    }

    return processed;
  }
}

// ---------------------------------------------------------------------------
// 6. HONO APP
// ---------------------------------------------------------------------------

const app = new Hono();
app.use("*", cors());

const tracker = new SOVTracker(3600);
const processor = new QueryProcessor();
const feed = new FeedStream(tracker, processor);

/** Consumer-side: submit a shopping query */
app.post("/query", async (c) => {
  const { query_text, category = "general" } = await c.req.json<{
    query_text: string;
    category?: string;
  }>();

  const event = await feed.ingest(query_text, category);

  return c.json({
    queryId: event.queryId,
    rawAiResponse: event.rawAiResponse,
    brandsDetected: event.brandsMentioned,
    attributesDetected: event.attributesMentioned,
  });
});

/** Company-facing SSE stream — live events for a brand */
app.get("/stream/:brand", (c) => {
  const brand = c.req.param("brand").toLowerCase();

  return streamSSE(c, async (stream) => {
    const unsub = feed.subscribe(brand, async (payload) => {
      await stream.writeSSE({ data: JSON.stringify(payload) });
    });

    await new Promise<void>((resolve) => {
      c.req.raw.signal.addEventListener("abort", () => {
        unsub();
        resolve();
      });
    });
  });
});

/** On-demand SOV snapshot for initial page load */
app.get("/snapshot/:brand", (c) => {
  const brand = c.req.param("brand").toLowerCase();
  const category = c.req.query("category") ?? "general";
  return c.json(tracker.snapshot(brand, category));
});

/**
 * Response extraction endpoint — Option A for external scripts.
 *
 * GET /responses/:brand?limit=50
 *
 * Returns a JSON array of ResponseEntry objects — the raw AI responses
 * generated for queries where this brand was mentioned.
 *
 * Another script consumes it like:
 *   const res = await fetch("http://localhost:8000/responses/allbirds?limit=20");
 *   const entries = await res.json();
 *   entries.forEach(e => console.log(e.rawAiResponse));
 */
app.get("/responses/:brand", (c) => {
  const brand = c.req.param("brand").toLowerCase();
  const limit = parseInt(c.req.query("limit") ?? "50", 10);
  return c.json(responseStore.get(brand, limit));
});

// ---------------------------------------------------------------------------
// 7. ENTRY POINT
// ---------------------------------------------------------------------------

serve({ fetch: app.fetch, port: 8000 }, () => {
  console.log("SOV stream server running on http://localhost:8000");
});
