import os
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

ENV_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "professional-deck-creator 2", ".env")
)
if os.path.isfile(ENV_PATH):
    load_dotenv(dotenv_path=ENV_PATH, override=False)
else:
    load_dotenv()

from .services.pdf_service import validate_pdf, extract_key_info
from .services.rag_service import index_document, get_diverse_chunks, retrieve_relevant_chunks
from .services.gemini_service import (
    generate_outline,
    generate_editable_presentation_json,
    extract_image_prompts,
)
from .services.imagen_service import batch_generate_images
from .services.pptx_service import create_editable_pptx, save_pptx
from .services.pgvector_service import health_check as pgvector_health

UPLOAD_DIR = os.getenv('UPLOAD_DIR', './uploads')

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv('CORS_ORIGIN', 'http://localhost:5173')],
    allow_credentials=True,
    allow_methods=["*"] ,
    allow_headers=["*"],
)

# In-memory store
DOCUMENTS = []


class DocumentIdsRequest(BaseModel):
    documentIds: List[str]
    userPrompt: Optional[str] = ''


class GenerateImagesRequest(BaseModel):
    imagePrompts: List[Dict[str, Any]]


class CreatePptxRequest(BaseModel):
    presentation: Dict[str, Any]
    images: Optional[Dict[str, Any]] = None


@app.get('/health')
async def health():
    return {"status": "ok", "pgvector": pgvector_health()["status"]}


@app.post('/api/documents/upload')
async def upload_document(file: UploadFile = File(...)):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(UPLOAD_DIR, file.filename)
    with open(filepath, 'wb') as f:
        f.write(await file.read())

    validation = validate_pdf(filepath)
    if not validation['valid']:
        raise HTTPException(status_code=400, detail=validation['error'])

    document_id = f"doc_{int(os.path.getmtime(filepath))}"
    key_info = extract_key_info(filepath)
    index_result = index_document(filepath, document_id, file.filename)

    doc_meta = {
        "id": document_id,
        "filename": file.filename,
        "filepath": filepath,
        "size": validation.get("size"),
        "uploadedAt": index_result.get("metadata", {}).get("creationDate"),
        "numPages": index_result.get("numPages"),
        "chunksIndexed": index_result.get("chunksIndexed"),
        "collectionName": index_result.get("collectionName"),
        "sections": index_result.get("sections"),
        "keyInfo": key_info,
    }
    DOCUMENTS.append(doc_meta)
    return {"success": True, "document": doc_meta}


@app.get('/api/documents')
async def list_documents():
    return {"success": True, "documents": DOCUMENTS, "total": len(DOCUMENTS)}


@app.delete('/api/documents/{doc_id}')
async def delete_document(doc_id: str):
    global DOCUMENTS
    DOCUMENTS = [doc for doc in DOCUMENTS if doc['id'] != doc_id]
    return {"success": True}


@app.post('/api/generate/outline')
async def generate_outline_endpoint(payload: DocumentIdsRequest):
    all_chunks = []
    if payload.userPrompt:
        result = retrieve_relevant_chunks(payload.userPrompt, payload.documentIds, top_k=16, hybrid=True)
        all_chunks = result['chunks']
    else:
        for doc_id in payload.documentIds:
            result = get_diverse_chunks(doc_id, 'priority')
            all_chunks.extend(result['chunks'])

    outline = generate_outline(all_chunks, payload.userPrompt)
    return {"success": True, "outline": outline}


@app.post('/api/workflow/generate-json')
async def generate_json(payload: DocumentIdsRequest):
    all_chunks = []
    if payload.userPrompt:
        result = retrieve_relevant_chunks(payload.userPrompt, payload.documentIds, top_k=20, hybrid=True)
        all_chunks = result['chunks']
    else:
        for doc_id in payload.documentIds:
            result = get_diverse_chunks(doc_id, 'priority')
            all_chunks.extend(result['chunks'])

    presentation = generate_editable_presentation_json(all_chunks, payload.userPrompt)
    image_prompts = extract_image_prompts(presentation)
    return {"success": True, "presentation": presentation, "imagePrompts": image_prompts}


@app.post('/api/workflow/generate-images')
async def generate_images(payload: GenerateImagesRequest):
    results = batch_generate_images(payload.imagePrompts)
    generated = {}
    failures = []
    for result in results:
        if result.get('success') and result.get('dataUrl'):
            generated[result['placeholderId']] = {
                "data": result['dataUrl'],
                "mimeType": result.get('mimeType'),
                "prompt": result.get('prompt'),
            }
        else:
            failures.append({
                "placeholderId": result.get('placeholderId'),
                "error": result.get('error', 'Unknown error'),
            })
    return {"success": len(failures) == 0, "images": generated, "failures": failures}


@app.post('/api/workflow/create-pptx')
async def create_pptx(payload: CreatePptxRequest):
    pptx = create_editable_pptx(payload.presentation, payload.images or {})
    filename = f"presentation_{int(os.times().elapsed)}.pptx"
    save_pptx(pptx, filename)
    return {
        "success": True,
        "filename": filename,
        "downloadUrl": f"/api/workflow/download/{filename}",
    }


@app.get('/api/workflow/download/{filename}')
async def download_pptx(filename: str):
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath, filename=filename)
