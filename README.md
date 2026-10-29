# Panopticon EDR — Enterprise SentinelOne-Inspired Dashboard & Telemetry Backend

Enterprise Endpoint Detection and Response (EDR) web console and Java telemetry backend service for the **Panopticon** cybersecurity capstone project.

Developed by **Aditya Singh** (Lead Detection & Dashboard Architect).

---

## 🏛️ System Architecture

This repository unifies both the analyst dashboard frontend and the high-throughput telemetry ingestion backend into an isolated, independent workspace:

```
panopticon-edr-dashboard/
├── console/                       # Web UI & Proxy Server (Port 8787)
│   ├── app.py                     # Python HTTP Server & Security Reverse Proxy
│   ├── alerts.ndjson              # Local development alert feed
│   └── static/
│       ├── index.html             # SentinelOne Singularity-inspired Dashboard UI
│       ├── app.js                 # Interactive client state, SVG graphs & charts
│       └── css/
│           ├── layout.css         # Grid layouts, cards, modals & animations
│           └── tokens.css         # SOC dark-mode color system & design tokens
├── backend/                       # Spring Boot Java REST Backend (Port 8788)
│   ├── src/main/java/             # Spring Boot REST Controllers, Repositories, Models & Services
│   ├── src/main/resources/        # application.properties & database migrations
│   ├── panopticon.db              # SQLite relational alert & endpoint store (WAL mode)
│   ├── build.gradle               # Gradle build definitions
│   └── gradlew.bat                # Gradle wrapper
├── start_dashboard.bat            # One-click startup for both services
└── README.md
```

---

## ✨ Features & Capabilities

- **SentinelOne Singularity UI Layout:**
  - Grouped enterprise left sidebar (Dashboards, Triage Feed, Response Queue, Assets, Threat Hunting).
  - Top KPI Metrics Strip (Critical, High, Medium, Low severity alerts and fleet coverage).
  - Open Alerts Breakdown with severity badges, timestamps, and MITRE ATT&CK tags.
- **Fleet Telemetry Fluctuations Data Lake:**
  - SVG cyclical multi-period anomaly observation model with interactive theme toggles (Editorial Paper vs. Obsidian Cyber).
  - Multi-line time-series activity with live spike indicators.
- **Spring Boot Java Backend (Port 8788):**
  - High-performance REST endpoints for alert ingestion, statistics, and analyst response authorization.
  - Native SQLite persistence with thread-safe Write-Ahead Logging (WAL).
  - Role-based analyst authentication.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Python 3.9+**
- **Java 17+ or 21+** (e.g. OpenJDK or Android Studio JBR)

### 2. Start Both Services (Windows)

Double click or execute:
```powershell
.\start_dashboard.bat
```

Or start them manually in two terminals:

#### Terminal 1: Java Backend Service (Port 8788)
```powershell
cd backend
.\gradlew.bat bootRun
# OR with prebuilt jar:
# java -jar build\libs\panopticon-backend-service-1.0.0-SNAPSHOT.jar
```

#### Terminal 2: Web Console Dashboard (Port 8787)
```powershell
cd console
$env:PANOPTICON_MANAGER_TOKEN = "mock-analyst-token"
python app.py --manager-url http://127.0.0.1:8788 --alerts-file alerts.ndjson
```

### 3. Open in Browser
Visit **[http://127.0.0.1:8787/#overview](http://127.0.0.1:8787/#overview)**.

---

## 📡 REST API Endpoints (Backend Service :8788)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Healthcheck and service runtime status |
| `GET` | `/api/v1/dashboard/stats` | Aggregated fleet alert severity and host metrics |
| `GET` | `/api/v1/alerts` | Paginated alert feed with MITRE tactic/technique details |
| `GET` | `/api/v1/endpoints` | Fleet assets and host agent telemetry status |
| `GET` | `/api/v1/telemetry/fluctuations` | Multi-cycle historical telemetry trends for the data lake chart |
| `GET` | `/api/v1/response-actions` | Active response queue awaiting analyst authorization |
| `POST` | `/api/v1/response-actions/{id}/authorize` | Approve remediation (isolate host, kill PID) |
