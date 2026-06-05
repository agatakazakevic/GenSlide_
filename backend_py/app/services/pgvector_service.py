import os
from typing import List, Dict, Any
from uuid import uuid4

from sqlalchemy import Column, Integer, Text, JSON, create_engine, select, text as sql_text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector

VECTOR_SIZE = int(os.getenv("PGVECTOR_DIM", "768"))
DATABASE_URL = os.getenv("DATABASE_URL", "")

Base = declarative_base()
engine = create_engine(DATABASE_URL, pool_pre_ping=True) if DATABASE_URL else None
SessionLocal = sessionmaker(bind=engine) if engine else None


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_id = Column(Text, index=True)
    document_name = Column(Text)
    chunk_index = Column(Integer)
    page = Column(Integer)
    text = Column(Text)
    metadata_json = Column("metadata", JSON)
    embedding = Column(Vector(VECTOR_SIZE))


def _ensure_db():
    if not engine:
        raise RuntimeError("DATABASE_URL is not configured")
    with engine.begin() as conn:
        conn.execute(sql_text("CREATE EXTENSION IF NOT EXISTS vector"))
        Base.metadata.create_all(bind=conn)


def create_collection(collection_name: str, vector_size: int = VECTOR_SIZE) -> Dict[str, Any]:
    _ensure_db()
    return {"success": True, "exists": True}


def store_document_chunks(
    collection_name: str,
    chunks: List[Dict[str, Any]],
    embeddings: List[List[float]],
    metadata: Dict[str, Any],
) -> Dict[str, Any]:
    _ensure_db()
    if SessionLocal is None:
        raise RuntimeError("DATABASE_URL is not configured")

    document_id = metadata.get("documentId")
    document_name = metadata.get("documentName")

    with SessionLocal() as session:
        if document_id:
            session.query(KnowledgeChunk).filter(KnowledgeChunk.document_id == document_id).delete()
            session.commit()

        for idx, chunk in enumerate(chunks):
            session.add(
                KnowledgeChunk(
                    id=uuid4(),
                    document_id=document_id,
                    document_name=document_name,
                    chunk_index=idx,
                    page=chunk.get("page", 0),
                    text=chunk.get("text", ""),
                    metadata_json=chunk.get("metadata", {}),
                    embedding=embeddings[idx],
                )
            )
        session.commit()

    return {"success": True, "chunksStored": len(chunks), "collectionName": collection_name}


def search_similar_chunks(collection_name: str, query_embedding: List[float], top_k: int = 10) -> List[Dict[str, Any]]:
    _ensure_db()
    if SessionLocal is None:
        raise RuntimeError("DATABASE_URL is not configured")

    document_id = collection_name
    with SessionLocal() as session:
        stmt = (
            select(KnowledgeChunk)
            .where(KnowledgeChunk.document_id == document_id)
            .order_by(KnowledgeChunk.embedding.cosine_distance(query_embedding))
            .limit(top_k)
        )
        rows = session.execute(stmt).scalars().all()

    return [
        {
            "id": row.id,
            "score": 1.0,  # Cosine distance ordering; score is not normalized
            "text": row.text,
            "metadata": {
                "documentId": row.document_id,
                "documentName": row.document_name,
                "page": row.page,
                "chunkIndex": row.chunk_index,
            },
        }
        for row in rows
    ]


def get_document_chunks(collection_name: str, document_id: str) -> List[Dict[str, Any]]:
    _ensure_db()
    if SessionLocal is None:
        raise RuntimeError("DATABASE_URL is not configured")

    target_id = document_id or collection_name
    with SessionLocal() as session:
        rows = (
            session.query(KnowledgeChunk)
            .filter(KnowledgeChunk.document_id == target_id)
            .order_by(KnowledgeChunk.chunk_index.asc())
            .all()
        )

    return [
        {
            "id": row.id,
            "text": row.text,
            "metadata": {
                "page": row.page,
                "chunkIndex": row.chunk_index,
                "documentName": row.document_name,
            },
        }
        for row in rows
    ]


def health_check() -> Dict[str, Any]:
    try:
        _ensure_db()
        return {"status": "healthy", "message": "Postgres pgvector ready"}
    except Exception as exc:  # noqa: BLE001
        return {"status": "unhealthy", "message": str(exc)}
