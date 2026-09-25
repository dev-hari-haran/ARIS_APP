# 🌾 ARIS — AI Farm Intelligence Platform

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel)](https://vercel.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4.0-06B6D4?logo=tailwindcss)](https://tailwindcss.com)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite)](https://vitejs.dev)

**ARIS (Autonomous Agricultural Robotic Intelligence System)** is a state-of-the-art precision farming & AI agricultural intelligence platform. Designed with an intuitive, desktop-grade interface, ARIS helps farmers and agronomists monitor crop vitality, track soil nutrients, automate smart irrigation, and coordinate autonomous field rovers.

---

## 🚀 Key Features

* **🌾 Live Executive Dashboard**: Instant visibility into critical KPIs — Crop Health Index, Soil Moisture, Ambient Temperature, and Tank Reserves.
* **🌿 Crop Intelligence**: Computer vision scan analysis, disease risk scoring, pest threat tracking, growth stage identification, and historical scan logs.
* **🌡 Environment & Microclimate**: Real-time sensor telemetry paired with Open-Meteo meteorological satellite data, 7-day agricultural weather forecast, UV index, barometric pressure, and 24-hr environmental history.
* **🧪 Soil & Nutrient Management**: Zone-based soil maps, live NPK (Nitrogen, Phosphorus, Potassium) balance tracking, custom fertilizer formulation recommendations, and seasonal field nutrient plans.
* **💧 Smart Irrigation Control**: Water tank capacity monitoring (liters & percentage), automated per-zone scheduling, water efficiency telemetry, and 1-click manual override triggers.
* **🤖 Autonomous Robot Operations**: Interactive SLAM field navigation map with live rover tracking, LIDAR / RTK-GPS / Encoder telemetry, and mission queue controls.
* **🔔 Prioritized Alerts & Event Audit**: Real-time threat detection, unresolved alert resolution workflows, and system action logs.
* **⚡ Standalone Vercel & Cloud Ready**: Zero-configuration static deployment with built-in API fallback handlers and SPA rewrite routing.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend Framework** | React 19, TypeScript 5.7, Vite 8 |
| **Styling & UI** | Tailwind CSS v4 (`@tailwindcss/vite`), Custom CSS Design Tokens |
| **Data Visualization** | Recharts (Line, Bar, Area, Cartesian Charts) |
| **Backend Server** | Node.js, Express, SQLite (`better-sqlite3`), Socket.IO |
| **Deployment** | Vercel (`vercel.json` included), GitHub Actions compatible |

---

## 📁 Project Structure

```text
├── src/
│   ├── App.tsx          # Main React Application & View Controllers
│   ├── api.ts           # Centralized API Client with Vercel Static Fallbacks
│   ├── hooks.ts         # Custom React hooks (useFetch, useRealtimeUpdates)
│   ├── index.css        # Global Styles & Tailwind CSS v4 imports
│   └── main.tsx         # React DOM Entrypoint
├── server/              # Backend Express + SQLite Server
│   ├── src/             # Express API routes, seed scripts, & socket handlers
│   ├── aris.db          # Local SQLite Database
│   └── package.json     # Server dependencies
├── vercel.json          # Vercel Deployment & SPA rewrite configuration
├── vite.config.ts       # Vite build & Tailwind CSS plugin configuration
└── package.json         # Project dependencies & build scripts
```

---

## 🏁 Getting Started

### Prerequisites

* Node.js `v18+` or `v20+` / `v22+`
* npm / pnpm / yarn

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/dev-hari-haran/ARIS_APP.git
   cd ARIS_APP
   ```

2. **Install frontend dependencies**:
   ```bash
   npm install
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` (or the terminal URL) in your browser.

4. **(Optional) Run Backend Server**:
   ```bash
   cd server
   npm install
   npm run dev
   ```

---

## 📦 Deployment to Vercel

This repository is fully optimized for **Vercel**:

### Option 1: Git Integration (Recommended)
1. Push your code to your GitHub repository: `https://github.com/dev-hari-haran/ARIS_APP.git`
2. Go to [Vercel Dashboard](https://vercel.com/new).
3. Import `ARIS_APP`. Vercel automatically detects Vite and deploys using `vercel.json`.

### Option 2: Vercel CLI
```bash
npx vercel
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more details.
