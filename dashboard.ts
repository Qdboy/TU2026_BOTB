import * as fs from "fs";
import * as path from "path";
import * as http from "http";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface KPI        { label: string; value: string; sub: string; trend: "up"|"down"|"neutral"; accent: string; }
interface Platform   { name: string; mentions: number; color: string; ctr: string; rank: string; }
interface ConvPage   { name: string; rate: number; color: string; }
interface Competitor { rank: number; name: string; pct: number; avgRank: string; color: string; }

interface DashboardData {
  // Slide 2 — Business Overview
  kpis: KPI[];
  days: string[];
  revenueTrend: number[];
  weekLabels: string[];
  roasByWeek: number[];
  cpaByWeek: number[];
  // Slide 3 — AI Visibility
  visibilityMetrics: KPI[];
  topLinks: { name: string; clicks: number }[];
  promptTriggers: { label: string; mentions: number; clicks: number }[];
  conversionPages: ConvPage[];
  // Slide 4 — Competitor / AI Source Breakdown
  platforms: Platform[];
  competitors: Competitor[];
  trendWeeks: string[];
  trendGPT: number[];
  trendGemini: number[];
  trendClaude: number[];
  generatedAt: string;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const rnd  = (a: number, b: number) => Math.round(a + Math.random() * (b - a));
const rndF = (a: number, b: number, d = 1) => parseFloat((a + Math.random() * (b - a)).toFixed(d));
const pct  = (v: number, r: number) => { const d = Math.round(((v - r) / r) * 100); return (d >= 0 ? "+" : "") + d + "% vs prev"; };

// ─────────────────────────────────────────────────────────────
// DATA GENERATION  (swap these out for real API calls)
// ─────────────────────────────────────────────────────────────

function generateData(): DashboardData {
  const rev = rnd(150_000, 210_000), prevRev = rnd(130_000, 180_000);
  const conv = rnd(1_000, 1_500),    prevConv = rnd(900, 1_300);
  const cpa = rnd(18, 32), roas = rndF(3.5, 5.5), spend = rnd(35_000, 55_000);

  const days   = Array.from({ length: 16 }, (_, i) => `D${i * 2 + 1}`);
  const weeks  = ["Wk 1", "Wk 2", "Wk 3", "Wk 4"];
  const tWeeks = Array.from({ length: 12 }, (_, i) => `W${i + 1}`);

  const chatgpt = rnd(4_200, 6_000), gemini = rnd(3_200, 5_000), claude = rnd(2_400, 4_000);
  const impressions = rnd(2_000_000, 2_800_000);
  const reach       = rnd(700_000, 1_000_000);
  const aiMentions  = rnd(10_000, 15_000);
  const linkClicks  = rnd(80_000, 110_000);
  const uniqueC     = rnd(60_000, 85_000);
  const repeatC     = rnd(15_000, 30_000);

  return {
    kpis: [
  { label: "Revenue",             value: `$${rev.toLocaleString()}`,   sub: pct(rev, prevRev),             trend: rev >= prevRev ? "up" : "down",  accent: "#00C9A7" },
  { label: "ROAS",                value: `${roas}×`,                   sub: "Return on ad spend",          trend: "neutral",                       accent: "#4F8EF7" },
  { label: "Conversions",         value: conv.toLocaleString(),        sub: pct(conv, prevConv),           trend: conv >= prevConv ? "up" : "down", accent: "#F7C94F" },
  { label: "CPA",                 value: `$${cpa}`,                    sub: "Cost per acquisition",        trend: cpa <= 24 ? "up" : "down",       accent: "#9B6DFF" },
  { label: "Ad Spend",            value: `$${spend.toLocaleString()}`, sub: "Total media budget",          trend: "neutral",                       accent: "#F75F5F" },
  { label: "Citation Frequency",  value: `${rndF(3.2, 6.8)}%`,        sub: "Appearances in AI answers",   trend: "up",                            accent: "#4F8EF7" },
  { label: "Citation Position",   value: `${rnd(55, 78)}% primary`,   sub: "First-source citations",      trend: "up",                            accent: "#00C9A7" },
  { label: "Entity Coverage",     value: `${rnd(62, 89)}%`,           sub: "Knowledge Graph recognition", trend: "neutral",                       accent: "#F7C94F" },
  { label: "Branded Search Lift", value: `+${rnd(8, 24)}%`,           sub: "After citation exposure",     trend: "up",                            accent: "#9B6DFF" },
  { label: "Ranking Stability",   value: `${rndF(7.2, 9.4, 1)}/10`,  sub: "E-E-A-T resilience score",    trend: "neutral",                       accent: "#F75F5F" },
  { label: "Impression Share",    value: `${rnd(18, 42)}%`,           sub: "vs total AI query volume",    trend: "up",                            accent: "#00C9A7" },
    ],
    days,
    revenueTrend: days.map((_, i) => rnd(4_000 + i * 200, 5_500 + i * 200)),
    weekLabels: weeks,
    roasByWeek: weeks.map((_, i) => rndF(3.5 + i * 0.3, 4.0 + i * 0.4)),
    cpaByWeek:  weeks.map((_, i) => rnd(28 - i * 2, 30 - i * 2)),

    visibilityMetrics: [
      { label: "Impressions",   value: `${(impressions / 1_000_000).toFixed(1)}M`, sub: "Total views",          trend: "neutral", accent: "#4F8EF7" },
      { label: "Reach",         value: `${(reach / 1000).toFixed(0)}K`,            sub: "Unique users reached", trend: "neutral", accent: "#9B6DFF" },
      { label: "AI Mentions",   value: aiMentions.toLocaleString(),                 sub: "+18% vs prev",         trend: "up",      accent: "#00C9A7" },
      { label: "Link Clicks",   value: linkClicks.toLocaleString(),                 sub: "+11% vs prev",         trend: "up",      accent: "#F7C94F" },
      { label: "Link CTR",      value: `${rndF(3.5, 4.8)}%`,                       sub: "Click-through rate",   trend: "neutral", accent: "#4F8EF7" },
      { label: "Unique Clicks", value: uniqueC.toLocaleString(),                    sub: "First-time visitors",  trend: "neutral", accent: "#00C9A7" },
      { label: "Repeat Clicks", value: repeatC.toLocaleString(),                    sub: "Return visitors",      trend: "neutral", accent: "#F75F5F" },
    ],
    topLinks: [
      { name: "/standing-desks",       clicks: rnd(22_000, 32_000) },
      { name: "/tool-boxes",          clicks: rnd(18_000, 26_000) },
      { name: "/home-office-furniture",  clicks: rnd(11_000, 17_000) },
      { name: "/silver-hammers",  clicks: rnd(7_000, 12_000) },
      { name: "/adjustable-desks",        clicks: rnd(5_000, 9_000) },
    ],
    promptTriggers: [
      { label: '"best standing desk under $500"',    mentions: rnd(1_800, 2_400), clicks: rnd(7_000, 10_000) },
      { label: '"top tool boxes"',       mentions: rnd(1_400, 1_900), clicks: rnd(5_000, 7_500) },
      { label: '"desks for remote work"',            mentions: rnd(1_000, 1_500), clicks: rnd(3_500, 6_000) },
      { label: '"standing desk with drawer"',        mentions: rnd(800, 1_100),   clicks: rnd(2_800, 4_200) },
      { label: '"affordable hammers"',mentions: rnd(600, 900),     clicks: rnd(2_000, 3_500) },
    ],
    conversionPages: [
      { name: "/standing-desk",      rate: rndF(4.0, 7.0), color: "#00C9A7" },
      { name: "/tool-boxes",         rate: rndF(3.5, 6.0), color: "#4F8EF7" },
      { name: "/home-office-furniture", rate: rndF(2.5, 5.0), color: "#F7C94F" },
    ],
    platforms: [
      { name: "ChatGPT", mentions: chatgpt, color: "#74AA9C", ctr: `${rndF(4.8, 5.6)}%`, rank: "#2" },
      { name: "Gemini",  mentions: gemini,  color: "#F7C94F", ctr: `${rndF(4.2, 5.0)}%`, rank: "#3" },
      { name: "Claude",  mentions: claude,  color: "#9B6DFF", ctr: `${rndF(3.6, 4.4)}%`, rank: "#4" },
    ],
    competitors: [
  { rank: 1, name: "Home Depot",   pct: 32, avgRank: "#1", color: "#4F8EF7" },
  { rank: 2, name: "Lowe's",       pct: 25, avgRank: "#2", color: "#00C9A7" },
  { rank: 3, name: "Menards",      pct: 18, avgRank: "#3", color: "#F7C94F" },
  { rank: 4, name: "Ace Hardware", pct: 14, avgRank: "#4", color: "#9B6DFF" },
  { rank: 5, name: "True Value",   pct: 11, avgRank: "#5", color: "#F75F5F" },
],
    trendWeeks: tWeeks,
    trendGPT:    tWeeks.map(() => rndF(4.5, 5.8)),
    trendGemini: tWeeks.map(() => rndF(3.8, 5.2)),
    trendClaude: tWeeks.map(() => rndF(3.2, 4.6)),
    generatedAt: new Date().toLocaleString(),
  };
}

// ─────────────────────────────────────────────────────────────
// PAGE BUILDERS
// ─────────────────────────────────────────────────────────────

function buildCoverPage(): string {
  return `
  <div id="page-cover" class="page">
    <div class="cover-wrap">
      <div class="cover-accent-bar"></div>
      <div class="cover-body">
        <div class="cover-titles">
          <div class="cover-title1">SHOP.PY VISIBILITY</div>
          <div class="cover-title2">DASHBOARD</div>
          <div class="cover-tagline">Real-time AI brand monitoring across AI Platforms</div>
          <div class="cover-badge">LAST 30 DAYS</div>
        </div>
        <div class="cover-bubbles">
        </div>
      </div>
    </div>
  </div>`;
}

function buildBusinessPage(d: DashboardData): string {
  //const kpiCards = d.kpis.map(k => `
    //<div class="kpi" style="--accent:${k.accent}">
      //<div class="kpi-label">${k.label}</div>
      //<div class="kpi-value">${k.value}</div>
      //<div class="kpi-sub ${k.trend === "neutral" ? "" : k.trend}">${k.sub}</div>
    //</div>`).join("");

  const row1 = d.kpis.slice(0, 5).map(k => `
    <div class="kpi" style="--accent:${k.accent}">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-sub ${k.trend === "neutral" ? "" : k.trend}">${k.sub}</div>
    </div>`).join("");

  const row2 = d.kpis.slice(5).map(k => `
    <div class="kpi" style="--accent:${k.accent}">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-sub ${k.trend === "neutral" ? "" : k.trend}">${k.sub}</div>
    </div>`).join("");

  return `
  <div id="page-business" class="page" style="display:none">
    <div class="content">
      <div class="kpi-row">${row1}</div>
      <div class="kpi-row six">${row2}</div>
      <div class="charts-row">
        <div class="panel">
          <div class="panel-title">Revenue trend — daily (30 days)</div>
          <div style="position:relative;height:220px"><canvas id="revChart"></canvas></div>
        </div>
        <div class="panel">
          <div class="panel-title">ROAS &amp; CPA by week</div>
          <div style="position:relative;height:220px"><canvas id="roasChart"></canvas></div>
        </div>
      </div>
    </div>
  </div>`;
}

function buildVisibilityPage(d: DashboardData): string {
  const metricCards = d.visibilityMetrics.map(k => `
    <div class="kpi sm" style="--accent:${k.accent}">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value" style="font-size:18px">${k.value}</div>
      <div class="kpi-sub">${k.sub}</div>
    </div>`).join("");

  const linkColors = ["#4F8EF7", "#00C9A7", "#F7C94F", "#9B6DFF", "#F75F5F"];
  const maxClicks  = Math.max(...d.topLinks.map(l => l.clicks));
  const linkBars   = d.topLinks.map((l, i) => {
    const c = linkColors[i % linkColors.length];
    return `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px">
        <span style="font-size:10px;color:#8899BB">${l.name}</span>
        <span style="font-size:10px;font-weight:500;color:${c}">${l.clicks.toLocaleString()}</span>
      </div>
      <div style="background:#253350;border-radius:3px;height:7px">
        <div style="width:${Math.round(l.clicks / maxClicks * 100)}%;background:${c};height:100%;border-radius:3px"></div>
      </div>
    </div>`;
  }).join("");

  const maxConv = Math.max(...d.conversionPages.map(p => p.rate));
  const convRows = d.conversionPages.map(p => `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px">
        <span style="font-size:10px;color:#8899BB">${p.name}</span>
        <span style="font-size:10px;font-weight:500;color:${p.color}">${p.rate}%</span>
      </div>
      <div style="background:#253350;border-radius:3px;height:7px">
        <div style="width:${Math.round(p.rate / maxConv * 100)}%;background:${p.color};height:100%;border-radius:3px"></div>
      </div>
    </div>`).join("");

  return `
  <div id="page-visibility" class="page" style="display:none">
    <div class="content">
      <div class="kpi-row seven">${metricCards}</div>
      <div class="charts-row">
        <div class="panel">
          <div class="panel-title">Top performing links — link clicks</div>
          ${linkBars}
          <div style="margin-top:18px">
            <div class="panel-title">Conversion rate by page</div>
            ${convRows}
          </div>
        </div>
        <div class="panel">
          <div class="panel-title">AI prompt triggers — link clicks &amp; mentions</div>
          <div style="position:relative;height:340px"><canvas id="promptChart"></canvas></div>
        </div>
      </div>
    </div>
  </div>`;
}

function buildCompetitorPage(d: DashboardData): string {
  const compRows = d.competitors.map(c => `
    <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #1E2D45">
      <div style="width:20px;height:20px;border-radius:50%;background:${c.color};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#0F1623;flex-shrink:0">${c.rank}</div>
      <div style="flex:1;font-size:11px;color:#fff">${c.name}</div>
      <div style="font-size:11px;color:${c.color};font-weight:500;width:38px;text-align:right">${c.pct}%</div>
      <div style="font-size:10px;color:#5A6D8A;width:28px;text-align:right">${c.avgRank}</div>
    </div>`).join("");

  const platCards = d.platforms.map(p => `
    <div style="background:#1A2540;border:1px solid ${p.color};border-radius:7px;padding:12px;margin-bottom:10px;display:flex;align-items:center;gap:10px">
      <div style="width:4px;height:48px;background:${p.color};border-radius:2px;flex-shrink:0"></div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:#fff">${p.name}</div>
        <div style="font-size:9px;color:#8899BB;margin-top:2px">Avg Rank ${p.rank} · CTR ${p.ctr}</div>
      </div>
      <div style="font-size:22px;font-weight:600;color:${p.color}">${p.mentions.toLocaleString()}</div>
    </div>`).join("");

  return `
  <div id="page-competitor" class="page" style="display:none">
    <div class="content">
      <div class="charts-row three">
        <div class="panel">
          <div class="panel-title">Mention share by brand (%)</div>
          <div style="position:relative;height:200px"><canvas id="pieChart"></canvas></div>
        </div>
        <div class="panel">
          <div class="panel-title">Competitor rankings</div>
          <div style="display:flex;gap:8px;font-size:9px;color:#5A6D8A;padding-bottom:6px;border-bottom:1px solid #253350;margin-bottom:4px">
            <span style="width:20px"></span>
            <span style="flex:1">Company</span>
            <span style="width:38px;text-align:right">Share</span>
            <span style="width:28px;text-align:right">Rank</span>
          </div>
          ${compRows}
        </div>
        <div class="panel">
          <div class="panel-title">AI platform breakdown</div>
          ${platCards}
        </div>
      </div>
      <div class="panel" style="margin-top:14px">
        <div class="panel-title">AI brand mention rate trend — all platforms (30 days)</div>
        <div style="position:relative;height:160px"><canvas id="trendChart"></canvas></div>
      </div>
    </div>
  </div>
  <script>
    window.__pieColors = ${JSON.stringify(d.competitors.map(c => c.color))};
    window.__pieLabels = ${JSON.stringify(d.competitors.map(c => c.name))};
    window.__pieValues = ${JSON.stringify(d.competitors.map(c => c.pct))};
  </script>`;
}

// ─────────────────────────────────────────────────────────────
// FULL HTML SHELL
// ─────────────────────────────────────────────────────────────

function buildHTML(data: DashboardData): string {
  const j = JSON.stringify;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>AI Brand Visibility Dashboard</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0A1120;color:#fff;min-height:100vh}

/* TOP HEADER */
.top-header{background:#161E2E;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #4F8EF7;position:sticky;top:0;z-index:20}
.logo{font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#fff}
.logo span{color:#4F8EF7}
.header-right{display:flex;align-items:center;gap:12px}
.live-badge{background:rgba(79,142,247,0.15);border:1px solid #4F8EF7;border-radius:4px;padding:3px 10px;font-size:10px;color:#4F8EF7;letter-spacing:1px;display:flex;align-items:center;gap:6px}
.live-dot{width:7px;height:7px;border-radius:50%;background:#00C9A7;animation:pulse 1.5s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
.refresh-btn{background:transparent;border:1px solid #253350;color:#8899BB;font-size:10px;padding:4px 12px;border-radius:4px;cursor:pointer;letter-spacing:1px;transition:all .2s}
.refresh-btn:hover{border-color:#4F8EF7;color:#4F8EF7}

/* NAV BAR */
.nav-bar{background:#0F1623;border-bottom:1px solid #253350;display:flex;padding:0 24px;position:sticky;top:53px;z-index:19;gap:2px}
.nav-tab{padding:10px 18px;font-size:11px;font-weight:500;color:#5A6D8A;letter-spacing:1px;cursor:pointer;border:none;border-bottom:2px solid transparent;background:none;transition:all .2s;text-transform:uppercase;white-space:nowrap}
.nav-tab:hover{color:#8899BB}
.nav-tab.active[data-page="cover"]      {color:#00C9A7;border-bottom-color:#00C9A7}
.nav-tab.active[data-page="business"]   {color:#4F8EF7;border-bottom-color:#4F8EF7}
.nav-tab.active[data-page="visibility"] {color:#F7C94F;border-bottom-color:#F7C94F}
.nav-tab.active[data-page="competitor"] {color:#F75F5F;border-bottom-color:#F75F5F}

/* LAYOUT */
.page{min-height:calc(100vh - 100px)}
.content{padding:20px 24px;max-width:1400px;margin:0 auto}

/* KPI CARDS */
.kpi-row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:18px}
.kpi-row.seven{grid-template-columns:repeat(7,minmax(0,1fr))}
.kpi{background:#161E2E;border:1px solid #253350;border-radius:8px;padding:14px;border-top:3px solid var(--accent)}
.kpi.sm{padding:10px}
.kpi-label{font-size:9px;color:var(--accent);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px}
.kpi-value{font-size:22px;font-weight:600;color:#fff;line-height:1.1}
.kpi-sub{font-size:10px;color:#8899BB;margin-top:4px}
.kpi-sub.up{color:#00C9A7}
.kpi-sub.down{color:#F75F5F}

/* PANELS */
.charts-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.charts-row.three{grid-template-columns:1fr 1fr 1fr}
.panel{background:#161E2E;border:1px solid #253350;border-radius:8px;padding:16px}
.panel-title{font-size:9px;color:#8899BB;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px}

/* COVER */
.cover-wrap{min-height:calc(100vh - 100px);display:flex}
.cover-accent-bar{width:6px;background:#4F8EF7;flex-shrink:0}
.cover-body{flex:1;display:flex;align-items:center;justify-content:space-between;padding:60px 60px 60px 54px;gap:40px}
.cover-title1{font-size:52px;font-weight:700;letter-spacing:4px;color:#fff;line-height:1}
.cover-title2{font-size:52px;font-weight:700;letter-spacing:4px;color:#4F8EF7;margin-top:4px}
.cover-tagline{font-size:15px;color:#8899BB;margin-top:20px;max-width:520px}
.cover-badge{display:inline-block;margin-top:20px;border:1px solid #4F8EF7;background:rgba(79,142,247,0.12);padding:5px 16px;border-radius:4px;font-size:11px;font-weight:600;color:#4F8EF7;letter-spacing:2px}
.bubble-wrap{display:flex;gap:20px}
.bubble{width:110px;height:110px;border-radius:50%;border:1.5px solid;display:flex;flex-direction:column;align-items:center;justify-content:center}
.bubble-val{font-size:16px;font-weight:600;color:#fff}
.bubble-lbl{font-size:9px;color:#8899BB;margin-top:2px}
.bubble-sub{text-align:center;font-size:10px;color:#5A6D8A;margin-top:10px}

/* FOOTER */
.footer{background:#161E2E;padding:8px 24px;text-align:center;font-size:9px;color:#5A6D8A;letter-spacing:1px;border-top:1px solid #253350}

@media(max-width:960px){
  .kpi-row,.kpi-row.seven{grid-template-columns:repeat(3,minmax(0,1fr))}
  .charts-row,.charts-row.three{grid-template-columns:1fr}
  .cover-body{flex-direction:column;padding:40px 24px}
  .cover-title1,.cover-title2{font-size:36px}
}
</style>
</head>
<body>

<div class="top-header">
  <div class="logo">Shop.py <span>Visibility</span> Dashboard</div>
  <div class="header-right">
    <span style="font-size:10px;color:#5A6D8A">Generated: ${data.generatedAt}</span>
    <button class="refresh-btn" onclick="location.reload()">Refresh data</button>
    <div class="live-badge"><span class="live-dot"></span>Live</div>
  </div>
</div>

<nav class="nav-bar">
  <button class="nav-tab active" data-page="cover"      onclick="navigate(this)">Home</button>
  <button class="nav-tab"        data-page="business"   onclick="navigate(this)">Business Overview</button>
  <button class="nav-tab"        data-page="visibility" onclick="navigate(this)">AI Visibility</button>
  <button class="nav-tab"        data-page="competitor" onclick="navigate(this)">Competitor Breakdown</button>
</nav>

${buildCoverPage()}
${buildBusinessPage(data)}
${buildVisibilityPage(data)}
${buildCompetitorPage(data)}

<div class="footer">CONFIDENTIAL · AI VISIBILITY INTELLIGENCE · P1 2026</div>

<script>
const DAYS     = ${j(data.days)};
const REV_VALS = ${j(data.revenueTrend)};
const WKS      = ${j(data.weekLabels)};
const ROAS_W   = ${j(data.roasByWeek)};
const CPA_W    = ${j(data.cpaByWeek)};
const P_LABELS = ${j(data.promptTriggers.map(p => p.label))};
const P_MENT   = ${j(data.promptTriggers.map(p => p.mentions))};
const P_CLICK  = ${j(data.promptTriggers.map(p => p.clicks))};
const T_WEEKS  = ${j(data.trendWeeks)};
const T_GPT    = ${j(data.trendGPT)};
const T_GEM    = ${j(data.trendGemini)};
const T_CLD    = ${j(data.trendClaude)};
const GRID = "rgba(37,51,80,0.6)", MUTED = "#5A6D8A", DIM = "#8899BB";
</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
<script>
function navigate(btn) {
  document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  const page = btn.dataset.page;
  document.querySelectorAll(".page").forEach(p => p.style.display = "none");
  document.getElementById("page-" + page).style.display = "block";
  if (page === "business"   && !window._biz)  initBusiness();
  if (page === "visibility" && !window._vis)  initVisibility();
  if (page === "competitor" && !window._comp) initCompetitor();
}

function initBusiness() {
  window._biz = true;
  new Chart(document.getElementById("revChart"), {
    type: "line",
    data: { labels: DAYS, datasets: [{ label:"Revenue", data:REV_VALS, borderColor:"#4F8EF7", backgroundColor:"rgba(79,142,247,0.08)", borderWidth:2, pointRadius:0, fill:true, tension:0.4 }] },
    options: { responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false} },
      scales:{ x:{ticks:{color:MUTED,font:{size:9}},grid:{color:GRID}}, y:{ticks:{color:MUTED,font:{size:9},callback:v=>"$"+(v/1000).toFixed(1)+"k"},grid:{color:GRID}} } }
  });
  new Chart(document.getElementById("roasChart"), {
    type: "bar",
    data: { labels: WKS, datasets: [
      { label:"ROAS",    data:ROAS_W, backgroundColor:"#4F8EF7", borderRadius:4, yAxisID:"yR" },
      { label:"CPA ($)", data:CPA_W,  backgroundColor:"#F75F5F", borderRadius:4, yAxisID:"yC" }
    ]},
    options: { responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:true, position:"bottom", labels:{ color:DIM, font:{size:9}, boxWidth:10, padding:10 } } },
      scales:{
        x:{ ticks:{color:MUTED,font:{size:9}}, grid:{color:GRID} },
        yR:{ position:"left",  ticks:{color:"#4F8EF7",font:{size:9},callback:v=>v+"×"}, grid:{color:GRID} },
        yC:{ position:"right", ticks:{color:"#F75F5F",font:{size:9},callback:v=>"$"+v}, grid:{display:false} }
      } }
  });
}

function initVisibility() {
  window._vis = true;
  new Chart(document.getElementById("promptChart"), {
    type: "bar",
    data: { labels: P_LABELS, datasets: [
      { label:"Link Clicks",    data:P_MENT,  backgroundColor:"#4F8EF7", borderRadius:3 },
      { label:"Mentions", data:P_CLICK, backgroundColor:"#00C9A7", borderRadius:3 }
    ]},
    options: { indexAxis:"y", responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:true, position:"bottom", labels:{ color:DIM, font:{size:9}, boxWidth:10, padding:10 } } },
      scales:{ x:{ticks:{color:MUTED,font:{size:9}},grid:{color:GRID}}, y:{ticks:{color:DIM,font:{size:8}},grid:{display:false}} } }
  });
}

function initCompetitor() {
  window._comp = true;
  new Chart(document.getElementById("pieChart"), {
    type: "doughnut",
    data: { labels: window.__pieLabels, datasets: [{ data:window.__pieValues, backgroundColor:window.__pieColors, borderWidth:0, hoverOffset:4 }] },
    options: { responsive:true, maintainAspectRatio:false, cutout:"55%",
      plugins:{ legend:{ display:true, position:"bottom", labels:{ color:DIM, font:{size:9}, boxWidth:10, padding:8 } } } }
  });
  new Chart(document.getElementById("trendChart"), {
    type: "line",
    data: { labels: T_WEEKS, datasets: [
      { label:"ChatGPT", data:T_GPT, borderColor:"#74AA9C", borderWidth:2, pointRadius:0, tension:0.4 },
      { label:"Gemini",  data:T_GEM, borderColor:"#F7C94F", borderWidth:2, pointRadius:0, tension:0.4 },
      { label:"Claude",  data:T_CLD, borderColor:"#9B6DFF", borderWidth:2, pointRadius:0, tension:0.4 },
    ]},
    options: { responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:true, position:"bottom", labels:{ color:DIM, font:{size:9}, boxWidth:10, padding:8 } } },
      scales:{ x:{ticks:{color:MUTED,font:{size:8}},grid:{color:GRID}}, y:{ticks:{color:MUTED,font:{size:8},callback:v=>v+"%"},grid:{color:GRID}} } }
  });
}
</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// HTTP SERVER
// ─────────────────────────────────────────────────────────────

const PORT = 3000;

http.createServer((req, res) => {
  const url = req.url ?? "/";

  if (url === "/api/data") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
    res.end(JSON.stringify(generateData()));
    return;
  }

  if (url === "/" || url === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-cache" });
    res.end(buildHTML(generateData()));
    return;
  }

  res.writeHead(404); res.end("Not found");

}).listen(PORT, () => {
  console.log(`\n✅ Dashboard running at http://localhost:${PORT}`);
  console.log(`   Pages:  Cover · Business Overview · AI Visibility · Competitor Breakdown`);
  console.log(`   API:    http://localhost:${PORT}/api/data`);
  console.log(`   Press Ctrl+C to stop\n`);
});

// ─────────────────────────────────────────────────────────────
// STATIC SNAPSHOT → ./dist/dashboard.html
// ─────────────────────────────────────────────────────────────

const DIST = path.join(process.cwd(), "dist");
if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
const OUT = path.join(DIST, "dashboard.html");
fs.writeFileSync(OUT, buildHTML(generateData()), "utf8");
console.log(`📄 Static snapshot → ${OUT}`);