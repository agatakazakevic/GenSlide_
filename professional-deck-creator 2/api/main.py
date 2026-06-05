"""
Production FastAPI Backend for Advanced Deck Creator
HTML agentic workflow for AI-decided layouts
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, Header, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
load_dotenv(dotenv_path=ENV_PATH, override=True)

from orchestrator import AdvancedDeckOrchestrator
from utils.llm_client import LLMClient, MockLLMClient
from utils.rag_service import RagService

app = FastAPI(
    title="Advanced AI Deck Creator",
    description="Production-grade AI HTML presentation generator with intelligent layouts",
    version="3.0.0"
)

cors_env = os.getenv("CORS_ORIGIN", "")
cors_origins = [origin.strip() for origin in cors_env.split(",") if origin.strip()]
allow_all_origins = not cors_origins or "*" in cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all_origins else cors_origins,
    allow_credentials=not allow_all_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage
presentations = {}


class PresentationStatus(BaseModel):
    id: str
    status: str  # processing, completed, failed
    progress: int
    message: str
    download_url: Optional[str] = None
    error: Optional[str] = None
    questions: Optional[list[str]] = None


class CreatePresentationHtmlRequest(BaseModel):
    topic: str
    num_slides: int = 10
    template_style: str = "corporate"
    tone: str = "professional"
    use_real_ai: bool = True
    template_id: Optional[str] = None
    template_hint: Optional[str] = None
    logo_path: Optional[str] = None


class SavePresentationHtmlRequest(BaseModel):
    html: str


class PresentationHtmlStatus(BaseModel):
    id: str
    status: str
    progress: int
    message: str
    download_url: Optional[str] = None
    error: Optional[str] = None
    questions: Optional[list[str]] = None


class SavePresentationHtmlResponse(BaseModel):
    status: str
    file_path: Optional[str] = None


@app.post("/api/presentations/create-html", response_model=PresentationHtmlStatus)
async def create_presentation_html(
    request: CreatePresentationHtmlRequest,
    background_tasks: BackgroundTasks,
    x_user_id: int | None = Header(default=None, alias="X-User-ID")
):
    pres_id = str(uuid.uuid4())
    presentations[pres_id] = {
        "id": pres_id,
        "status": "processing",
        "progress": 0,
        "message": "Starting HTML presentation generation...",
        "request": request.dict(),
        "created_at": datetime.now().isoformat(),
    }
    background_tasks.add_task(
        generate_presentation_html_task,
        pres_id,
        request,
        x_user_id
    )
    return PresentationHtmlStatus(
        id=pres_id,
        status="processing",
        progress=0,
        message="HTML presentation generation started"
    )


@app.get("/api/presentations/{pres_id}/download-html")
async def download_presentation_html(pres_id: str):
    job = presentations.get(pres_id)
    if not job:
        raise HTTPException(status_code=404, detail="Presentation not found")
    file_path = job.get("file_path")
    if not file_path or not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="HTML file not found")
    return FileResponse(file_path, filename=os.path.basename(file_path))


@app.post("/api/presentations/{pres_id}/save-html", response_model=SavePresentationHtmlResponse)
async def save_presentation_html(pres_id: str, payload: SavePresentationHtmlRequest):
    job = presentations.get(pres_id)
    if not job:
        raise HTTPException(status_code=404, detail="Presentation not found")
    html = (payload.html or "").strip()
    if not html:
        raise HTTPException(status_code=400, detail="No HTML provided")

    file_path = job.get("file_path")
    if not file_path or not str(file_path).endswith(".html"):
        raise HTTPException(
            status_code=400,
            detail="No existing HTML file to overwrite for this presentation"
        )

    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(html)
        job["updated_at"] = datetime.now().isoformat()
        return SavePresentationHtmlResponse(status="ok", file_path=file_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save HTML: {exc}")


@app.get("/api/presentations/{pres_id}/view-html")
async def view_presentation_html(pres_id: str):
    job = presentations.get(pres_id)
    if not job:
        raise HTTPException(status_code=404, detail="Presentation not found")
    file_path = job.get("file_path")
    if not file_path or not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="HTML file not found")
    filename = os.path.basename(file_path)
    headers = {"Content-Disposition": f'inline; filename="{filename}"'}
    return FileResponse(file_path, media_type="text/html", headers=headers)


@app.get("/api/presentations/{pres_id}/download-json")
async def download_presentation_json(pres_id: str):
    job = presentations.get(pres_id)
    if not job:
        raise HTTPException(status_code=404, detail="Presentation not found")
    json_path = job.get("json_path")
    if not json_path or not os.path.isfile(json_path):
        raise HTTPException(status_code=404, detail="JSON file not found")
    return FileResponse(json_path, filename=os.path.basename(json_path))


async def _render_pdf_from_html_file(html_path: str, pdf_path: str) -> str:
    """Render a deterministic multi-slide PDF from the saved HTML deck.

    The combined HTML already contains @media print styles (embedded by
    html_renderer._combine_slide_documents) that handle page sizing, slide
    flow, and page-break rules.  Playwright just needs to activate print
    media and render.
    """
    try:
        from playwright.async_api import async_playwright
    except Exception as exc:
        raise RuntimeError(f"Playwright is required for PDF export: {exc}") from exc

    html_uri = Path(html_path).expanduser().resolve().as_uri()

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        await page.goto(html_uri, wait_until="networkidle")
        await page.wait_for_selector("section.slide", timeout=8000)
        await page.emulate_media(media="print")
        await page.pdf(
            path=pdf_path,
            print_background=True,
            width="1920px",
            height="1080px",
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            prefer_css_page_size=True,
        )
        await browser.close()

    return pdf_path


@app.get("/api/presentations/{pres_id}/download-pdf")
async def download_presentation_pdf(pres_id: str):
    job = presentations.get(pres_id)
    if not job:
        raise HTTPException(status_code=404, detail="Presentation not found")

    html_path = job.get("file_path")
    if not html_path or not os.path.isfile(html_path):
        raise HTTPException(status_code=404, detail="HTML file not found")

    pdf_path = os.path.splitext(html_path)[0] + ".pdf"
    try:
        await _render_pdf_from_html_file(html_path, pdf_path)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {exc}")

    job["pdf_path"] = pdf_path
    filename = os.path.basename(pdf_path)
    return FileResponse(pdf_path, media_type="application/pdf", filename=filename)


async def generate_presentation_html_task(
    pres_id: str,
    request: CreatePresentationHtmlRequest,
    user_id: int | None
):
    try:
        presentations[pres_id]["progress"] = 10
        presentations[pres_id]["message"] = "Initializing AI agents..."

        if request.use_real_ai and (os.getenv("OPENAI_API_KEY") or os.getenv("GEMINI_API_KEY")):
            llm_client = LLMClient()
        else:
            llm_client = MockLLMClient()
            presentations[pres_id]["message"] += " (Using mock AI for demo)"

        orchestrator = AdvancedDeckOrchestrator(llm_client)

        presentations[pres_id]["progress"] = 20
        presentations[pres_id]["message"] = "Generating HTML content..."

        output_name = f"deck_{pres_id[:8]}"
        html_path, json_path, plan_questions = await orchestrator.create_advanced_presentation_html(
            topic=request.topic,
            num_slides=request.num_slides,
            template_style=request.template_style,
            tone=request.tone,
            template_id=request.template_id,
            template_hint=request.template_hint,
            output_name=output_name,
            user_id=user_id,
            logo_path=request.logo_path,
        )

        presentations[pres_id]["status"] = "completed"
        presentations[pres_id]["progress"] = 100
        presentations[pres_id]["message"] = "HTML presentation ready!"
        presentations[pres_id]["file_path"] = html_path
        presentations[pres_id]["json_path"] = json_path
        presentations[pres_id]["questions"] = plan_questions
        presentations[pres_id]["completed_at"] = datetime.now().isoformat()
    except Exception as e:
        presentations[pres_id]["status"] = "failed"
        presentations[pres_id]["message"] = f"Error: {str(e)}"
        presentations[pres_id]["error"] = str(e)
        print(f"Error generating HTML presentation {pres_id}: {e}")
        import traceback
        traceback.print_exc()


@app.get("/api/presentations/{pres_id}/status", response_model=PresentationStatus)
async def get_presentation_status(pres_id: str):
    """Get presentation status"""
    
    if pres_id not in presentations:
        raise HTTPException(status_code=404, detail="Presentation not found")
    
    pres = presentations[pres_id]
    
    download_url = None
    if pres["status"] == "completed":
        download_url = f"/api/presentations/{pres_id}/download-html"

    return PresentationStatus(
        id=pres_id,
        status=pres["status"],
        progress=pres["progress"],
        message=pres["message"],
        download_url=download_url,
        error=pres.get("error"),
        questions=pres.get("questions"),
    )


@app.post("/api/assets/logo")
async def upload_logo(file: UploadFile = File(...)):
    """Upload a logo and return its local path."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    ext = os.path.splitext(file.filename)[1].lower() or ".png"
    if ext not in {".png", ".jpg", ".jpeg", ".webp"}:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    out_dir = os.path.join("/tmp", "logos")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"logo_{uuid.uuid4().hex}{ext}")
    with open(out_path, "wb") as f:
        f.write(await file.read())
    return {"logo_path": out_path}


@app.get("/api/templates")
async def list_templates():
    """List available template styles"""
    
    return {
        "templates": [
            {
                "id": "corporate",
                "name": "Corporate Professional",
                "description": "Navy blue, clean, business-ready",
                "preview": "https://example.com/corporate.png"
            },
            {
                "id": "modern",
                "name": "Modern & Bold",
                "description": "Purple gradient, contemporary style",
                "preview": "https://example.com/modern.png"
            },
            {
                "id": "minimal",
                "name": "Minimal Clean",
                "description": "Black and white, ultra-clean",
                "preview": "https://example.com/minimal.png"
            },
            {
                "id": "creative",
                "name": "Creative & Colorful",
                "description": "Red accents, bold and energetic",
                "preview": "https://example.com/creative.png"
            },
            {
                "id": "black-elegant",
                "name": "Black Elegant",
                "description": "Black base with warm neutrals and gold accents",
                "preview": "https://example.com/black-elegant.png"
            },
            {
                "id": "full-styled-ir",
                "name": "Full Styled IR",
                "description": "Navy + yellow IR-style with structured visuals",
                "preview": "https://example.com/full-styled-ir.png"
            }
        ]
    }


@app.get("/api/knowledge/check")
async def check_knowledge():
    """Return stats for the most recent RAG retrieval, including chunk previews."""
    stats = RagService.get_last_stats()
    if not stats:
        return {"status": "empty", "message": "No RAG retrieval has occurred yet."}
    return {"status": "ok", "last_retrieval": stats}


@app.get("/api/knowledge/index")
async def knowledge_index():
    """Build the RAG index and return info about available knowledge files."""
    base_dir = os.path.dirname(os.path.dirname(__file__))
    default_uploads = os.path.abspath(os.path.join(base_dir, '..', 'backend', 'uploads'))
    upload_dir = os.getenv('RAG_UPLOAD_DIR', default_uploads)

    rag = RagService(upload_dir=upload_dir)
    chunks = rag.build_index()

    files = rag._list_files(upload_dir)
    file_info = []
    for f in files:
        file_info.append({
            "name": os.path.basename(f),
            "size_kb": round(os.path.getsize(f) / 1024, 1),
        })

    return {
        "status": "ok",
        "upload_dir": upload_dir,
        "dir_exists": os.path.isdir(upload_dir),
        "files": file_info,
        "total_chunks": len(chunks),
        "chunk_size": rag.chunk_size,
        "vector_rag_enabled": rag.enable_local_vector,
        "sample_chunks": [
            {"source": c.source, "preview": " ".join(c.text.split())[:200]}
            for c in chunks[:5]
        ],
    }


@app.get("/health")
async def health_check():
    """Health check"""

    return {
        "status": "healthy",
        "version": "3.1.0",
        "features": [
            "AI-decided layouts",
            "HTML presentation generation",
            "Multiple layout patterns",
            "Canva-style design",
            "Production-ready output",
        ],
        "api_keys": {
            "openai": bool(os.getenv("OPENAI_API_KEY")),
            "gemini": bool(os.getenv("GEMINI_API_KEY"))
        },
        "endpoints": {
            "html": "/api/presentations/create-html",
        }
    }


@app.get("/")
async def root():
    """API root"""
    
    return {
        "name": "Advanced AI Deck Creator",
        "version": "3.0.0",
        "description": "Production-grade AI HTML presentation generator with agentic workflow",
        "features": {
            "ai_layout_intelligence": "AI decides optimal layout for each slide",
            "html_output": "Beautiful HTML presentations with embedded styles",
            "canva_style": "Beautiful, professional layouts like Canva",
            "multiple_patterns": "13 different layout patterns",
            "fully_editable": "Edit everything in the browser after generation"
        },
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
