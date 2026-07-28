# 🛡️ UFDR-INTEL — AI-Powered Digital Forensic Analysis Platform

**UFDR-INTEL** is a full-stack digital forensics intelligence tool that ingests **UFDR (Universal Forensic Extraction Report)**-style data, parses it into a structured, searchable database, and layers an **AI forensic agent (Google Gemini)** on top for natural-language investigation — letting an investigator query chat logs, call records, contacts, and geolocation data the same way they'd ask a colleague a question.

Built as a case-study project exploring how AI-assisted analysis can accelerate mobile device extraction review — a workflow traditionally done manually inside proprietary tools like Cellebrite Physical Analyzer or Oxygen Forensic Detective.

> ⚠️ **Project status: prototype / portfolio project.** This is not a certified forensic tool, has not undergone forensic validation, and is not intended for use in real investigations or as evidence in legal proceedings. See [Disclaimer](#-disclaimer) below.

---

## 🔍 Keywords / Topics

`digital-forensics` `mobile-forensics` `ufdr` `forensic-analysis` `law-enforcement-tools` `cellebrite` `oxygen-forensic` `cdr-analysis` `call-detail-record` `osint` `investigation-tool` `ai-forensics` `text-to-sql` `rag` `gemini-ai` `fastapi` `react` `sqlite-fts5` `chain-of-custody` `crime-analysis` `network-graph-analysis` `geolocation-forensics` `evidence-extraction`

---

## ✨ What It Does

UFDR-INTEL simulates the core workflow of a digital forensic examiner reviewing a seized mobile device extraction:

| Capability | Description |
|---|---|
| 📥 **UFDR Ingestion** | Upload a `.ufdr` (ZIP-based) forensic report; the backend extracts the embedded XML report and media attachments, then parses them into a relational database |
| 🔎 **Natural Language Query Engine** | Ask investigative questions in plain English (e.g. *"show me messages mentioning a bitcoin wallet"*) — an AI agent translates the query into SQL and executes it against the case database, with a keyword/full-text-search fallback if AI is unavailable |
| 🤖 **AI Forensic Assistant** | A RAG-style chat sidebar that retrieves relevant messages/calls as context and asks Gemini to summarize, flag anomalies, and answer investigator questions about the active case |
| 🚩 **Automated Flagging** | Heuristic-based auto-flagging of suspicious communications during parsing — cryptocurrency wallet addresses (BTC/ETH pattern matching), financial transaction keywords, and foreign-number contact patterns |
| 📊 **Case Dashboard** | At-a-glance stats: message/call/contact volume, flagged-communication count, call direction breakdown, and message activity timeline |
| 💬 **Chat Thread Reconstruction** | Groups extracted messages into conversation threads, viewable like a native messaging app |
| 🕸️ **Relationship / Link Analysis Graph** | Interactive canvas-based network graph visualizing communication relationships between the device owner and contacts, with flagged contacts highlighted |
| 📍 **Geolocation Registry** | Sortable table of extracted GPS coordinates (from photo metadata, cell tower logs, or chat references) with one-click Google Maps lookup |
| 📄 **Forensic PDF Report Generation** | Auto-generates a formatted PDF summary of the case — device profile, flagged communications, and call frequency analytics — suitable for case documentation |
| 🔬 **Full-Text Search (FTS5)** | SQLite FTS5-indexed message search for fast keyword lookups independent of AI availability |

---

## 🏗️ Architecture

```
┌─────────────────────┐         REST API          ┌──────────────────────┐
│   React 19 Frontend │ ◄────────────────────────► │   FastAPI Backend     │
│   (Vite, Canvas viz) │                            │   (Python)            │
└─────────────────────┘                            └───────────┬──────────┘
                                                                 │
                                    ┌────────────────────────────┼────────────────────────┐
                                    ▼                             ▼                         ▼
                          ┌──────────────────┐         ┌──────────────────┐      ┌──────────────────┐
                          │  SQLite + FTS5    │         │  UFDR SAX Parser  │      │  Google Gemini     │
                          │  (case data store) │         │  (XML → relational)│      │  (Text-to-SQL, RAG)│
                          └──────────────────┘         └──────────────────┘      └──────────────────┘
```

**Data flow:** `.ufdr` upload → ZIP extraction → streaming SAX XML parse → relational insert (cases, device_info, contacts, calls, messages, geolocations, files) → FTS5 indexing + auto-flagging → queryable via REST API → surfaced through dashboard, search, chat, and AI layers.

---

## 🧰 Tech Stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) — REST API framework
- [SQLite](https://www.sqlite.org/) with **FTS5** — embedded relational storage + full-text search
- `xml.sax` — streaming XML parser for memory-efficient UFDR ingestion
- [Google Gemini API](https://ai.google.dev/) (`google-genai`) — natural language → SQL translation and RAG-based case analysis
- [fpdf2](https://pypi.org/project/fpdf2/) — PDF forensic report generation
- Uvicorn — ASGI server

**Frontend**
- [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Lucide React](https://lucide.dev/) — icon system
- Native `<canvas>` — custom-built relationship/network graph renderer (no charting library dependency)
- Custom SVG-based bar/donut charts for dashboard analytics

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- (Optional) A [Google Gemini API key](https://aistudio.google.com/apikey) for AI-powered query translation and chat — the app runs without one, using keyword/FTS5 search as a fallback

### 1. Clone the repository
```bash
git clone https://github.com/SangameshDevani/UFDR-INTEL.git
cd UFDR-INTEL
```

### 2. Backend setup
```bash
cd backend
python -m venv venv

# Windows (PowerShell)
venv\Scripts\Activate.ps1
# Windows (cmd)
venv\Scripts\activate.bat
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
python main.py
```
Backend runs at `http://127.0.0.1:8000` — API docs available at `http://127.0.0.1:8000/docs`.

### 3. Frontend setup
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at `http://localhost:5173`.

### 4. Try it out
1. Open the frontend, go to **Ingestion & Keys**
2. Click **Generate Demo Case** to load a pre-built mock case (or upload your own `.ufdr` file)
3. (Optional) Paste a Gemini API key into **Gemini AI Credentials** to unlock natural language search and the AI chat sidebar
4. Explore the Dashboard, Forensic Explorer, Chat Conversations, Relationship Graph, and Geolocations tabs

---

## 📁 Project Structure

```
UFDR-INTEL/
├── backend/
│   ├── main.py              # FastAPI app & API routes
│   ├── parser.py            # SAX-based UFDR (.ufdr/XML) parser + auto-flagging heuristics
│   ├── database.py          # SQLite schema, FTS5 setup, triggers
│   ├── agent.py             # Gemini integration — Text-to-SQL + RAG chat
│   ├── mock_generator.py    # Synthetic UFDR case generator for demos/testing
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main application (dashboard, explorer, chats, graph, geo, settings)
│   │   └── ...
│   └── package.json
└── README.md
```

---

## 🗺️ Roadmap

- [ ] Investigator authentication & role-based access control
- [ ] Interactive map visualization for geolocation data (Leaflet/Mapbox)
- [ ] Background job processing for large-scale extraction ingestion
- [ ] Audit logging / chain-of-custody trail for evidentiary integrity
- [ ] File hash verification (MD5/SHA-256) on ingested attachments
- [ ] Expanded parser support for real-world forensic extraction schema variants
- [ ] Configurable flagging rule engine (beyond hardcoded keyword/regex heuristics)

---

## ⚠️ Disclaimer

UFDR-INTEL is an **educational and portfolio project** demonstrating full-stack development, AI integration, and digital forensics workflow concepts. It is **not**:
- A certified or forensically validated tool
- Compliant with chain-of-custody or evidentiary admissibility standards
- Compatible with proprietary extraction formats from commercial tools (Cellebrite, Oxygen, MSAB, etc.) without adaptation — it parses a defined custom XML schema
- Intended for use in active criminal investigations or as courtroom evidence

Any case data referenced in demos (including sample `.ufdr` files) is entirely fictional, generated for testing purposes only.

---



---

## 🙋 Author

**Sangamesh Devani**
B.Tech Computer Science | Full-Stack Development | AI Integration
[GitHub](https://github.com/SangameshDevani)

---

⭐ If you find this project interesting or it helped you understand forensic tooling architecture, consider starring the repo!
