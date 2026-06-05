# Snapdeck RAG - Product Documentation

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Project Structure](#3-project-structure)
4. [Multi-Agent System (Python Backend)](#4-multi-agent-system-python-backend)
5. [Node.js Backend](#5-nodejs-backend)
6. [Frontend Application](#6-frontend-application)
7. [Slide Generation Pipeline](#7-slide-generation-pipeline)
8. [RAG (Retrieval-Augmented Generation)](#8-rag-retrieval-augmented-generation)
9. [Layout Intelligence System](#9-layout-intelligence-system)
10. [Chart System](#10-chart-system)
11. [HTML Rendering Engine](#11-html-rendering-engine)
12. [Template & Theme System](#12-template--theme-system)
13. [Visual QA System](#13-visual-qa-system)
14. [Slide Editor (Frontend)](#14-slide-editor-frontend)
15. [Export Capabilities](#15-export-capabilities)
16. [API Reference](#16-api-reference)
17. [External Integrations](#17-external-integrations)
18. [Configuration & Environment Variables](#18-configuration--environment-variables)
19. [Dependencies](#19-dependencies)
20. [Setup & Running](#20-setup--running)

---

## 1. Product Overview

**Snapdeck RAG** is an AI-powered presentation generation platform that creates professional, fully-editable HTML slide decks from natural language prompts and uploaded documents.

### Key Capabilities

- **AI-Driven Slide Generation**: Transforms topics or uploaded documents into complete slide decks using a multi-agent AI system
- **RAG-Powered Content**: Indexes uploaded PDFs, CSVs, and Excel files to generate data-driven presentations grounded in real company data
- **28 Layout Types**: AI selects the optimal layout for each slide based on content type (title, chart, comparison, timeline, etc.)
- **Inline Editing**: Click-to-edit any text, resize/drag elements, edit charts directly in the browser
- **Multiple Export Formats**: HTML, PPTX (PowerPoint), and SlideSpeak integration
- **6 Template Themes**: Corporate, Modern, Minimal, Creative, Black Elegant, and Full Styled IR
- **Chart Generation**: Automatic chart creation (bar, line, pie, doughnut, column, radar) with Chart.js
- **Visual QA**: Optional Playwright + Gemini Vision quality assurance pass

---

## 2. Architecture Overview

Snapdeck RAG uses a **three-tier architecture** with two backend services:

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                   │
│              Port 5173 (Vite dev server)             │
├──────────────────────┬──────────────────────────────┤
│   Python Backend     │     Node.js Backend           │
│   (FastAPI)          │     (Express)                 │
│   Port 8000          │     Port 5000                 │
│                      │                               │
│   - Multi-agent AI   │   - Document upload/parse     │
│   - Slide generation │   - RAG indexing              │
│   - HTML rendering   │   - Chart editing             │
│   - Layout decisions │   - PPTX export               │
│   - Visual QA        │   - SlideSpeak integration    │
│                      │   - WOPI (Collabora)          │
└──────────────────────┴──────────────────────────────┘
```

### Data Flow

1. User uploads documents via **Node.js backend** (PDF/CSV/Excel parsing + vector indexing)
2. User enters a topic and clicks "Generate" in the **frontend**
3. **Frontend** calls **Python backend** to start generation
4. **Python multi-agent system** executes the full pipeline (plan → research → write → chart → layout → render)
5. Completed HTML deck is returned and displayed in the **frontend editor**
6. User edits slides inline, then exports to PPTX or saves HTML

---

## 3. Project Structure

```
snapdeck-rag/
├── professional-deck-creator 2/    # Python multi-agent backend
│   ├── api/
│   │   └── main.py                 # FastAPI application (port 8000)
│   ├── agents/
│   │   ├── base_agent.py           # Base class for all agents
│   │   ├── planner_agent.py        # Slide deck planning agent
│   │   ├── researcher_agent.py     # Research & RAG retrieval agent
│   │   ├── content_writer_agent.py # Content writing agent
│   │   ├── chart_creator_agent.py  # Chart data generation agent
│   │   ├── reviewer_agent.py       # Quality review agent
│   │   ├── image_agent.py          # Illustration generation agent
│   │   └── task_manager.py         # Task orchestration
│   ├── core/
│   │   └── layout_intelligence.py  # AI layout decision agent
│   ├── exporters/
│   │   └── html_renderer.py        # HTML slide renderer (2300+ lines)
│   ├── utils/
│   │   ├── llm_client.py           # LLM API client (OpenAI/Gemini)
│   │   ├── rag_service.py          # RAG retrieval service
│   │   ├── visual_qa.py            # Playwright + Gemini Vision QA
│   │   ├── deck_qa_agent.py        # Deck-level QA agent
│   │   └── logger.py               # Logging utilities
│   ├── orchestrator.py             # Main pipeline orchestrator
│   └── requirements.txt            # Python dependencies
│
├── backend/                        # Node.js backend
│   ├── src/
│   │   ├── server.js               # Express application (port 5000)
│   │   ├── routes/
│   │   │   ├── documentRoutes.js   # Document upload/management
│   │   │   ├── generationRoutes.js # Outline & chart generation
│   │   │   └── slidespeakRoutes.js # SlideSpeak export
│   │   ├── controllers/
│   │   │   ├── documentController.js
│   │   │   ├── generationController.js
│   │   │   ├── slidespeakController.js
│   │   │   └── wopiController.js   # Collabora Online integration
│   │   ├── services/
│   │   │   ├── ragService.js       # RAG indexing & retrieval
│   │   │   ├── geminiService.js    # Gemini API embeddings
│   │   │   ├── pdfService.js       # PDF parsing
│   │   │   ├── tabularService.js   # CSV/Excel parsing
│   │   │   ├── localVectorStore.js # Local vector storage
│   │   │   ├── imagenService.js    # Image generation
│   │   │   └── slidespeakService.js
│   │   ├── agentic/                # Node.js agentic pipeline
│   │   │   ├── orchestrator.js
│   │   │   ├── agents/
│   │   │   ├── assembly/
│   │   │   ├── knowledge/
│   │   │   ├── qa/
│   │   │   └── data/
│   │   ├── config/
│   │   └── middleware/
│   ├── uploads/                    # Uploaded document storage
│   ├── templates/                  # PPTX templates
│   ├── docker-compose.yml          # Qdrant vector DB
│   └── package.json
│
├── frontend/                       # React frontend
│   ├── src/
│   │   ├── App.jsx                 # Main application (~6300 lines)
│   │   ├── components/
│   │   │   ├── AgenticSlideEditor.jsx  # Core slide editor
│   │   │   ├── ChartBuilder.jsx        # Chart creation UI
│   │   │   ├── ChartBuilderPanel.jsx   # Chart editing panel
│   │   │   ├── ChartPreview.jsx        # Chart preview
│   │   │   ├── IrSlide.jsx             # IR-style slide renderer
│   │   │   ├── SlideEditor.jsx         # Legacy slide editor
│   │   │   ├── RevealPresentation.jsx  # Reveal.js presenter
│   │   │   └── IRDeckTemplateSystem.jsx
│   │   ├── styles/
│   │   │   └── ir-theme.css
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
│
└── PRODUCT_DOCUMENTATION.md        # This file
```

---

## 4. Multi-Agent System (Python Backend)

The Python backend implements a multi-agent AI system where specialized agents collaborate to create presentations.

### Agents

| Agent | File | Responsibility |
|-------|------|----------------|
| **PlannerAgent** | `agents/planner_agent.py` | Creates the deck outline: slide titles, content types, key points, visual intents, chart intents |
| **ResearcherAgent** | `agents/researcher_agent.py` | Retrieves relevant data from the RAG index for each slide |
| **ContentWriterAgent** | `agents/content_writer_agent.py` | Writes full slide content (titles, bullet points, speaker notes) informed by research |
| **ChartCreatorAgent** | `agents/chart_creator_agent.py` | Generates chart specifications (type, labels, data points, series) |
| **LayoutDecisionAgent** | `core/layout_intelligence.py` | Selects the optimal layout type for each slide based on content |
| **ReviewerAgent** | `agents/reviewer_agent.py` | Reviews slides for quality, consistency, and accuracy |
| **ImageAgent** | `agents/image_agent.py` | Generates illustration prompts and manages image placement |
| **DeckQAAgent** | `utils/deck_qa_agent.py` | Deck-level quality assurance across all slides |

### Orchestrator

The `AdvancedDeckOrchestrator` (`orchestrator.py`) coordinates all agents through a phased pipeline. It manages:
- Agent execution order and dependencies
- Concurrency control (`LLM_CONCURRENCY` env var, default 4)
- Error handling and fallbacks
- Data flow between agents
- Schema validation at each phase
- Plan contract enforcement (ensuring content matches the plan)

---

## 5. Node.js Backend

The Express.js backend (`backend/src/server.js`) handles document management, RAG indexing, and export operations.

### Core Services

| Service | File | Purpose |
|---------|------|---------|
| **pdfService** | `services/pdfService.js` | PDF text extraction using `pdf-parse` |
| **tabularService** | `services/tabularService.js` | CSV/Excel parsing using `csv-parse` and `xlsx` |
| **ragService** | `services/ragService.js` | Document indexing and hybrid vector+keyword retrieval |
| **geminiService** | `services/geminiService.js` | Gemini API for embeddings and generation |
| **localVectorStore** | `services/localVectorStore.js` | In-memory vector storage for embeddings |
| **imagenService** | `services/imagenService.js` | Image generation service |
| **slidespeakService** | `services/slidespeakService.js` | SlideSpeak API integration for PPTX conversion |

### Supported File Types

| Format | Max Size | Parser |
|--------|----------|--------|
| PDF | 10 MB | `pdf-parse` |
| CSV/TSV | 10 MB | `csv-parse` |
| XLS/XLSX | 10 MB | `xlsx` |

---

## 6. Frontend Application

The frontend is a **React 18** SPA built with **Vite** and **Tailwind CSS**.

### Main Application (`App.jsx`)

The `App.jsx` file (~6300 lines) is the central component containing:

- **State Management**: All presentation state (slides, current slide, theme, edit mode)
- **Document Upload UI**: Drag-and-drop file upload with progress indicators
- **Generation Controls**: Topic input, template selection, slide count, tone settings
- **Slide Viewport**: Scaled slide rendering with centering logic
- **Thumbnail Navigation**: Horizontal scrollable slide strip
- **Export Controls**: Download as HTML, export to PPTX, SlideSpeak integration
- **Sidebar**: Document list, RAG status, knowledge base stats

### Key Components

| Component | Purpose |
|-----------|---------|
| `AgenticSlideEditor` | Primary slide editor with inline text editing, element drag/resize, chart editing |
| `ChartBuilder` | Interactive chart creation with type selection, data input, and preview |
| `ChartBuilderPanel` | Side panel for chart configuration |
| `ChartPreview` | Chart rendering preview using Recharts |
| `IrSlide` | IR (Investor Relations) themed slide renderer |
| `RevealPresentation` | Full-screen presentation mode using Reveal.js |
| `IRDeckTemplateSystem` | IR deck template system |

### Slide Rendering

Slides are rendered at a fixed **1280x720 pixel** internal resolution and scaled to fit the viewport using CSS `transform: scale(X)` with `transform-origin: top left`. The scale factor is calculated dynamically based on the available container dimensions.

---

## 7. Slide Generation Pipeline

The complete slide generation pipeline executed by the orchestrator:

### Phase 0: RAG Evidence Extraction
- Builds/updates the document index
- Retrieves top-k relevant passages for the topic
- Extracts company name, date, and IR tables from context

### Phase 1a: Planning
- `PlannerAgent` creates the deck outline
- Each slide gets: title, content_type, key_points, visual_intent, chart constraints
- Generates clarifying questions for the user

### Phase 1b: Enforce Prompt Requirements
- Validates plan against schema
- Enforces chart/visual constraints
- Syncs plan constraints and limits visual intents

### Phase 2: AI Layout Decision (Early Pass)
- `LayoutDecisionAgent` selects layout type for each slide
- Considers content type, visual intent, and chart presence
- Chooses from 28 available layout types

### Phase 1c: Research
- `ResearcherAgent` retrieves RAG data for each slide
- Uses the document index with per-slide queries

### Phase 1d: Content Writing (Layout-Aware)
- `ContentWriterAgent` produces full slide content
- Informed by research results and selected layouts
- Incorporates IR tables data when available

### Phase 1e: Chart Creation
- `ChartCreatorAgent` generates chart specifications
- Chart types constrained by content intent (e.g., market_sizing → bar/column/line)
- Can be disabled via `HTML_DISABLE_CHARTS` env var

### Phase 1f: Logic Coherence Pass
- Reviews content for logical consistency across the deck
- Rewrites sections that don't flow well

### Phase 2a: Illustration Enrichment
- `ImageAgent` generates illustration prompts for eligible slides
- Respects layout whitelist/blacklist (e.g., no illustrations on SWOT/table slides)

### Phase 2b: Fit Content to Layout Constraints
- Adjusts content to fit within the selected layout's constraints
- Trims or reorganizes content that exceeds layout capacity

### Phase 2c: Deck-Level QA + Auto-Fix
- `DeckQAAgent` reviews the entire deck for quality issues
- Automatically fixes detected problems (inconsistencies, missing data, formatting)

### Phase 2d: Language Polish
- Final language refinement pass
- Strips assumption markers and placeholder text

### Phase 3: HTML Rendering
- `HTMLRenderer` converts slide data + layouts into complete HTML
- Applies template theme, injects Chart.js charts, adds safety CSS
- Outputs a self-contained HTML file

### Phase 4: Visual QA (Optional)
- Renders each slide via Playwright (headless browser)
- Takes screenshots and sends to Gemini Vision for quality analysis
- Automatically applies suggested fixes
- Enabled via `ENABLE_HTML_VISUAL_QA` env var

---

## 8. RAG (Retrieval-Augmented Generation)

### Document Processing Pipeline

1. **Upload**: User uploads PDF/CSV/Excel via the Node.js backend
2. **Parse**: Document text and tables extracted by `pdfService` or `tabularService`
3. **Chunk**: Text split into manageable chunks for indexing
4. **Embed**: Chunks embedded using Gemini embeddings (`geminiService`)
5. **Index**: Embeddings stored in the local vector store (`localVectorStore`)

### Retrieval

- **Hybrid Search**: Combines vector similarity search with keyword matching
- **Per-User Isolation**: Documents can be filtered by user ID (`X-User-ID` header)
- **Top-K Retrieval**: Configurable number of results (default: 6 for topic overview)
- **IR Table Extraction**: Special extraction for financial/IR table data

### Storage

- **Local Vector Store**: In-memory vector storage for development
- **Qdrant** (optional): Docker-based vector database for production (`docker-compose.yml` provided)
- **Upload Directory**: Files stored in `backend/uploads/`

---

## 9. Layout Intelligence System

The `LayoutDecisionAgent` (`core/layout_intelligence.py`) uses AI to select the optimal layout for each slide.

### Available Layout Types (28)

| Category | Layouts |
|----------|---------|
| **Title** | `title_cover`, `title_only` |
| **Text** | `single_column_text`, `two_column_text` |
| **Visual Split** | `text_left_illustration_right` |
| **Lists/Items** | `items`, `steps`, `three_column_cards` |
| **Data** | `big_number_stats`, `big_number`, `big_number_with_hero_image` |
| **Charts** | `chart` (rendered via Chart.js) |
| **Comparison** | `comparison`, `split_comparison`, `comparison_with_center_visual` |
| **Frameworks** | `swot`, `pestel`, `grid_2x2` |
| **Process** | `timeline`, `timeline_horizontal`, `timeline_with_backdrop`, `milestone`, `cycle` |
| **Hierarchy** | `pyramid`, `funnel`, `concentric_circles` |
| **Quote** | `quote` |
| **Table** | `table` |
| **Closing** | `summary`, `thanks` |

### Layout Selection Logic

The AI considers:
- Content type (text, data, chart, comparison, etc.)
- Number of items/points on the slide
- Whether a chart is present
- Visual intent flags from the planner
- Adjacent slide layouts (to avoid repetition)

### Illustration Rules

- Layouts in `NO_ILLUSTRATION_LAYOUTS` (swot, pestel, grid_2x2, table, etc.) never get illustrations
- Layouts in `ILLUSTRATION_LAYOUT_WHITELIST` may receive illustrations
- `ILLUSTRATION_VARIANT_LAYOUTS` render illustrations natively in the layout (not as overlays)

---

## 10. Chart System

### Supported Chart Types

| Type | Use Case |
|------|----------|
| **Bar** | Comparisons, market sizing |
| **Column** | Trends, traction data |
| **Line** | Time series, trends |
| **Pie** | Distribution, market share |
| **Doughnut** | Distribution (alternative to pie) |
| **Radar** | Multi-dimensional comparisons |

### Chart Generation Flow

1. **PlannerAgent** flags slides that need charts and sets the intent (e.g., `market_sizing`, `trend`)
2. **ChartCreatorAgent** generates chart specifications: `chart_type`, `labels`, `data`, `series_name`, `axes_labels`
3. **HTMLRenderer** renders charts using **Chart.js** (client-side) embedded in the HTML
4. **Frontend** can edit charts via `ChartBuilder` / `ChartBuilderPanel` components

### Intent-to-Chart-Type Mapping

```
market_sizing  → bar, column, line
trend          → line, column
comparison     → bar
distribution   → pie, doughnut, bar
traction       → line, column, bar
```

### Frontend Chart Editing

The `ChartBuilder` component allows users to:
- Change chart type
- Edit data labels and values
- Modify series names
- Adjust colors and styling
- Preview changes in real-time via `ChartPreview`

---

## 11. HTML Rendering Engine

The `HTMLRenderer` (`exporters/html_renderer.py`, 2300+ lines) is the core rendering engine that converts slide data into self-contained HTML.

### Key Features

- **Self-Contained Output**: Single HTML file with all CSS/JS embedded
- **Chart.js Integration**: Charts rendered client-side with Chart.js
- **CSS Layout Library**: 28 layout-specific CSS classes
- **Safety CSS Injection**: Ensures consistent rendering regardless of LLM-generated content
- **Responsive Scaling**: 1280x720 base resolution with CSS transform scaling
- **Theme Application**: Colors, fonts, and backgrounds applied per theme

### Rendering Process

1. Iterate through slides with their assigned layouts
2. Apply layout-specific HTML structure
3. Inject content (title, text, bullets, charts, images)
4. Apply theme styles (colors, gradients, fonts)
5. Add safety CSS to prevent LLM-generated style conflicts
6. Combine all slides into a single HTML document
7. Embed Chart.js library and chart initialization scripts

---

## 12. Template & Theme System

### Available Templates

| Template ID | Name | Description |
|-------------|------|-------------|
| `corporate` | Corporate Professional | Navy blue, clean, business-ready |
| `modern` | Modern & Bold | Purple gradient, contemporary style |
| `minimal` | Minimal Clean | Black and white, ultra-clean |
| `creative` | Creative & Colorful | Red accents, bold and energetic |
| `black-elegant` | Black Elegant | Black base with warm neutrals and gold accents |
| `full-styled-ir` | Full Styled IR | Navy + yellow IR-style with structured visuals |

### Theme Properties

Each template defines:
- **Primary/Secondary/Accent colors** (hex values)
- **Background color and gradients**
- **Font families** (headings + body)
- **Text colors** (titles, body, muted)
- **Card/element styling** (borders, shadows, radius)

### Template Resolution

The `_resolve_template_style()` method in the orchestrator can dynamically select or blend templates based on the topic, tone, and optional `template_hint` parameter.

---

## 13. Visual QA System

An optional quality assurance system that uses visual inspection to catch rendering issues.

### How It Works

1. **Rendering**: Each slide is opened in a headless browser via **Playwright**
2. **Screenshot**: A screenshot is captured of the rendered slide
3. **Vision Analysis**: The screenshot is sent to **Gemini Vision** for quality analysis
4. **Issue Detection**: The AI identifies visual problems (text overflow, misalignment, color contrast issues, etc.)
5. **Auto-Fix**: Detected issues are routed back through the fix pipeline
6. **Re-Render**: Fixed slides are re-rendered and optionally re-checked

### Configuration

- Enabled via `ENABLE_HTML_VISUAL_QA=true` environment variable
- Requires Playwright installed (`pip install playwright && playwright install`)
- Requires Gemini API key (`GEMINI_API_KEY`)

---

## 14. Slide Editor (Frontend)

### `AgenticSlideEditor` Component

The main editor component provides Canva-like editing capabilities:

#### Text Editing
- **Click** any text element (h1-h6, p, span, li, td, th, label) to select it
- **Double-click** to enter inline edit mode with `contentEditable`
- Text changes are captured and synced back to the slide HTML
- Wrapper divs are traversed to find the actual text element beneath

#### Element Interaction
- **Drag**: Move elements by clicking and dragging
- **Resize**: Resize elements via drag handles
- **Z-index management**: Decorative overlays have lower z-index, text elements have `z-index: 2` to ensure clickability

#### Chart Editing
- Click on chart areas to open the chart editor panel
- Modify chart type, data, labels, and colors
- Real-time preview of changes

#### Viewport Scaling
- Internal slide resolution: **1280 x 720 pixels**
- Dynamic scale calculation: `scale = min(containerWidth / 1280, containerHeight / 720)`
- CSS `transform: scale(X)` with `transform-origin: top left`

---

## 15. Export Capabilities

### HTML Export
- Direct download of the self-contained HTML file
- Includes all styles, scripts, and Chart.js embedded

### PPTX Export
- Uses `pptxgenjs` (Node.js) for PowerPoint generation
- Templates available in `backend/templates/`
- Preserves slides, text, and basic formatting

### SlideSpeak Integration
- API integration via `slidespeakService.js`
- Routes: `/api/slidespeak/*`
- Converts presentations for the SlideSpeak platform

### WOPI (Collabora Online)
- WOPI protocol endpoints for Collabora Online integration
- Enables web-based Office editing of exported PPTX files
- Endpoints: `GET/POST /api/wopi/files/:filename/contents`

---

## 16. API Reference

### Python Backend (FastAPI - Port 8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/presentations/create-html` | Start HTML presentation generation |
| `GET` | `/api/presentations/{id}/status` | Get generation status/progress |
| `GET` | `/api/presentations/{id}/download-html` | Download generated HTML file |
| `GET` | `/api/presentations/{id}/view-html` | View HTML in browser (inline) |
| `GET` | `/api/presentations/{id}/download-json` | Download slide data as JSON |
| `POST` | `/api/presentations/{id}/save-html` | Save edited HTML back to server |
| `POST` | `/api/assets/logo` | Upload a company logo |
| `GET` | `/api/templates` | List available template styles |
| `GET` | `/api/knowledge/check` | Check RAG retrieval stats |
| `GET` | `/health` | Health check |

#### Create Presentation Request Body

```json
{
  "topic": "string (required)",
  "num_slides": 10,
  "template_style": "corporate",
  "tone": "professional",
  "use_real_ai": true,
  "template_id": "string (optional)",
  "template_hint": "string (optional)",
  "logo_path": "string (optional)"
}
```

### Node.js Backend (Express - Port 5000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/documents/upload` | Upload a single document |
| `POST` | `/api/documents/batch-upload` | Upload multiple documents (max 10) |
| `GET` | `/api/documents` | List all documents |
| `GET` | `/api/documents/:id` | Get document details |
| `DELETE` | `/api/documents/:id` | Delete a document |
| `POST` | `/api/documents/:id/analyze` | Analyze document content |
| `GET` | `/api/documents/:id/preview` | Preview document content |
| `POST` | `/api/generate/outline` | Generate a presentation outline |
| `POST` | `/api/generate/chart-edit` | Edit chart data via AI |
| `POST` | `/api/generate/auto-chart` | Auto-generate charts from data |
| `GET/POST` | `/api/wopi/files/:filename/*` | WOPI endpoints for Collabora |
| `*` | `/api/slidespeak/*` | SlideSpeak integration routes |
| `GET` | `/health` | Health check |

---

## 17. External Integrations

### AI/LLM Providers

| Provider | Purpose | API Key Env Var |
|----------|---------|-----------------|
| **OpenAI** | GPT models for content generation | `OPENAI_API_KEY` |
| **Google Gemini** | Content generation, embeddings, Vision QA | `GEMINI_API_KEY` / `GOOGLE_API_KEY` |
| **Anthropic Claude** | Alternative LLM provider | `ANTHROPIC_API_KEY` |

### Services

| Service | Purpose |
|---------|---------|
| **Qdrant** | Vector database for production RAG (Docker) |
| **Playwright** | Headless browser for Visual QA screenshots |
| **SlideSpeak** | External presentation platform integration |
| **Collabora Online** | Web-based Office document editing (WOPI) |
| **Chart.js** | Client-side chart rendering in HTML output |

---

## 18. Configuration & Environment Variables

### Python Backend (`.env` in `professional-deck-creator 2/`)

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | - | OpenAI API key |
| `GEMINI_API_KEY` | - | Google Gemini API key |
| `CORS_ORIGIN` | `*` | Allowed CORS origins (comma-separated) |
| `PORT` | `8000` | FastAPI server port |
| `LLM_CONCURRENCY` | `4` | Max concurrent LLM API calls |
| `SLIDE_SCHEMA_STRICT` | `false` | Enforce strict slide JSON schema |
| `HTML_DISABLE_CHARTS` | `false` | Disable chart generation |
| `ENABLE_HTML_VISUAL_QA` | `false` | Enable Playwright + Gemini Vision QA |
| `RAG_UPLOAD_DIR` | `../backend/uploads` | Directory for uploaded documents |

### Node.js Backend (`.env` in `backend/`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Express server port |
| `GOOGLE_API_KEY` | - | Gemini API key for embeddings |
| `CORS_ORIGIN` | `http://localhost:5173,...` | Allowed CORS origins |
| `UPLOAD_DIR` | `./uploads` | Document upload directory |
| `MAX_FILE_SIZE` | `10485760` | Max upload size in bytes (10 MB) |
| `NODE_ENV` | `development` | Environment mode |

---

## 19. Dependencies

### Python Backend

| Package | Version | Purpose |
|---------|---------|---------|
| `fastapi` | >=0.115.0 | Web framework |
| `uvicorn` | 0.24.0 | ASGI server |
| `pydantic` | >=2.10.0 | Data validation |
| `python-pptx` | 0.6.23 | PowerPoint generation |
| `openai` | >=1.40.0 | OpenAI API client |
| `google-genai` | 1.62.0 | Gemini API client |
| `aiohttp` | 3.9.1 | Async HTTP |
| `Pillow` | >=10.0.0 | Image processing |
| `python-dotenv` | 1.0.0 | Environment variables |
| `PyPDF2` | 3.0.1 | PDF parsing |

### Node.js Backend

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.21.2 | Web framework |
| `@google/generative-ai` | ^0.21.0 | Gemini API |
| `pdf-parse` | ^1.1.1 | PDF text extraction |
| `xlsx` | ^0.18.5 | Excel parsing |
| `csv-parse` | ^5.5.6 | CSV parsing |
| `chart.js` + `chartjs-node-canvas` | ^3.9.1 | Server-side chart rendering |
| `pptxgenjs` | ^3.12.0 | PowerPoint generation |
| `puppeteer` | ^23.11.1 | Headless browser |
| `multer` | ^1.4.5 | File upload handling |
| `axios` | ^1.7.7 | HTTP client |

### Frontend

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.3.1 | UI framework |
| `react-dom` | ^18.3.1 | React DOM renderer |
| `vite` | ^5.4.11 | Build tool / dev server |
| `tailwindcss` | ^3.4.17 | Utility-first CSS |
| `axios` | ^1.7.9 | HTTP client |
| `recharts` | ^2.12.7 | React chart components |
| `lucide-react` | ^0.263.1 | Icon library |
| `mermaid` | ^11.12.2 | Diagram rendering |
| `reveal.js` | ^5.2.1 | Presentation framework |
| `html-to-image` | ^1.11.11 | DOM-to-image conversion |

---

## 20. Setup & Running

### Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **npm** or **yarn**
- API keys for at least one LLM provider (OpenAI or Gemini)

### 1. Python Backend Setup

```bash
cd "professional-deck-creator 2"

# Create virtual environment
python -m venv venv
source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env  # or create manually
# Add: OPENAI_API_KEY=sk-... and/or GEMINI_API_KEY=...

# Start the server
python api/main.py
# → Running on http://localhost:8000
```

### 2. Node.js Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file with GOOGLE_API_KEY, etc.

# (Optional) Start Qdrant vector DB
docker-compose up -d

# Start the server
npm run dev
# → Running on http://localhost:5000
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
# → Running on http://localhost:5173
```

### 4. Production Build

```bash
cd frontend
npm run build
# Output in dist/ directory
```

### Quick Start Workflow

1. Start all three services (Python backend, Node.js backend, frontend)
2. Open `http://localhost:5173` in your browser
3. (Optional) Upload PDF/CSV/Excel documents for RAG context
4. Enter a topic (e.g., "Global Data Center Market Analysis")
5. Select a template style and number of slides
6. Click "Generate" and wait for the multi-agent pipeline to complete
7. Edit slides inline in the editor
8. Export to HTML or PPTX

---


