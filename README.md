# TU2026_BOTB

This repository contains the Tuskegee University 2026 Battle of the Brains project — a Chrome extension (PromptVault) that captures shopping-related prompts and responses from AI chat services, backed by a Python scraper and FastAPI server.

## Project Structure

```
├── extension/
│   ├── manifest.json         # Chrome Manifest V3 config
│   ├── content_script.js     # Monitors AI chats, filters for shopping intent
│   ├── background.js         # Service worker — stores captured entries
│   ├── popup.html            # Extension popup UI
│   └── popup.js              # Popup logic (stats, filters, export, modal)
└── backend/
    ├── server.py             # FastAPI server with /scrape endpoint
    ├── scraper.py            # Product scraper (JSON, HTML, generic fallback)
    ├── keywords.txt          # Product keyword filters
    └── requirements.txt      # Python dependencies
```

## Quick Start

### Extension
1. Open Chrome → `chrome://extensions` → toggle **Developer mode**
2. Click **Load unpacked** → select the `extension/` folder
3. Open ChatGPT, Claude, or Perplexity and ask a shopping question
4. Click the extension icon to see captured entries

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```

## How It Works

The content script monitors AI chat conversations and checks each user prompt for shopping intent using keyword matching and phrase pattern detection. Only prompts that score 2+ on the shopping intent scale (and their corresponding AI responses) get saved. Non-shopping conversations are ignored.

The backend server exposes a `/scrape` endpoint that accepts a product URL, scrapes it with the Python scraper, and returns structured product data. The scraper handles JSON APIs, HTML product pages, and has generic fallbacks.
