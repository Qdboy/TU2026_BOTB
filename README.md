Notice: Due to the size of the Shop.py file(s) we were unable to upload it to GitHub and experienced difficulties sharing through Google Drive.
As of writing this the Google Drive error has been resolved and so Shop.py.zip can be fetched from Tuskegee University's team drive. Our presentation shows a demonstration of Shop.py's capabilities and if you'd like to see how it works for yourself it's been shared with Kevin@hbcubattleofthebrains and Info@hbcubattleofthebrains


# Shop.py

Shop.py is a full-stack web application used to collect, analyze and display data falling through the gaps of AI-prompt shopping. It demonstrates a B2B SaaS platform for **Generative Engine Optimization (GEO) analytics**, helping brands understand how visible their products are inside AI-generated shopping and recommendation results.

We, with **Shop.py**, help companies understand and improve how their products appear in AI-powered shopping results through a Generative Engine Optimization (GEO) analytics platform that audits brand visibility and provides AI optimization recommendations. Our insights are powered by a free consumer browser extension, **ShopSmart** that enhances AI shopping with coupon codes and aggregated product reviews—including popular video content from platforms like TikTok and Instagram—while capturing real-world AI shopping behavior.

Together, Shop.py and ShopSmart demonstrate a data ecosystem for understanding and optimizing **AI-driven product discovery**.

---

# What the Application Does

Shop.py is positioned as an analytics platform for brands such as The Home Depot. Its goal is to help companies understand how their products perform in AI-driven commerce environments.

The platform enables companies to:

- Track product and brand visibility in AI shopping environments
- Monitor GEO metrics such as citation frequency, ranking position, and share of voice
- Analyze competitive comparisons and recommendation signals
- Manage tracked brand entities through a dashboard interface
- Reset demo data to allow repeatable product demonstrations

The application includes the following core components:

### Public Landing Page
Introduces the Shop.py platform and communicates the product concept.

### Authentication
A login page with demo credentials allows judges to access the platform quickly.

### Dashboard
The dashboard displays GEO analytics such as:

- visibility metrics
- performance charts
- AI recommendation signals
- simulated analytics data

### Settings
The settings panel exposes feature flags and allows the demo dataset to be reset between judging sessions.

---

# ShopSmart Browser Extension

ShopSmart is a Chrome browser extension that enhances AI shopping sessions while collecting insights that power Shop.py’s analytics platform.

The extension detects when users ask shopping-related questions in AI assistants and captures prompt and response pairs. These interactions can then be analyzed to understand how products appear in AI recommendations.

### Core capabilities

- Detects shopping-related prompts in AI chat platforms
- Enhances UI/UX to make shopping more accessible
- Captures prompt and response pairs from AI conversations
- Extracts potential product mentions and pricing signals
- Stores interactions locally for analysis

The extension also demonstrates how real-world consumer interactions could generate data used by the Shop.py analytics platform.

---

# Technologies and Frameworks Used

## Frontend

- React 18
- Vite 5
- TypeScript
- Tailwind CSS
- React Router
- TanStack Query
- Chart.js and react-chartjs-2
- lucide-react icons

## Backend

- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT authentication
- bcryptjs
- Zod schema validation

## Browser Extension

- JavaScript (ES6)
- HTML
- CSS
- Chrome Extension Manifest V3
- Chrome runtime and storage APIs

## Development Tooling

- pnpm workspaces
- Docker Compose
- concurrently
- Prettier
- ESLint

---

# How Judges Should Navigate the Application

## ShopSmart

### Instructions

1. **Install dependencies**

`pnpm install`

2. Start the development environment

From the root directory run:

`pnpm dev`

This command starts both the API backend and the web frontend simultaneously.

3. Access the application
Once the servers start, open your browser and navigate to the local web server URL displayed in the terminal (typically something like 'http://localhost:5173').

4. Build the application (optional)

To generate production builds for all packages:

`pnpm build`

### What Success Looks Like

✅ Success is achieved when the development servers start without errors and the web application loads in the browser. The frontend should successfully communicate with the backend API, allowing the application interface to render and function as intended.

---

## Shop.py

### Installation
 
1. Unzip `ShopSmart_v1_5.zip` — you should see a `ShopSmart_v1.3` folder
2. Open `chrome://extensions`
3. Toggle on **Developer mode** (top-right)
4. Click **Load unpacked** → select the `ShopSmart_v1.3` folder
5. Click the puzzle piece icon in the toolbar and pin **ShopSmart**
 
✅ The extension icon should now appear in your toolbar.
 
### Usage
 
1. Go to ChatGPT
2. Ask a shopping-related question
3. Product cards will auto-generate inside the AI response
4. Click the ShopSmart icon to view captured entries
5. Use **Export Raw** or **Export Analyzed** to download CSV
6. Use **Clear** to delete all stored data
 
✅ Entries appear in the dashboard as prompts and responses are detected.
