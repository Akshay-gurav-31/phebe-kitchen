# 🥦 Phebe Kitchen

**A serverless, offline-first Progressive Web App for real-time Phenylalanine (Phe) budget tracking — built for the PKU Commons Hackathon.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-brightgreen?style=for-the-badge&logo=github)](https://akshay-gurav-31.github.io/phebe-kitchen/)
[![PWA Ready](https://img.shields.io/badge/PWA-Offline%20Ready-blue?style=for-the-badge&logo=googlechrome)](https://akshay-gurav-31.github.io/phebe-kitchen/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

---

## 🩺 Why This Exists

Patients with Phenylketonuria (PKU) must restrict phenylalanine intake every single day — with no days off, no breaks, and no margin for error. The **data feedback loop** is their greatest challenge:

> *"I submitted a blood Phe level 3.5 weeks ago and still don't have the report back. We've heard many times, 'I had no idea what I was experiencing until I was adequately treated.'"*  
> — PKU patient, EL-PFDD Initiative Report

Phebe Kitchen directly addresses this by providing **instant, clinical-grade Phe estimation** at the point of eating — no waiting for lab results, no server calls, no internet required.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔬 **Clinically Verified Estimator** | Phe estimates use the exact same `precision_yield_estimator.py` algorithm from PKU Commons — safety margin formula `max(est × 1.04, est + 1.5)` included |
| 📊 **Daily Budget Tracker** | Visual donut chart tracks Phe consumed vs. your personal daily limit (50–1200 mg, adjustable) |
| 🏷️ **Category Breakdown** | Meals categorized by food type (Fruits, Vegetables, Grains, Starches) with a live progress bar |
| 💾 **Persistent Meal Log** | All logs survive page refresh via `localStorage` — your data is never lost |
| 📴 **Offline-First PWA** | Full Service Worker caching — works in airplane mode, at rest stops, anywhere |
| 📱 **Installable App** | Install to home screen on iOS and Android via the in-app prompt |
| ⚡ **Zero Latency** | Estimation runs entirely in the browser — no network roundtrip, no cold starts |

---

## 🧬 Clinical Accuracy

The food database is sourced directly from **PKU Commons' `foods.json`** — a USDA FDC-verified, peer-reviewed dataset where every row carries:
- A citation to authority (USDA FDC)
- A version tag
- A reviewer of record (Nina, PKU Commons maintainer)

The estimation engine is a faithful JavaScript port of [`precision_yield_estimator.py`](https://github.com/PKU-commons/pku-commons), preserving:
- Fuzzy ingredient stem matching (mirrors `foodlist.py` exactly)
- Train-derived PHE/protein ratios (fit on 510-case training set)
- Proportional safety margin: `max(estimate × 1.04, estimate + 1.5)`

**Currently verified foods (11 items):**
`banana`, `apple`, `strawberry`, `tomato`, `broccoli`, `carrot`, `cucumber`, `rice`, `cornstarch`, `tapioca`, `potato flour`

---

## 🚀 Getting Started

### Option 1: Use the Live App
Visit: **[https://akshay-gurav-31.github.io/phebe-kitchen/](https://akshay-gurav-31.github.io/phebe-kitchen/)**

### Option 2: Run Locally
No build tools or dependencies required — just open the file:

```bash
git clone https://github.com/Akshay-gurav-31/phebe-kitchen.git
cd phebe-kitchen
# Open index.html directly in your browser
start index.html   # Windows
open index.html    # macOS
```

> **Note:** For full PWA/Service Worker support (offline caching), serve over HTTP using any static server:
> ```bash
> python -m http.server 8080
> # Then open http://localhost:8080
> ```

---

## 🏗️ Architecture

```
phebe-kitchen/
├── index.html        # App shell + Tailwind CDN UI
├── app.js            # All logic: estimation engine, budget tracker, localStorage
├── sw.js             # Service Worker for offline caching
├── manifest.json     # PWA manifest (installable)
├── icon.svg          # App icon
└── logo.png          # Branding
```

**Zero backend. Zero dependencies. Zero build step.**

The entire Phe estimation pipeline runs client-side in `app.js`:
- `FOODS_JSON` — embedded USDA-verified database
- `estimatePheLocal()` — clinical estimator (JS port of Python)
- `saveState()` / `localStorage` — persistent session management

---

## 🔗 PKU Commons Alignment

This project is a **consumer-facing client** for the [PKU Commons](https://github.com/PKU-commons/pku-commons) open standard. It does not modify or fork the upstream benchmark pipeline — it reads from the same verified food list and applies the same estimation algorithm, making it directly compatible with future PKU Commons database updates.

---

## 📋 Roadmap

- [ ] Expand food database (community-contributed, peer-reviewed entries)
- [ ] Recipe mode (multi-ingredient Phe calculation)
- [ ] Data export (CSV daily log for clinic appointments)
- [ ] Maternal PKU tracking mode

---

## 🏆 Hackathon

Built for the **PKU Commons Virtual Hackathon** hosted alongside the PKU USA Community Meeting.

**Problem addressed:** Close the data feedback loop for PKU patients — from weeks of waiting for lab results to **instant, verified, offline-capable estimation at every meal.**

---

## 📄 License

MIT © 2026 Akshay Gurav
