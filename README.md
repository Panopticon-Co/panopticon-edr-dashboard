# Panopticon EDR — Enterprise SentinelOne Dashboard & Telemetry Backend

[![Organization](https://img.shields.io/badge/Org-Panopticon--Co-blue.svg)](https://github.com/Panopticon-Co)
[![Author](https://img.shields.io/badge/Author-Aditya%20Singh%20(K064)-darkgreen.svg)](https://github.com/Adityasingh230058)
[![Role](https://img.shields.io/badge/Role-Lead%20Detection%20%26%20Dashboard%20Architect-purple.svg)]()
[![Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)]()
[![Frontend Repo](https://img.shields.io/badge/Frontend--Only%20Extraction-panopticon--sentinel--ui--aditya-orange.svg)](https://github.com/Panopticon-Co/panopticon-sentinel-ui-aditya)
[![E2E Tests](https://img.shields.io/badge/E2E%20Tests-49%2F49%20Passing-success.svg)]()
[![Unit Tests](https://img.shields.io/badge/Python%20Unit%20Tests-64%2F64%20Passing-success.svg)]()
[![Backend Tests](https://img.shields.io/badge/Java%20Backend-Gradle%20Passing-success.svg)]()

> **Comprehensive Full-Stack Capstone Demonstration**  
> Architected, developed, and maintained by **Aditya Singh** (Lead Detection & Dashboard Architect, Roll: K064).  
> Dedicated Frontend-Only Repository: [Panopticon-Co/panopticon-sentinel-ui-aditya](https://github.com/Panopticon-Co/panopticon-sentinel-ui-aditya).

---

## 🏛️ System Architecture

This monorepo unifies the SentinelOne-inspired security operations web console with a high-performance Spring Boot Java telemetry backend into a production-grade, end-to-end verified capstone demonstration:

```
panopticon-edr-dashboard/
├── console/                       # Web UI & Security Reverse Proxy Server (Port 8787)
│   ├── app.py                     # Python HTTP Server & Upstream Proxy
│   ├── alerts.ndjson              # Offline fallback telemetry feed
│   ├── static/                    # Zero-build SentinelOne single-page web console
│   │   ├── index.html             # 4-Slide Application Layout (Overview, Endpoints, Alerts, Response)
│   │   ├── app.js                 # State management, slide routing, SVG metrics
│   │   └── css/                   # Design token system & accessible cyber themes
│   └── tests/                     # 64-case Python unit and proxy security test suite
├── backend/                       # Spring Boot Java REST Backend (Port 8788)
│   ├── src/main/java/             # Controllers, Repositories, Telemetry Models & Services
│   ├── src/main/resources/        # application.properties & database configuration
│   ├── panopticon.db              # SQLite relational store with Write-Ahead Logging (WAL)
│   ├── build.gradle               # Gradle build definitions & test configuration
│   └── gradlew.bat                # Gradle build wrapper
├── tests/                         # Full-Stack Automated Verification Infrastructure
│   └── e2e/                       # 49-case multi-tier End-to-End Test Suite
├── start_dashboard.bat            # One-click startup for both services
└── README.md
```

---

## ✨ Key Technical Achievements

1. **SentinelOne Singularity 4-Slide Navigation Interface (R3)**:
   - High-performance, client-side slide navigation (`#overview`, `#endpoints`, `#alerts`, `#response`).
   - Deep-linking and history state synchronization without full page reloads.

2. **Decommission of Obsolete Multi-Cycle Lake (R1)**:
   - Completely eliminated the unverified "Fleet Telemetry Fluctuations // Multi-Cycle Lake" section.
   - Cleaned up obsolete SVG wave animations and unanchored metrics to guarantee architectural purity.

3. **Closed 7-Action Response Engine Integration (R2)**:
   - Enforces Panopticon's closed 7-action response vocabulary:
     - *Auto-Safe*: `COLLECT_PROCESS_INFO`, `COLLECT_NETWORK_CONNECTIONS`.
     - *Analyst-Approval*: `KILL_PROCESS`, `COLLECT_FILE`, `QUARANTINE_FILE`, `ISOLATE_HOST`, `RELEASE_HOST_ISOLATION`.
   - Modals protect destructive actions, requiring mandatory justification from analysts.

4. **Security Reverse Proxy & Token Encapsulation**:
   - `console/app.py` proxies requests to the Java backend (`:8788`) while securely managing `PANOPTICON_MANAGER_TOKEN`.
   - Zero credential leakage to the browser DOM.

---

## 🚀 Quick Start Guide

### Start Both Services (Windows)

```powershell
.\start_dashboard.bat
```

Or start them manually in two terminals:

#### Terminal 1: Java Backend Service (Port 8788)
```powershell
cd backend
.\gradlew.bat bootRun
```

#### Terminal 2: Web Console Dashboard (Port 8787)
```powershell
cd console
$env:PANOPTICON_MANAGER_TOKEN = "mock-analyst-token"
python app.py --manager-url http://127.0.0.1:8788 --alerts-file alerts.ndjson
```

Open your browser to: **[http://127.0.0.1:8787/#overview](http://127.0.0.1:8787/#overview)**.

---

## 🧪 Verification & Test Suites (100% Pass Rate)

### 1. Node.js E2E Test Suite (49/49 PASS)
```powershell
node tests/e2e/runner.js
```

### 2. Python Unit & Security Suite (64/64 PASS)
```powershell
cd console
python -m unittest discover -s tests -v
```

### 3. Java Spring Boot Backend Suite
```powershell
cd backend
.\gradlew.bat test
```

---

## 👥 Contributor Attribution & Repository Separation

| Contributor | Role & Domain | Primary Repositories |
| :--- | :--- | :--- |
| **Aditya Singh** (`Adityasingh230058`) | **Lead Detection & Dashboard Architect (Roll: K064)**<br>Full-Stack EDR Architecture, Sentinel UI, Closed Response Queue, Telemetry Backend | [Panopticon-Co/panopticon-edr-dashboard](https://github.com/Panopticon-Co/panopticon-edr-dashboard) *(Full-Stack)*<br>[Panopticon-Co/panopticon-sentinel-ui-aditya](https://github.com/Panopticon-Co/panopticon-sentinel-ui-aditya) *(Frontend-Only)* |
| **Rishi Bose** (`rishibose35`) | **Evidence & Verification Lead**<br>Artifact Verification, Signed Telemetry Downloads | [Panopticon-Co/panopticon-console](https://github.com/Panopticon-Co/panopticon-console) |

---

## 📜 License

This project is licensed under the MIT License.
