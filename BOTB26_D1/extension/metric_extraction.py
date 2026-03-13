"""
metric_extraction.py
--------------------
Reads ChatGPT prompt/response pairs from a CSV exported by the browser
extension and computes the 4 AI Visibility KPIs for each response.

EXPECTED CSV COLUMNS (in order)
────────────────────────────────
type             | "prompt" or "response"
service          | e.g. "OpenAI"
prompt_response  | the prompt text OR the ChatGPT response text
timestamp        | e.g. 2024-03-01T10:00:05Z
url_link         | the ChatGPT conversation URL

HOW ROWS ARE PAIRED
────────────────────
Each "response" row is automatically paired with the "prompt" row
directly above it. The prompt text becomes the "query" in the output.

BRAND CONFIGURATION  (edit the dict below)
───────────────────────────────────────────
Since the CSV doesn't contain brand/competitor info, define those here.
The extractor scans every response for any listed brand.

OUTPUT
──────
- Console summary per response
- metrics_output.csv  with one row per response
"""

import re
import sys
import csv
import pandas as pd
from dataclasses import dataclass, field


# ── Brand configuration ───────────────────────────────────────────────────────
# Add every brand you want to track and its competitors.
# A response will be evaluated once per brand found in the text.

BRANDS: dict[str, list[str]] = {
    "Nike":   ["Adidas", "Puma", "New Balance"],
    "Adidas": ["Nike", "Puma", "New Balance"],
    "Apple":  ["Samsung", "Google", "Microsoft"],
    # add more brands here as needed
}

# Prior position history per brand (last N first_position_pct values).
# Update these after each run to improve Ranking Stability accuracy.
PRIOR_POSITIONS: dict[str, list[float]] = {
    "Nike":   [12.0, 8.5, 10.0],
    "Adidas": [5.0, 6.0],
}


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class ExtractionInput:
    brand: str
    query: str
    response_text: str
    service: str
    timestamp: str
    url_link: str
    competitors: list[str] = field(default_factory=list)
    prior_positions: list[float] = field(default_factory=list)


@dataclass
class MetricResult:
    brand: str
    query: str
    service: str
    timestamp: str
    url_link: str
    citation_count: int
    first_position_pct: float | None
    first_sentence_index: int | None
    entity_coverage_score: int
    coverage_breakdown: str
    impression_share_pct: float
    competitor_shares: str
    ranking_stability_score: int


# ── Core metric logic ─────────────────────────────────────────────────────────

def extract_metrics(inp: ExtractionInput) -> MetricResult:
    text        = inp.response_text
    brand_lower = inp.brand.lower()
    words       = text.lower().split()
    sentences   = re.split(r'(?<=[.!?])\s+', text.strip())

    # KPI 1 — Citation Frequency & Position
    mention_indices = [i for i, w in enumerate(words) if brand_lower in w]
    citation_count  = len(mention_indices)

    first_position_pct = (
        round(mention_indices[0] / max(len(words) - 1, 1) * 100, 1)
        if mention_indices else None
    )
    first_sentence_index = None
    for i, s in enumerate(sentences):
        if brand_lower in s.lower():
            first_sentence_index = i + 1
            break

    # KPI 2 — Entity Coverage
    # 30-word window around brand mentions keeps signals tied to the brand
    if mention_indices:
        w_start = max(0, mention_indices[0] - 30)
        w_end   = min(len(words), mention_indices[-1] + 30)
        context = " ".join(words[w_start:w_end])
    else:
        context = text.lower()

    signals = {
        "product":    bool(re.search(r'\b(product|item|model|version|collection|line)\b',       context, re.I)),
        "pricing":    bool(re.search(r'\b(price|cost|affordable|cheap|expensive|value|\$)\b',   context, re.I)),
        "features":   bool(re.search(r'\b(feature|quality|performance|design|spec|material)\b', context, re.I)),
        "sentiment":  bool(re.search(r'\b(review|rating|recommend|popular|best|top|trusted)\b', context, re.I)),
        "comparison": bool(re.search(r'\b(vs|versus|compared|alternative|competitor|unlike)\b', context, re.I)),
    }
    entity_coverage_score = round(sum(signals.values()) / len(signals) * 100)
    coverage_breakdown    = " | ".join(f"{'✓' if v else '✗'} {k}" for k, v in signals.items())

    # KPI 3 — Impression Share
    all_brands   = [brand_lower] + [c.lower() for c in inp.competitors]
    brand_counts = {b: len([w for w in words if b in w]) for b in all_brands}
    total        = sum(brand_counts.values()) or 1

    impression_share_pct = round(brand_counts[brand_lower] / total * 100, 1)
    comp_shares          = {c: round(brand_counts[c.lower()] / total * 100, 1) for c in inp.competitors}
    competitor_shares    = " | ".join(f"{c}: {s}%" for c, s in comp_shares.items()) or "—"

    # KPI 4 — Ranking Stability
    all_pos = inp.prior_positions.copy()
    if first_position_pct is not None:
        all_pos.append(first_position_pct)

    if len(all_pos) >= 2:
        avg      = sum(all_pos) / len(all_pos)
        variance = sum((p - avg) ** 2 for p in all_pos) / len(all_pos)
        ranking_stability_score = max(0, min(100, round(100 - variance)))
    elif first_position_pct is not None:
        ranking_stability_score = 100
    else:
        ranking_stability_score = 0

    return MetricResult(
        brand                   = inp.brand,
        query                   = inp.query,
        service                 = inp.service,
        timestamp               = inp.timestamp,
        url_link                = inp.url_link,
        citation_count          = citation_count,
        first_position_pct      = first_position_pct,
        first_sentence_index    = first_sentence_index,
        entity_coverage_score   = entity_coverage_score,
        coverage_breakdown      = coverage_breakdown,
        impression_share_pct    = impression_share_pct,
        competitor_shares       = competitor_shares,
        ranking_stability_score = ranking_stability_score,
    )


# ── CSV reader ────────────────────────────────────────────────────────────────

def load_from_csv(path: str) -> list[ExtractionInput]:
    df = pd.read_csv(path, dtype=str)
    df.columns = df.columns.str.lower().str.strip()

    required = {"type", "service", "text", "timestamp", "url"}
    missing  = required - set(df.columns)
    if missing:
        raise ValueError(f"CSV is missing required columns: {missing}")

    df = df.fillna("")

    inputs      = []
    last_prompt = ""

    for _, row in df.iterrows():
        row_type = str(row["type"]).strip().lower()
        text     = str(row["prompt_response"]).strip()

        if row_type == "prompt":
            last_prompt = text      # store so the next response row can use it
            continue

        if row_type != "response" or not text:
            continue

        # Emit one ExtractionInput per brand found in this response
        found_any = False
        for brand, competitors in BRANDS.items():
            if brand.lower() in text.lower():
                found_any = True
                inputs.append(ExtractionInput(
                    brand           = brand,
                    query           = last_prompt,
                    response_text   = text,
                    service         = str(row["service"]).strip(),
                    timestamp       = str(row["timestamp"]).strip(),
                    url_link        = str(row["url"]).strip(),
                    competitors     = competitors,
                    prior_positions = PRIOR_POSITIONS.get(brand, []),
                ))

        # Response contained no configured brand — still log it
        if not found_any:
            inputs.append(ExtractionInput(
                brand         = "Unknown",
                query         = last_prompt,
                response_text = text,
                service       = str(row["service"]).strip(),
                timestamp     = str(row["timestamp"]).strip(),
                url_link      = str(row["url"]).strip(),
            ))

    return inputs


# ── CSV writer ────────────────────────────────────────────────────────────────

OUTPUT_HEADERS = [
    "brand", "query", "service", "timestamp", "url",
    "citation_count", "first_position_pct", "first_sentence_index",
    "entity_coverage_score", "coverage_breakdown",
    "impression_share_pct", "competitor_shares",
    "ranking_stability_score",
]

def save_results_to_csv(results: list[MetricResult], out_path: str):
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_HEADERS)
        writer.writeheader()
        for res in results:
            writer.writerow({
                "brand":                   res.brand,
                "query":                   res.query,
                "service":                 res.service,
                "timestamp":               res.timestamp,
                "url":                res.url_link,
                "citation_count":          res.citation_count,
                "first_position_pct":      res.first_position_pct,
                "first_sentence_index":    res.first_sentence_index,
                "entity_coverage_score":   res.entity_coverage_score,
                "coverage_breakdown":      res.coverage_breakdown,
                "impression_share_pct":    res.impression_share_pct,
                "competitor_shares":       res.competitor_shares,
                "ranking_stability_score": res.ranking_stability_score,
            })
    print(f"\n✓ Results saved to {out_path}  ({len(results)} row(s))")


# ── Main ──────────────────────────────────────────────────────────────────────

def main(input_path: str = "responses_input.csv", output_path: str = "metrics_output.csv"):
    print(f"Reading from: {input_path}\n")
    inputs  = load_from_csv(input_path)
    results = [extract_metrics(inp) for inp in inputs]

    for res in results:
        print(f"── {res.brand} | \"{res.query}\"  [{res.timestamp}]")
        print(f"   Citation Frequency : {res.citation_count} mention(s)")
        print(f"   First Position     : {res.first_position_pct}% through response (sentence #{res.first_sentence_index})")
        print(f"   Entity Coverage    : {res.entity_coverage_score}/100  →  {res.coverage_breakdown}")
        print(f"   Impression Share   : {res.impression_share_pct}%  |  Competitors: {res.competitor_shares}")
        print(f"   Ranking Stability  : {res.ranking_stability_score}/100\n")

    save_results_to_csv(results, output_path)


if __name__ == "__main__":
    inp = sys.argv[1] if len(sys.argv) > 1 else "responses_input.csv"
    out = sys.argv[2] if len(sys.argv) > 2 else "metrics_output.csv"
    main(inp, out)