# ShopSmart

## Overview
ShopSmart is a Chrome browser extension that captures and analyzes shopping-related prompts and responses from AI chat platforms such as ChatGPT, Claude, and Perplexity.

The extension monitors AI conversations and detects when users ask for product recommendations. When a relevant interaction occurs, ShopSmart captures the prompt and response, stores the interaction locally, and allows the user to review the information through the extension popup.

(Add additional context here if you want to describe the motivation behind the project or the problem the application solves.)

---

## What the Application Does

ShopSmart performs the following functions:

- Detects shopping-related prompts on supported AI chat platforms
- Captures prompt and response pairs from AI conversations
- Stores captured interactions locally using Chrome storage
- Analyzes responses to identify possible product recommendations and price information
- Displays stored entries through the extension popup interface

Additional capabilities or behaviors can be described here:

-
-
-

---

## Technologies and Frameworks Used

This project is built using browser-native technologies and Chrome Extension APIs.

Core technologies used:

- JavaScript (ES6)
- HTML
- CSS
- Chrome Extension Manifest V3

Chrome APIs used:

- `chrome.runtime`
- `chrome.storage.local`
- Content Scripts
- Background Service Worker

(If any additional tools, frameworks, or libraries were used, describe them here.)

---

## Project Structure
ShopSmart/
│
├── manifest.json
├── background.js
├── content_script.js
├── analyzer.js
├── shop_ui.css
│
├── popup.html
├── popup.js
│
└── run.sh


File descriptions:

**manifest.json**  
Defines the extension configuration, permissions, and entry points.

**background.js**  
Runs as the background service worker and handles messaging, storage operations, and background tasks.

**content_script.js**  
Injected into supported AI chat websites. Responsible for detecting prompts and responses and capturing relevant interactions.

**analyzer.js**  
Processes captured responses and attempts to extract useful information such as product names and prices.

**shop_ui.css**  
Provides styling for UI elements injected into supported websites.

**popup.html / popup.js**  
Implements the popup interface displayed when the extension icon is clicked. This interface allows users to view stored entries.

---

## How Judges Should Navigate the Application

To evaluate the extension:

1. Load the extension into Google Chrome (instructions below).
2. Visit a supported AI chat platform such as:
   - ChatGPT
   - Claude
   - Perplexity
3. Ask a shopping-related question, for example:
   - "What are the best laptops under $500?"
   - "Best running shoes under $100"
   - "Top noise cancelling headphones"
4. The extension will detect and capture the interaction.
5. Click the ShopSmart extension icon in the Chrome toolbar.
6. The popup interface will display captured entries and extracted information.

(You can add additional instructions here if there are specific features judges should test.)

---

## How to Run the Application

## Supported Sites

ShopSmart currently runs on the following AI chat platforms:

- ChatGPT

The extension monitors these pages for shopping-related prompts and responses. 
Support for additional platforms could be added in the future.

### Method 1: Load the Extension Manually

1. Open Google Chrome.
2. Navigate to:
chrome://extensions
3. Enable **Developer Mode** in the top-right corner.
4. Click **Load Unpacked**.
5. Select the root folder of this project.

The extension should now appear in the Chrome toolbar.

---

### Method 2: Use the Provided Script

A helper script is included to document the steps required to run the project.

Run the script:
./run.sh

Note: Because this project is a browser extension, the script prints instructions rather than launching the application directly.

---

## Verifying Successful Startup

The application is running successfully if:

- The ShopSmart icon appears in the Chrome extensions toolbar
- AI chat pages load normally without errors
- Shopping-related prompts are detected
- Captured entries appear in the extension popup

---

## Limitations and Future Work

Current limitations of the project include:

- Product extraction relies on pattern matching and may not capture every recommendation format.
- The extension currently stores data locally in the browser rather than using a remote database.
- Only a limited number of AI chat platforms are supported.

Possible future improvements include:

- Improved product extraction using more advanced parsing or AI methods
- Support for additional AI chat platforms
- Export or sharing features for captured recommendations
- Optional price comparison integrations

---

## Notes for Evaluation

(Add any additional notes that may help judges understand your
