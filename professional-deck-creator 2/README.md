# 🎨 Advanced AI Deck Creator

## Production-Grade PPTX Generator with AI Layout Intelligence

This is a **properly advanced** AI presentation system that creates **actual PowerPoint files** with:

✅ **AI-Decided Layouts** - AI analyzes content and chooses optimal visual layout for EACH slide  
✅ **Real PPTX Charts** - Actually renders charts in PowerPoint (not placeholders!)  
✅ **13 Layout Patterns** - Canva-style beautiful designs  
✅ **Production Quality** - Business-ready, fully editable PPTX files  
✅ **Multi-Agent Content** - Specialized AI agents for planning, research, writing  

---

## 🚀 What Makes This Advanced?

### Previous Version (Basic)
- ❌ Fixed HTML template  
- ❌ Chart placeholders in PPTX  
- ❌ No layout intelligence  
- ❌ Generic bullet point slides  

### This Version (Advanced)
- ✅ **AI Decides Layouts**: Different visual layout for each slide based on content
- ✅ **Real Charts in PPTX**: Uses `python-pptx` to render actual, editable charts  
- ✅ **13 Layout Patterns**: Two-column, three-column, comparison, timeline, big numbers, etc.  
- ✅ **Canva-Style Design**: Professional, beautiful slides  
- ✅ **Production PPTX**: Open in PowerPoint and edit everything  

---

## 📐 Available Layout Patterns

The AI chooses from these layouts based on content:

1. **Title Only** - Section dividers
2. **Single Column Text** - Classic bullet points
3. **Two Column Text+Chart** - Text left, chart right ⭐
5. **Three Column Cards** - Equal width cards
6. **Full Chart** - Chart-focused slide ⭐
7. **Split Comparison** - Before/After, A vs B
8. **Timeline Horizontal** - Process steps
9. **Grid 2x2** - Four quadrants
10. **Big Number Stats** - Large metrics ⭐
11. **Process Flow** - Flowchart
12. **Quote Centered** - Inspirational quote
13. **Items** - General-purpose list
14. **Steps** - Sequential steps
15. **Summary** - Key takeaways
16. **Comparison** - Two items side-by-side
17. **Milestone** - Dates and checkpoints
18. **PESTEL** - 2x3 grid
19. **SWOT** - 2x2 grid
20. **Pyramid** - Hierarchy
21. **Timeline** - Chronological events
22. **Funnel** - Stage filtering
23. **Quote** - Impactful quote
24. **Cycle** - Looping stages
25. **Thanks** - Closing slide
26. **Table** - Structured data
27. **Concentric Circles** - TAM/SAM/SOM
28. **Title Cover** - Normal title slide

⭐ = Includes REAL rendered charts

---

## 🎯 Key Features

### 1. Layout Intelligence Agent
```python
# AI analyzes slide content and decides optimal layout
layout = await layout_agent.decide_layout(slide_content, context)

# Returns detailed specification:
{
    "layout_type": "two_column_text_chart",
    "element_positions": {
        "title": {"x": 0.5, "y": 0.5, "w": 9, "h": 0.8},
        "content": {"x": 0.5, "y": 1.5, "w": 4, "h": 3.5},
        "chart": {"x": 5, "y": 1.5, "w": 4.5, "h": 3.5}
    },
    "visual_hierarchy": {
        "primary_focus": "chart",
        "secondary_focus": "text"
    }
}
```

### 2. Real PPTX Chart Rendering
```python
# NOT a placeholder - actual PowerPoint chart!
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE

chart_data = CategoryChartData()
chart_data.categories = ['Q1', 'Q2', 'Q3', 'Q4']
chart_data.add_series('Revenue', [100, 150, 200, 250])

chart = slide.shapes.add_chart(
    XL_CHART_TYPE.COLUMN_CLUSTERED,
    x, y, cx, cy,
    chart_data
)
```

### 3. Multi-Agent Content Generation
- **Planner**: Creates structure
- **Researcher**: Gathers data
- **Content Writer**: Writes text
- **Chart Creator**: Designs visualizations
- **Layout Agent**: Decides visual presentation 

---

## 🧭 End-to-End Generation Sequence (What Happens)

This is the exact flow when you call `/api/presentations/create`:

1) **API Request In**
   - `api/main.py` receives the request, stores status, and starts a background task.

2) **RAG Context (Optional)**
   - `utils/rag_service.py` builds a temporary index from `backend/uploads` and returns a short `rag_overview`.
   - This context is injected into planning/writing so the deck reflects your files.

3) **Phase 1: Content Generation (Agents)**
   - **PlannerAgent**: creates the slide outline and assigns `content_type`.
   - **ResearcherAgent**: drafts supporting points and data ideas.
   - **ContentWriterAgent**: writes final bullet text.
   - **ChartCreatorAgent**: creates chart specs (labels/values/types).

4) **Hard Rules from Prompt**
   - `orchestrator._enforce_prompt_requirements()` scans the prompt for hard requirements
     (e.g., TAM/SAM/SOM → concentric circles, “timeline”, “table”, “X charts”).
   - These override slide `content_type` to enforce compliance.

5) **Phase 2: Layout Intelligence**
   - `LayoutDecisionAgent` chooses an optimal layout per slide based on content type,
     number of bullets, chart presence, and context.
   - `_apply_layout_rules()` ensures chart slides actually use chart-capable layouts.
   - Diversity limits avoid overusing a single layout.

6) **Phase 2a: Fit Content to Layout Constraints**
   - `_fit_content_to_layouts()` rewrites or trims text so bullets/titles fit their boxes.
   - Uses safe truncation only when rewriting still exceeds limits.

7) **Phase 2b: Deck QA and Auto-Fix**
   - `DeckQAAgent` critiques the full deck spec and returns structured fixes.
   - Fixes can include layout swaps, shortening titles, dropping charts on title slide, etc.

8) **Phase 3: PPTX Rendering**
   - `AdvancedPPTXRenderer` draws real charts via `python-pptx`.
   - Every slide is rendered using the chosen layout and final text.
   - Final PPTX is written to `/tmp/` with a short safe filename.

9) **Status + Download**
   - `/api/presentations/{id}/status` shows progress.
   - `/api/presentations/{id}/download` returns the PPTX.

---

## 📁 Key Files (Where Each Step Lives)

- **API entry**: `api/main.py`
- **Orchestrator**: `orchestrator.py`
- **Layout logic**: `core/layout_intelligence.py`
- **Agents**: `agents/`
- **Chart rendering**: `exporters/advanced_pptx_renderer.py`
- **RAG**: `utils/rag_service.py`

---

## ✅ What’s Currently Disabled

- **Image generation / illustrations**: enabled via Nano Banana Pro (Gemini image model). Illustrations are added as semantic anchors with AI-chosen placement slots.
  (We can re-enable later, but this README matches the current code state.)

---

## 🚀 Quick Start

### Installation

```bash
cd professional-deck-creator
pip install -r requirements.txt
```

### Set API Keys (Optional)

```bash
export OPENAI_API_KEY="sk-..."
# or
export GEMINI_API_KEY="..."
```

**Note**: Works without API keys using MockLLMClient for demo!

### Run API Server

```bash
cd api
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Generate Presentation

```bash
curl -X POST http://localhost:8000/api/presentations/create \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "The Future of AI",
    "num_slides": 12,
    "template_style": "modern",
    "tone": "professional",
    "use_real_ai": false
  }'
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "progress": 0,
  "message": "Presentation generation started"
}
```

### Check Status

```bash
curl http://localhost:8000/api/presentations/{id}/status
```

### Download PPTX

```bash
curl http://localhost:8000/api/presentations/{id}/download \
  -o presentation.pptx
```

---

## 💻 Python Usage

```python
import asyncio
from orchestrator import AdvancedDeckOrchestrator
from utils.llm_client import LLMClient

async def main():
    # Initialize
    llm_client = LLMClient()  # Uses OpenAI or Gemini
    orchestrator = AdvancedDeckOrchestrator(llm_client)
    
    # Create presentation
    pptx_path = await orchestrator.create_advanced_presentation(
        topic="Renewable Energy Revolution",
        num_slides=15,
        template_style="modern",
        tone="professional"
    )
    
    print(f"Created: {pptx_path}")

asyncio.run(main())
```

---

## 🎨 Template Styles

### Corporate
- Colors: Navy blue (#1E40AF), Blue (#3B82F6)
- Font: Calibri
- Use: Business presentations, quarterly reviews

### Modern
- Colors: Purple (#7C3AED), Light purple (#A78BFA)
- Font: Arial
- Use: Tech startups, innovation pitches

### Minimal
- Colors: Black, Gray
- Font: Helvetica
- Use: Luxury brands, design portfolios

### Creative
- Colors: Red (#DC2626), Light red (#F87171)
- Font: Georgia
- Use: Marketing, creative agencies

---

## 📊 How Charts Work

### Chart Specification (from AI)
```json
{
  "chart_type": "bar",
  "data": [100, 150, 200, 250, 300],
  "labels": ["2020", "2021", "2022", "2023", "2024"],
  "colors": ["#1E40AF", "#3B82F6", "#60A5FA"],
  "title": "Revenue Growth"
}
```

### PPTX Rendering
The system actually renders this as a real PowerPoint chart using `python-pptx`:

1. Creates CategoryChartData object
2. Adds series with data
3. Inserts into slide at AI-decided position
4. Applies styling (colors, legend, gridlines)
5. Result: Fully editable chart in PowerPoint!

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│              FastAPI Backend                     │
├─────────────────────────────────────────────────┤
│         Advanced Deck Orchestrator               │
├──────────┬──────────┬──────────┬────────────────┤
│ Planner  │Researcher│ Content  │ Chart Creator  │
│  Agent   │  Agent   │  Writer  │     Agent      │
└──────────┴──────────┴──────────┴────────────────┘
     │           │          │           │
     └───────────┴──────────┴───────────┘
                    │
         ┌──────────┴──────────┐
         │  Layout Intelligence │  ⭐ NEW
         │       Agent          │
         └──────────┬───────────┘
                    │
         ┌──────────┴───────────┐
         │ Advanced PPTX        │
         │ Renderer             │  ⭐ Renders real charts
         │ (python-pptx)        │
         └──────────────────────┘
                    │
              .pptx file
```

---

## 🔧 Configuration

### API Endpoints

- `POST /api/presentations/create` - Create presentation
- `GET /api/presentations/{id}/status` - Check status
- `GET /api/presentations/{id}/download` - Download PPTX
- `GET /api/templates` - List templates
- `GET /health` - Health check

### Environment Variables

```bash
# Optional (uses MockLLMClient without these)
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
```

---

## 📝 Example Outputs

### What AI Decides For Each Slide:

**Slide 1** (Title):
- Layout: `title_only`
- Full screen background
- Centered title
- Decorative line

**Slide 2** (Introduction):
- Layout: `single_column_text`
- Title + 4 bullet points
- Accent bar on left

**Slide 3** (Market Data):
- Layout: `two_column_text_chart`
- Text left (40% width)
- Chart right (60% width) - REAL BAR CHART
- Primary focus: Chart

**Slide 4** (Statistics):
- Layout: `big_number_stats`
- Three large numbers (60pt font)
- Labels below each
- Colorful accent boxes

**Slide 5** (Comparison):
- Layout: `split_comparison`
- Before/After sections
- Divider line
- Different colors for each side

---

## ✅ What's Actually Generated

### PPTX File Contains:
- ✅ Real, editable PowerPoint slides
- ✅ Actual chart objects (not images!)
- ✅ Editable text boxes
- ✅ Professional formatting
- ✅ Custom layouts per slide
- ✅ Proper spacing and alignment
- ✅ Color-coded elements
- ✅ Open in PowerPoint/Keynote/Google Slides

### You Can Edit:
- Chart data and style
- All text content
- Colors and fonts
- Layout and positioning
- Add/remove elements
- Everything!

---

## 🆚 Comparison

| Feature | Basic HTML Generator | This System |
|---------|---------------------|-------------|
| Output Format | HTML only | **PPTX (PowerPoint)** |
| Charts | Chart.js in browser | **Real PPTX charts** |
| Layouts | One fixed template | **13 AI-decided patterns** |
| Editable | Browser only | **PowerPoint/Keynote** |
| Production Ready | No | **Yes** |
| Business Use | Demo only | **Professional** |

---

## 🚀 Production Deployment

### Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY . /app

RUN pip install -r requirements.txt

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t advanced-deck-creator .
docker run -p 8000:8000 -e OPENAI_API_KEY=... advanced-deck-creator
```

### Environment

- Python 3.9+
- 2GB RAM minimum
- API keys for real AI (optional)

---

## 🎯 Use Cases

1. **Business Presentations**: Quarterly reviews, investor pitches
2. **Sales Decks**: Product presentations, proposals
3. **Educational Content**: Training materials, lectures
4. **Marketing**: Campaign presentations, strategy decks
5. **Reports**: Data analysis, research findings

---

## 📚 Documentation

- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health
- **Templates**: http://localhost:8000/api/templates

---

## 🎓 How It Works

1. **Content Generation**: Multi-agent system creates slide content
2. **Layout Intelligence**: AI analyzes each slide and decides optimal layout
3. **PPTX Rendering**: `python-pptx` renders actual PowerPoint file
4. **Chart Rendering**: Real chart objects inserted into PPTX
5. **Styling**: Template styles applied
6. **Output**: Professional, editable PPTX file

---

## 🆘 Troubleshooting

**Q: Charts not showing?**  
A: Make sure you're downloading the PPTX file, not HTML. Charts are rendered in PowerPoint format.

**Q: Layout looks basic?**  
A: Enable real AI (set API keys). MockLLMClient uses simple fallback layouts.

**Q: Can't edit in PowerPoint?**  
A: File should open normally. Try updating Office/PowerPoint to latest version.

**Q: Generation fails?**  
A: Check API keys. System falls back to MockLLMClient automatically.

---

## 🎉 Summary

This is a **production-grade, advanced AI deck creator** that:

1. ✅ **Actually generates real PPTX files**
2. ✅ **AI decides different layouts for each slide**
3. ✅ **Renders real charts in PowerPoint** (not placeholders!)
4. ✅ **Creates Canva-style beautiful designs**
5. ✅ **Produces business-ready, editable presentations**

Perfect for creating professional presentations at scale with AI assistance!

---
