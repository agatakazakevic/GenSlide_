from typing import List, Dict, Any, Tuple
import os
import re
from .pdf_service import process_pdf_to_chunks
from .gemini_service import generate_embedding, generate_embeddings_batch
from .pgvector_service import create_collection, store_document_chunks, search_similar_chunks, get_document_chunks


def _collection_name(document_id: str) -> str:
    return f"doc_{document_id.replace('doc_', '')}"


def index_document(file_path: str, document_id: str, document_name: str) -> Dict[str, Any]:
    pdf_data = process_pdf_to_chunks(
        file_path,
        {
            "chunkSize": 800,
            "overlap": 100,
            "extractSectionsFlag": True,
        },
    )

    collection_name = _collection_name(document_id)
    create_collection(collection_name, 768)

    texts = [chunk["text"] for chunk in pdf_data["chunks"]]
    embeddings = generate_embeddings_batch(texts)

    store_document_chunks(
        collection_name,
        pdf_data["chunks"],
        embeddings,
        {
            "documentId": document_id,
            "documentName": document_name,
        },
    )

    return {
        "success": True,
        "documentId": document_id,
        "collectionName": collection_name,
        "chunksIndexed": pdf_data["totalChunks"],
        "numPages": pdf_data["numPages"],
        "sections": pdf_data["sections"],
        "metadata": pdf_data["metadata"],
    }


def retrieve_relevant_chunks(
    query: str,
    document_ids: List[str],
    top_k: int = 10,
    hybrid: bool = True,
) -> Dict[str, Any]:
    """Hybrid retrieval: vector search + keyword overlap rerank."""
    query_embedding = generate_embedding(query)
    all_results: List[Dict[str, Any]] = []
    vector_k = max(top_k * 3, 12)

    for doc_id in document_ids:
        collection_name = _collection_name(doc_id)
        try:
            results = search_similar_chunks(collection_name, query_embedding, vector_k)
            all_results.extend(results)
        except Exception:
            continue

    if not hybrid:
        sorted_results = sorted(all_results, key=lambda r: r["score"], reverse=True)[:top_k]
        return {"query": query, "chunks": sorted_results, "totalResults": len(all_results)}

    keyword_results = _keyword_filter_chunks(query, document_ids, top_k=top_k * 2)
    merged = _merge_hybrid_results(query, all_results, keyword_results, top_k=top_k)
    return {"query": query, "chunks": merged, "totalResults": len(all_results) + len(keyword_results)}


def _keyword_filter_chunks(query: str, document_ids: List[str], top_k: int = 20) -> List[Dict[str, Any]]:
    query_tokens = _keywords(query)
    if not query_tokens:
        return []
    scored: List[Tuple[float, Dict[str, Any]]] = []
    for doc_id in document_ids:
        collection_name = _collection_name(doc_id)
        try:
            chunks = get_document_chunks(collection_name, doc_id)
        except Exception:
            continue
        for chunk in chunks:
            score = _keyword_score(query_tokens, chunk.get("text", ""))
            if score <= 0:
                continue
            scored.append((score, chunk))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [c for _, c in scored[:top_k]]


def _merge_hybrid_results(
    query: str,
    vector_results: List[Dict[str, Any]],
    keyword_results: List[Dict[str, Any]],
    top_k: int = 10,
) -> List[Dict[str, Any]]:
    query_tokens = _keywords(query)
    vector_weight = float(os.getenv("RAG_HYBRID_VECTOR_WEIGHT", "0.7"))
    keyword_weight = float(os.getenv("RAG_HYBRID_KEYWORD_WEIGHT", "0.3"))

    combined: Dict[str, Dict[str, Any]] = {}
    for item in vector_results:
        key = str(item.get("id") or f"{item.get('metadata', {}).get('documentId')}:{item.get('metadata', {}).get('chunkIndex')}")
        combined[key] = {**item, "score_vector": item.get("score", 0.0), "score_keyword": 0.0}

    for item in keyword_results:
        key = str(item.get("id") or f"{item.get('metadata', {}).get('documentId')}:{item.get('metadata', {}).get('chunkIndex')}")
        score_kw = _keyword_score(query_tokens, item.get("text", ""))
        if key in combined:
            combined[key]["score_keyword"] = max(combined[key].get("score_keyword", 0.0), score_kw)
        else:
            combined[key] = {**item, "score_vector": 0.0, "score_keyword": score_kw, "score": 0.0}

    ranked = []
    for item in combined.values():
        score_vec = float(item.get("score_vector", 0.0))
        score_kw = float(item.get("score_keyword", 0.0))
        item["score"] = (vector_weight * score_vec) + (keyword_weight * score_kw)
        ranked.append(item)

    ranked.sort(key=lambda r: r["score"], reverse=True)
    return ranked[:top_k]


def _keywords(text: str) -> List[str]:
    tokens = re.findall(r"[a-zA-Z0-9%]+", text.lower())
    stopwords = {
        "the", "and", "for", "with", "from", "this", "that", "these", "those",
        "into", "over", "under", "about", "your", "you", "are", "was", "were",
        "has", "have", "had", "will", "can", "could", "should", "would", "may",
        "might", "not", "but", "use", "using", "used", "based", "create",
        "document", "presentation", "slide", "deck", "data", "info", "information",
    }
    return [t for t in tokens if t not in stopwords and len(t) > 2]


def _keyword_score(query_tokens: List[str], text: str) -> float:
    if not query_tokens or not text:
        return 0.0
    text_tokens = set(re.findall(r"[a-zA-Z0-9%]+", text.lower()))
    overlap = set(query_tokens).intersection(text_tokens)
    return float(len(overlap)) / float(len(set(query_tokens)) or 1)


def get_all_document_chunks(document_id: str) -> Dict[str, Any]:
    collection_name = _collection_name(document_id)
    chunks = get_document_chunks(collection_name, document_id)
    return {"documentId": document_id, "chunks": chunks, "totalChunks": len(chunks)}


def get_diverse_chunks(document_id: str, sampling_strategy: str = 'distributed') -> Dict[str, Any]:
    all_chunks = get_all_document_chunks(document_id)
    chunks = all_chunks["chunks"]

    if sampling_strategy == 'distributed':
        interval = max(1, len(chunks) // 20)
        sampled = [chunk for idx, chunk in enumerate(chunks) if idx % interval == 0]
        return {
            "documentId": document_id,
            "chunks": sampled,
            "strategy": 'distributed',
            "totalChunks": all_chunks["totalChunks"],
        }

    if sampling_strategy == 'priority':
        beginning = chunks[:10]
        end = chunks[-5:]
        middle = [
            chunk
            for chunk in chunks[10:-5]
            if (chunk["metadata"].get("sectionTitle") or '').lower() in {
                'key',
                'important',
                'summary',
            }
        ]
        return {
            "documentId": document_id,
            "chunks": beginning + middle + end,
            "strategy": 'priority',
            "totalChunks": all_chunks["totalChunks"],
        }

    return all_chunks
