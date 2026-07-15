# UFDR Analysis Tool

AI-assisted platform for investigating officers to ingest Cellebrite UFDR reports, search forensic artifacts, and run natural language queries with cited evidence.

## Architecture

```
backend/          FastAPI — ingestion, search, NL query, reports
frontend/         React + Vite — case management UI
samples/          Sample UFDR for testing
docker-compose    PostgreSQL + backend (optional)
```

## Quick Start (Local Development)

### 1. Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python scripts/generate_sample_ufdr.py
uvicorn app.main:app --reload --port 8000
```

API docs: http://127.0.0.1:8000/docs

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

UI: http://localhost:5173

### 3. Test flow

1. Create a case (e.g. `FIR-2026-001`)
2. Upload `samples/sample_device.ufdr`
3. Wait for ingestion to complete (~seconds for sample)
4. Run AI queries:
   - *Show chat records containing crypto addresses*
   - *List all communications with foreign numbers*

## Features (Phase 1 MVP)

| Module | Capability |
|--------|------------|
| **Ingestion** | UFDR upload, ZIP extract, `report.xml` parse, entity extraction |
| **Search** | Keyword search across chats, SMS, calls, contacts, locations |
| **AI Query** | NL intent parsing + hybrid retrieval + cited summaries |
| **Reports** | Text export with artifact IDs and disclaimers |
| **Audit** | Case creation, upload, search, and query logging |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/cases` | Create case |
| GET | `/api/cases` | List cases |
| POST | `/api/cases/{id}/extractions` | Upload UFDR |
| POST | `/api/cases/{id}/search` | Keyword search |
| POST | `/api/cases/{id}/query` | Natural language query |
| GET | `/api/cases/{id}/reports/export` | Export report |

## Configuration

Create `backend/.env` (optional):

```env
DATABASE_URL=sqlite:///./ufdr_analyzer.db
LLM_API_URL=https://your-llm-endpoint/v1/chat/completions
LLM_API_KEY=your-key
LLM_MODEL=gpt-4o-mini
```

Without `LLM_API_URL`, the system uses rule-based summaries (no external API required).

## Docker (PostgreSQL)

```powershell
docker compose up --build
```

## Project Structure

```
MHA/
├── backend/
│   ├── app/
│   │   ├── api/           REST routes
│   │   ├── ingestion/     UFDR parser & worker
│   │   ├── search/        Retrieval
│   │   ├── ai/            Query planner & RAG
│   │   └── entities/      Phone, crypto, URL extractors
│   └── scripts/           Sample UFDR generator
├── frontend/
│   └── src/
│       ├── pages/         Cases, Case detail
│       └── api/           API client
└── docs/
```

## Roadmap

- **Phase 2**: Timeline view, OCR, saved queries, on-prem LLM via Ollama
- **Phase 3**: Cross-case entity graph, CDR/IPDR linkage
- **Phase 4**: RBAC, encryption at rest, production hardening

## Disclaimer

AI-assisted analysis only. All findings must be verified against the original UFDR before use in legal proceedings.
