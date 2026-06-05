# Snapdeck RAG (copy 2) - Developer Guide

This guide documents the full project, services, and end-to-end workflows.
It is written for developers who need to run, debug, and extend the system.

---

## 1) Project overview

Snapdeck RAG is a multi-service system that:
- Ingests documents (PDF/CSV/XLSX)
- Retrieves relevant context (RAG)
- Generates slide plans, content, charts, and layouts
- Renders decks to PPTX and/or HTML
- (Optional) runs visual QA and iterative fixes
- Provides a frontend editor for preview and exports

There are multiple backends that serve different workflows:
- Node backend: document ingest, workflows, UI integrations, Collabora/WOPI
- Python backend (backend_py): RAG + editable PPTX from a simpler pipeline
- Advanced Deck Creator (professional-deck-creator 2): full multi-agent pipeline, PPTX + HTML + visual QA

---

## 2) Repository layout (major parts)

- snapdeck-rag/
  - backend/                      Node/Express API + workflows + local vector store + WOPI
  - backend_py/                   FastAPI RAG + PPTX generator (simpler pipeline)
  - frontend/                     React/Vite UI (editor, preview, export)
  - professional-deck-creator 2/  Advanced multi-agent deck generator (FastAPI)
  - uploads/                      File storage for generated decks and uploads

---

## 3) Services and ports

### Frontend (React/Vite)
- Location: snapdeck-rag/frontend
- Command:
  - npm install
  - npm run dev
- Default: http://localhost:5173

### Node backend (Express)
- Location: snapdeck-rag/backend
- Command:
  - npm install
  - npm run dev
- Default: http://localhost:5000

### Python backend (backend_py)
- Location: snapdeck-rag/backend_py
- Command (example):
  - uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

### Advanced Deck Creator (professional-deck-creator 2)
- Location: snapdeck-rag/professional-deck-creator 2
- Command (example):
  - uvicorn api.main:app --reload --host 0.0.0.0 --port 8002

### Collabora (optional via docker-compose)
- Location: snapdeck-rag/backend
- Command:
  - docker-compose up -d
- Collabora: http://localhost:9980

---

## 4) Environment configuration (key variables)

Set in .env files per service. Do not commit real API keys.

Common AI keys:
- OPENAI_API_KEY
- GEMINI_API_KEY

Advanced deck creator (professional-deck-creator 2):
- GEMINI_MODEL, GEMINI_TEXT_MODEL, GEMINI_IMAGE_MODEL, GEMINI_VISION_MODEL
- MODEL_PREFERENCE (openai | gemini | auto)
- ENABLE_IMAGE_GENERATION (1/0)
- AGENTIC_HTML_MODE (assembly_only | full | off)
- ENABLE_HTML_VISUAL_QA (1/0)
- HTML_VISUAL_QA_MAX_ITERS (default 1-3)
- ENABLE_LOCAL_EMBED_RAG (1/0) → local file vector scoring
- LOCAL_EMBED_CANDIDATES (default 40)
- RAG_HYBRID_VECTOR_WEIGHT / RAG_HYBRID_KEYWORD_WEIGHT (optional weights)
- DATABASE_URL (PostgreSQL + pgvector for DB-backed retrieval)
- GEMINI_EMBEDDING_MODEL (default text-embedding-004 for DB vector queries)

Node backend:
- PORT
- UPLOAD_DIR
- MAX_FILE_SIZE
- CORS_ORIGIN
- COLLABORA_URL / WOPI_BASE_URL / WOPI_SECRET (if using Collabora)

backend_py:
- UPLOAD_DIR
- CORS_ORIGIN
- DATABASE_URL (Postgres + pgvector)
- PGVECTOR_DIM (default 768)

---

## 5) Core workflows (step-by-step)

### 5.1 Document ingestion (Node backend)
1. Frontend uploads a file to:
   - POST /api/documents/upload
2. File is stored in snapdeck-rag/uploads
3. Local in-memory vector store indexes chunks for retrieval
4. Metadata available at:
   - GET /api/documents
   - GET /api/documents/:id

### 5.2 Deck generation (Node backend + agentic workflows)
1. Frontend calls:
   - POST /api/generate/outline
   - POST /api/generate/deck-from-outline or /api/generate/deck-from-prompt
2. The backend calls AI services and uses workflow logic to build a JSON deck.
3. Export routes provide files or integrate with Collabora/WOPI.

This path is ideal for quick experiments and legacy workflows.

### 5.3 RAG + PPTX (backend_py)
1. Upload PDF:
   - POST /api/documents/upload (backend_py)
2. Generate outline:
   - POST /api/generate/outline
3. Generate JSON + image prompts:
   - POST /api/workflow/generate-json
4. Generate images (optional):
   - POST /api/workflow/generate-images
5. Create PPTX:
   - POST /api/workflow/create-pptx
6. Download:
   - GET /api/workflow/download/{filename}

### 5.4 Advanced Deck Creator (professional-deck-creator 2)
This is the most complete pipeline. It supports PPTX, HTML, and visual QA.

Key endpoints:
- POST /api/presentations/create          (PPTX)
- POST /api/presentations/create-html     (HTML + JSON)
- POST /api/playground/dual-slide         (single-slide playground)

Status + downloads:
- GET /api/presentations/{id}/status
- GET /api/presentations/{id}/download
- GET /api/presentations/{id}/download-html
- GET /api/presentations/{id}/download-json
- GET /api/presentations/{id}/view-html
- POST /api/presentations/{id}/save-html

#### PPTX pipeline (high-level phases)
1. RAG (hybrid local files + optional PostgreSQL/pgvector + optional local embedding rerank)
2. Planning (slide outline + intents)
3. Research (fact gathering per slide)
4. Content writing (bullet text)
5. Chart creation (chart_spec only)
6. Logic coherence (QA of flow)
7. Layout intelligence (layout_type selection)
8. Fit content to layout constraints
9. Deck QA and auto-fix
10. Language polish
11. Render PPTX (python-pptx, real charts)

#### HTML pipeline (high-level phases)
1. Same content pipeline as PPTX
2. HTML render (Chart.js + layout templates)
3. Optional visual QA:
   - Render HTML to images via Playwright
   - Review slides with Gemini Vision
   - Optionally rerun up to N iterations

#### Visual QA
- Images saved under /tmp/slide_reviews/...
- QA reports saved under /tmp/deck_*_visual_qa_iter*.json
- Controls:
  - ENABLE_HTML_VISUAL_QA=1
  - HTML_VISUAL_QA_MAX_ITERS=1..3

#### Agentic HTML
Modes (env AGENTIC_HTML_MODE):
- off: deterministic templates only
- assembly_only: LLM chooses component order only
- full: LLM can emit HTML (higher risk of overlap)

---

## 6) Rendering and exporters

### PPTX renderer
- File: professional-deck-creator 2/exporters/advanced_pptx_renderer.py
- Uses python-pptx
- Charts are real, editable in PowerPoint

### HTML renderer
- File: professional-deck-creator 2/exporters/html_renderer.py
- Uses Chart.js
- Slide size is fixed to 16:9 (1280x720)
- Supports agentic HTML mode and visual QA

---

## 7) Frontend editor behavior

The frontend renders:
- JSON-based slide preview (editable in UI)
- HTML preview (via /view-html or /download-html)

Key behaviors:
- Save HTML back to the server:
  - POST /api/presentations/{id}/save-html
- Download HTML or JSON:
  - /download-html or /download-json

If the UI needs the HTML inline:
1. Call /view-html
2. Inject the HTML into the editor (iframe or sanitized container)
3. If edits are allowed, POST /save-html

---

## 8) RAG and search logic

### professional-deck-creator 2 (utils/rag_service.py)
- Local-file retrieval from `RAG_UPLOAD_DIR` (`.pdf`, `.txt`, `.md`) using keyword overlap scoring
- Numeric-signal boosting in scoring to favor chart/table-relevant evidence
- Optional local vector rerank (OpenAI embeddings) when `ENABLE_LOCAL_EMBED_RAG=1`
- PostgreSQL retrieval when `DATABASE_URL` is set:
  - Primary: pgvector cosine similarity with Gemini query embeddings
  - Fallback: keyword SQL search
- Merge local + DB chunks with dedupe, then return bounded top-k
- Retrieval diagnostics available via:
  - `GET /api/knowledge/check` (last retrieval stats + returned chunk previews)
  - `GET /api/knowledge/index` (current local index/files/chunks)

### backend_py (services/rag_service.py)
- Postgres + pgvector embeddings
- Hybrid retrieval = vector similarity + keyword overlap rerank
- Best at “find the right chunk” retrieval quality

---

## 9) Common developer tasks

### Start all core services (local dev)
1. Collabora (optional):
   - cd snapdeck-rag/backend
   - docker-compose up -d
2. Backend (Node):
   - cd snapdeck-rag/backend
   - npm run dev
3. Advanced deck creator:
   - cd snapdeck-rag/professional-deck-creator 2
   - uvicorn api.main:app --reload --host 0.0.0.0 --port 8002
4. Frontend:
   - cd snapdeck-rag/frontend
   - npm run dev

### Debug a failed generation
1. Check status endpoint for the presentation ID
2. Inspect the agent trace under /tmp/agent_trace_*.json
3. Inspect HTML output under /tmp/deck_*.html
4. If Visual QA was enabled, inspect:
   - /tmp/deck_*_visual_qa_iter*.json
   - /tmp/slide_reviews/.../slide_*.png

---

## 10) Where to change behavior

Pipeline logic (advanced):
- professional-deck-creator 2/orchestrator.py

Agents:
- professional-deck-creator 2/agents/

Layout logic:
- professional-deck-creator 2/core/layout_intelligence.py

PPTX rendering:
- professional-deck-creator 2/exporters/advanced_pptx_renderer.py

HTML rendering:
- professional-deck-creator 2/exporters/html_renderer.py

Visual QA:
- professional-deck-creator 2/utils/visual_qa.py

Frontend editor:
- snapdeck-rag/frontend/src/components/AgenticSlideEditor.jsx

---

## 11) Troubleshooting quick notes

- HTML preview looks clipped:
  - Ensure slide container is fixed to 16:9 and scaled by the editor
  - Confirm .agentic-canvas or slide root uses width/height 100%

- Visual QA returns parse errors:
  - Ensure the QA prompt requires strict JSON only
  - Enable JSON repair in visual_qa.py

---

## 12) Summary

There are three primary pipelines:
- Node backend for UI workflows and integrations
- backend_py for simple RAG-to-PPTX
- professional-deck-creator 2 for advanced multi-agent PPTX/HTML

Pick the pipeline based on your use case:
- Need fastest iteration? Use backend_py
- Need highest-quality decks? Use professional-deck-creator 2
- Need WOPI/Collabora or UI integrations? Use Node backend
