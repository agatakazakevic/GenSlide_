import re
import pdfplumber
from typing import List, Dict, Any


def _chunk_text(text: str, chunk_size: int = 1000, overlap: int = 100) -> List[str]:
    sentences = re.findall(r"[^.!?]+[.!?]+", text) or [text]
    chunks = []
    current = ""
    current_size = 0

    for sentence in sentences:
        sentence_size = len(sentence.split())
        if current_size + sentence_size > chunk_size and current:
            chunks.append(current.strip())
            words = current.split()
            current = " ".join(words[-overlap:]) + " "
            current_size = overlap
        current += sentence + " "
        current_size += sentence_size

    if current.strip():
        chunks.append(current.strip())

    return chunks


def _extract_sections(text: str) -> List[Dict[str, Any]]:
    sections = []
    header_patterns = [
        re.compile(r"^#{1,3}\s+(.+)$", re.MULTILINE),
        re.compile(r"^([A-Z][A-Za-z\s]+):\s*$", re.MULTILINE),
        re.compile(r"^\d+\.\s+([A-Z].+)$", re.MULTILINE),
    ]

    for pattern in header_patterns:
        for match in pattern.finditer(text):
            sections.append({"title": match.group(1).strip(), "start": match.start()})

    if not sections:
        return [{"title": "Document Content", "content": text, "start": 0}]

    sections = sorted(sections, key=lambda s: s["start"])
    enriched = []
    for idx, section in enumerate(sections):
        start = section["start"]
        end = sections[idx + 1]["start"] if idx + 1 < len(sections) else len(text)
        enriched.append({
            "title": section["title"],
            "content": text[start:end],
            "start": start,
        })
    return enriched


def parse_pdf(file_path: str) -> Dict[str, Any]:
    with pdfplumber.open(file_path) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
        text = "\n".join(pages)
        metadata = pdf.metadata or {}

    return {
        "text": text,
        "num_pages": len(pages),
        "metadata": {
            "title": metadata.get("Title") or "Untitled",
            "author": metadata.get("Author") or "Unknown",
            "creationDate": metadata.get("CreationDate"),
        },
    }


def process_pdf_to_chunks(file_path: str, options: Dict[str, Any]) -> Dict[str, Any]:
    chunk_size = options.get("chunkSize", 1000)
    overlap = options.get("overlap", 100)
    extract_sections_flag = options.get("extractSectionsFlag", True)

    pdf_data = parse_pdf(file_path)
    text = pdf_data["text"]

    if extract_sections_flag:
        sections = _extract_sections(text)
    else:
        sections = [{"title": "Content", "content": text, "start": 0}]

    all_chunks = []
    global_index = 0
    for section in sections:
        section_chunks = _chunk_text(section["content"], chunk_size, overlap)
        for idx, chunk in enumerate(section_chunks):
            all_chunks.append({
                "text": chunk,
                "metadata": {
                    "chunkIndex": global_index,
                    "sectionTitle": section["title"],
                    "sectionChunkIndex": idx,
                    "totalSectionChunks": len(section_chunks),
                    "page": int((section["start"] / max(len(text), 1)) * pdf_data["num_pages"]) + 1,
                },
            })
            global_index += 1

    return {
        "chunks": all_chunks,
        "totalChunks": len(all_chunks),
        "numPages": pdf_data["num_pages"],
        "metadata": pdf_data["metadata"],
        "sections": [
            {
                "title": section["title"],
                "chunkCount": len(_chunk_text(section["content"], chunk_size, overlap)),
            }
            for section in sections
        ],
    }


def extract_key_info(file_path: str) -> Dict[str, Any]:
    pdf_data = parse_pdf(file_path)
    text = pdf_data["text"]

    return {
        "title": pdf_data["metadata"]["title"],
        "author": pdf_data["metadata"]["author"],
        "numPages": pdf_data["num_pages"],
        "wordCount": len(text.split()),
        "emails": list(set(re.findall(r"[\w.-]+@[\w.-]+\.\w+", text))),
        "urls": list(set(re.findall(r"https?://[^\s]+", text))),
        "dates": list(set(re.findall(r"\d{1,2}/\d{1,2}/\d{2,4}|\d{4}-\d{2}-\d{2}", text))),
        "numbers": list(set(re.findall(r"\$?[\d,]+\.?\d*%?", text)))[:20],
        "sections": [section["title"] for section in _extract_sections(text)],
        "preview": text[:500] + "...",
    }


def validate_pdf(file_path: str, max_size_mb: int = 10) -> Dict[str, Any]:
    import os
    size = os.path.getsize(file_path)
    if size > max_size_mb * 1024 * 1024:
        return {"valid": False, "error": "File size exceeds 10MB limit"}
    parse_pdf(file_path)
    return {"valid": True, "size": size}
