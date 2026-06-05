"""
RAG service — hybrid local-file + PostgreSQL/pgvector retrieval.
Extracts text, chunks it, and retrieves top matches by keyword overlap
and (optionally) vector similarity from a remote database.
"""

from __future__ import annotations

import hashlib
import json as _json
import os
import re
import sys
from dataclasses import dataclass
from typing import List, Dict, Any, Tuple

import aiohttp
from PyPDF2 import PdfReader

try:
    import psycopg2
    import psycopg2.extras
    _HAS_PSYCOPG2 = True
except ImportError:
    _HAS_PSYCOPG2 = False

# Stopwords removed from both query and chunk tokens during scoring.
# Keeps domain keywords (market, revenue, growth…) but strips grammar words.
_STOPWORDS = frozenset({
    "the", "and", "for", "with", "from", "this", "that", "these", "those",
    "into", "over", "under", "about", "your", "you", "are", "was", "were",
    "has", "have", "had", "will", "can", "could", "should", "would", "may",
    "might", "not", "but", "also", "its", "their", "our", "which", "when",
    "where", "what", "how", "who", "all", "each", "any", "both", "some",
    "such", "than", "then", "them", "they", "been", "being", "other",
    "more", "most", "very", "just", "only", "own", "same", "through",
    "during", "before", "after", "between", "does", "did", "doing",
    "including", "include", "included", "includes",
})


@dataclass
class RagChunk:
    text: str
    source: str
    score: float = 0.0


class RagService:
    last_stats: Dict[str, Any] = {}

    def __init__(self, upload_dir: str, chunk_size: int = 1200, overlap: int = 200):
        self.upload_dir = upload_dir
        self.chunk_size = chunk_size
        self.overlap = overlap
        self._cache_signature: List[Tuple[str, float, int]] = []
        self._cache_chunks: List[RagChunk] = []
        self.enable_local_vector = os.getenv("ENABLE_LOCAL_EMBED_RAG", "").lower() in {"1", "true", "yes"}
        self.local_embed_candidates = int(os.getenv("LOCAL_EMBED_CANDIDATES", "40"))
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.embed_model = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small")
        self.vector_weight = float(os.getenv("RAG_HYBRID_VECTOR_WEIGHT", "0.7"))
        self.keyword_weight = float(os.getenv("RAG_HYBRID_KEYWORD_WEIGHT", "0.3"))

        # PostgreSQL / pgvector connection
        self.database_url = os.getenv("DATABASE_URL", "")
        self._db_conn = None
        self.gemini_embed_model = self._normalize_model_name(
            os.getenv("GEMINI_EMBEDDING_MODEL", "text-embedding-004")
        )
        # Accept either key name to match Node and Python configs.
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "") or os.getenv("GOOGLE_API_KEY", "")
        self._resolved_embed_model: str | None = None
        self._resolved_embed_api_version: str | None = None
        self._db_vector_dim: int | None = None
        if self.database_url and _HAS_PSYCOPG2:
            try:
                self._db_conn = psycopg2.connect(self.database_url)
                self._db_conn.autocommit = True
                print(f"✅ RAG: Connected to PostgreSQL database")
            except Exception as exc:
                print(f"⚠️  RAG: PostgreSQL connection failed: {exc}")
                self._db_conn = None
        elif self.database_url and not _HAS_PSYCOPG2:
            print(
                "⚠️  RAG: DATABASE_URL is set but psycopg2 is not installed in the "
                f"active interpreter ({sys.executable}). Install psycopg2-binary in this venv."
            )
        elif not self.database_url:
            print("ℹ️  RAG: DATABASE_URL is not set; DB-backed retrieval is disabled.")

    @classmethod
    def get_last_stats(cls) -> Dict[str, Any]:
        return cls.last_stats

    def build_index(self) -> List[RagChunk]:
        files = self._list_files(self.upload_dir)
        signature = [(f, os.path.getmtime(f), os.path.getsize(f)) for f in files]
        if signature == self._cache_signature and self._cache_chunks:
            return self._cache_chunks

        # Deduplicate identical files by content hash
        seen_hashes: Dict[str, str] = {}  # hash → first filename
        unique_files: List[str] = []
        for path in files:
            try:
                h = hashlib.md5(open(path, "rb").read()).hexdigest()
            except OSError:
                h = path  # fallback: treat as unique
            if h not in seen_hashes:
                seen_hashes[h] = os.path.basename(path)
                unique_files.append(path)
            else:
                print(f"📄 RAG: skipping duplicate {os.path.basename(path)} (same as {seen_hashes[h]})")

        chunks: List[RagChunk] = []
        seen_texts: set[str] = set()
        for path in unique_files:
            # For PDFs, use page-aware chunking to preserve page boundaries
            if path.lower().endswith(".pdf"):
                pages = self._extract_pdf_pages(path)
                raw_chunks = self._chunk_text("", page_texts=pages) if pages else []
            else:
                text = self._extract_text(path)
                raw_chunks = self._chunk_text(text)
            for chunk in raw_chunks:
                stripped = chunk.strip()
                if stripped and stripped not in seen_texts:
                    seen_texts.add(stripped)
                    chunks.append(RagChunk(text=stripped, source=os.path.basename(path)))

        print(f"\n{'='*70}")
        print(f"📄 RAG INDEX BUILT")
        print(f"   Upload dir : {self.upload_dir}")
        print(f"   Dir exists : {os.path.isdir(self.upload_dir)}")
        print(f"   Files found: {len(files)} total, {len(unique_files)} unique")
        for uf in unique_files:
            print(f"     • {os.path.basename(uf)} ({os.path.getsize(uf)/1024:.0f} KB)")
        print(f"   Chunks     : {len(chunks)}")
        print(f"   Chunk size : {self.chunk_size} chars, overlap: {self.overlap}")
        print(f"   Vector RAG : {'enabled' if self.enable_local_vector else 'disabled (keyword-only)'}")
        if not files:
            print(f"   ⚠️  No files found! Supported: .pdf, .txt, .md")
        print(f"{'='*70}\n")
        self._cache_signature = signature
        self._cache_chunks = chunks
        return chunks

    def retrieve(self, query: str, chunks: List[RagChunk], top_k: int = 6) -> List[RagChunk]:
        if not query or not chunks:
            return []
        q_tokens = self._tokenize(query)
        scored = []
        for chunk in chunks:
            c_tokens = self._tokenize(chunk.text)
            if not c_tokens:
                continue
            score = self._overlap_score(q_tokens, c_tokens, chunk_text=chunk.text)
            if score <= 0:
                continue
            scored.append(RagChunk(text=chunk.text, source=chunk.source, score=score))
        scored.sort(key=lambda c: c.score, reverse=True)
        return scored[:top_k]

    async def retrieve_combined(
        self,
        query: str,
        user_id: int | None,
        top_k: int = 6,
        require_numbers: bool = False,
    ) -> List[RagChunk]:
        # Log only a short prefix of the query to reduce log spam
        short_q = (query or "")[:120].replace("\n", " ")
        index = self.build_index()
        local_top_k = max(top_k * 3, top_k)
        q_tokens = self._tokenize(query)

        file_chunks = self.retrieve(query, index, top_k=local_top_k)

        db_method = "none"
        db_raw_chunks: List[RagChunk] = []
        db_ranked_chunks: List[RagChunk] = []
        if self._db_conn:
            db_raw_chunks = await self._retrieve_db_vector(query, user_id, top_k=local_top_k)
            if db_raw_chunks:
                db_method = "vector"
            else:
                db_raw_chunks = self._retrieve_db_keyword(query, user_id, top_k=local_top_k)
                if db_raw_chunks:
                    db_method = "keyword"

            # Normalize DB scores to [0..1] and blend with keyword overlap for robustness.
            for chunk in db_raw_chunks:
                base_score = float(chunk.score or 0.0)
                overlap = self._overlap_score(q_tokens, self._tokenize(chunk.text), chunk_text=chunk.text)
                if db_method == "vector":
                    if base_score < 0.0:
                        vector_norm = max(0.0, min(1.0, (base_score + 1.0) / 2.0))
                    else:
                        vector_norm = max(0.0, min(1.0, base_score))
                    final_score = (0.75 * vector_norm) + (0.25 * overlap)
                else:
                    final_score = overlap if overlap > 0 else max(0.0, min(1.0, base_score))
                db_ranked_chunks.append(
                    RagChunk(text=chunk.text, source=chunk.source, score=final_score)
                )
            db_ranked_chunks.sort(key=lambda c: c.score, reverse=True)
        else:
            print("   DB source  : unavailable (no PostgreSQL connection)")

        print(f"\n{'─'*70}")
        print(f"🔎 RAG RETRIEVE: \"{short_q}\"")
        print(f"   Index size : {len(index)} chunks")
        print(f"   File match : {len(file_chunks)} (keyword top-{local_top_k})")
        file_vector_scores: Dict[Tuple[str, str], float] = {}
        if self.enable_local_vector:
            file_vector_scores = await self._score_file_chunks_vector(query, file_chunks)
            print(f"   Vector scores: {len(file_vector_scores)} computed")
        local_ranked = self._merge_local(
            file_chunks,
            file_vector_scores=file_vector_scores,
            top_k=local_top_k,
        )
        print(f"   File ranked: {len(local_ranked)}")
        if self._db_conn:
            print(
                f"   DB source  : method={db_method} raw={len(db_raw_chunks)} ranked={len(db_ranked_chunks)}"
            )
            for i, chunk in enumerate(db_ranked_chunks[:3], 1):
                preview = " ".join(chunk.text.split())[:140]
                print(
                    f"     DB[{i}] score={chunk.score:.3f} src={chunk.source} \"{preview}...\""
                )

        # Merge local + DB chunks and deduplicate by text content.
        dedup: Dict[str, RagChunk] = {}
        for chunk in local_ranked + db_ranked_chunks:
            key = hashlib.md5(chunk.text.encode("utf-8", errors="ignore")).hexdigest()
            existing = dedup.get(key)
            if existing is None or chunk.score > existing.score:
                dedup[key] = chunk

        merged = sorted(dedup.values(), key=lambda c: c.score, reverse=True)[:top_k]
        print(f"   Final top-{top_k}: {len(merged)} chunks returned")
        for i, chunk in enumerate(merged, 1):
            preview = " ".join(chunk.text.split())[:150]
            numerics = self._extract_numerics(chunk.text)
            num_str = f" | numerics: {numerics[:3]}" if numerics else ""
            print(f"   [{i}] score={chunk.score:.3f} src={chunk.source}")
            print(f"       \"{preview}...\"")
            if num_str:
                print(f"       {num_str}")
        if not merged:
            print(f"   ⚠️  No chunks matched query! Check upload dir: {self.upload_dir}")
        print(f"{'─'*70}\n")
        RagService.last_stats = {
            "query": query,
            "user_id": user_id,
            "file_chunks": len(file_chunks),
            "file_chunks_ranked": len(local_ranked),
            "db_method": db_method,
            "db_chunks": len(db_raw_chunks),
            "db_chunks_ranked": len(db_ranked_chunks),
            "db_connected": bool(self._db_conn),
            "total_chunks": len(merged),
            "returned_chunks": [
                {
                 "source": c.source,
                 "source_type": "db" if str(c.source).startswith("db:") else "file",
                 "score": round(c.score, 3),
                 "preview": " ".join(c.text.split())[:200]}
                for c in merged
            ],
            "local_vector_enabled": self.enable_local_vector,
        }
        return merged

    def format_evidence(self, chunks: List[RagChunk]) -> str:
        lines = []
        all_numerics: List[str] = []
        for idx, chunk in enumerate(chunks, 1):
            snippet = " ".join(chunk.text.split())[:600]
            lines.append(f"[{idx}] {snippet} (source: {chunk.source})")
            # Extract structured numeric data from this chunk
            numerics = self._extract_numerics(chunk.text)
            if numerics:
                all_numerics.extend(f"[{idx}] {n}" for n in numerics)
        result = "\n".join(lines)
        if all_numerics:
            result += "\n\nEXTRACTED NUMERIC DATA (use these exact values for charts/tables):\n"
            # Deduplicate while preserving order
            seen = set()
            for n in all_numerics:
                if n not in seen:
                    seen.add(n)
                    result += f"  • {n}\n"
        return result

    # ── PostgreSQL / pgvector retrieval ─────────────────────────────────

    def _retrieve_db_keyword(
        self, query: str, user_id: int | str | None, top_k: int = 6
    ) -> List[RagChunk]:
        """Retrieve chunks from PostgreSQL using keyword matching."""
        if not self._db_conn:
            return []
        keywords = self._tokenize(query)
        if not keywords:
            return []
        # Build a WHERE clause that matches any keyword in content
        like_clauses = " OR ".join(
            f"LOWER(content) LIKE %s" for _ in keywords[:10]
        )
        params = [f"%{kw.lower()}%" for kw in keywords[:10]]
        sql = f"""
            SELECT id, document_id, user_id, content, metadata
            FROM knowledge_chunks
            WHERE ({like_clauses})
            ORDER BY created_at DESC
            LIMIT %s
        """
        params.append(top_k * 3)
        try:
            cur = self._db_conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
            cur.execute(sql, params)
            rows = cur.fetchall()
            cur.close()
        except Exception as exc:
            print(f"⚠️  RAG DB keyword query failed: {exc}")
            # Reconnect on next attempt
            try:
                self._db_conn = psycopg2.connect(self.database_url)
                self._db_conn.autocommit = True
            except Exception:
                self._db_conn = None
            return []

        chunks: List[RagChunk] = []
        for row in rows:
            text = row["content"] or ""
            if not text.strip():
                continue
            meta = row["metadata"] or {}
            doc_name = meta.get("documentName", "") or meta.get("document_name", "") or row["document_id"]
            score = self._overlap_score(keywords, self._tokenize(text), chunk_text=text)
            if score > 0:
                chunks.append(RagChunk(text=text.strip(), source=f"db:{doc_name}", score=score))
        chunks.sort(key=lambda c: c.score, reverse=True)
        return chunks[:top_k]

    async def _retrieve_db_vector(
        self, query: str, user_id: int | str | None, top_k: int = 6
    ) -> List[RagChunk]:
        """Retrieve chunks from PostgreSQL using pgvector cosine similarity."""
        if not self._db_conn or not self.gemini_api_key:
            return []
        db_dim = self._get_db_vector_dim()
        query_embedding = await self._embed_gemini(query, output_dimensionality=db_dim)
        if not query_embedding:
            return []
        if db_dim and len(query_embedding) != db_dim:
            # Last-resort guard: keep DB query operational even if provider ignores outputDimensionality.
            query_embedding = self._coerce_embedding_dimension(query_embedding, db_dim)
            print(
                f"⚠️  Gemini embedding dimension adjusted to match DB: "
                f"{len(query_embedding)} (target={db_dim})"
            )
        embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"
        sql = """
            SELECT id, document_id, user_id, content, metadata,
                   1 - (embedding <=> %s::vector) AS similarity
            FROM knowledge_chunks
            ORDER BY embedding <=> %s::vector
            LIMIT %s
        """
        try:
            cur = self._db_conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
            cur.execute(sql, (embedding_str, embedding_str, top_k))
            rows = cur.fetchall()
            cur.close()
        except Exception as exc:
            print(f"⚠️  RAG DB vector query failed: {exc}")
            try:
                self._db_conn = psycopg2.connect(self.database_url)
                self._db_conn.autocommit = True
            except Exception:
                self._db_conn = None
            return []

        chunks: List[RagChunk] = []
        for row in rows:
            text = row["content"] or ""
            if not text.strip():
                continue
            meta = row["metadata"] or {}
            doc_name = meta.get("documentName", "") or meta.get("document_name", "") or row["document_id"]
            sim = float(row["similarity"])
            chunks.append(RagChunk(text=text.strip(), source=f"db:{doc_name}", score=sim))
        return chunks

    async def _embed_gemini(self, text: str, output_dimensionality: int | None = None) -> List[float]:
        """Generate an embedding using Gemini API."""
        if not self.gemini_api_key:
            return []
        # First try the last-known working endpoint/model.
        candidates: List[tuple[str, str, int | None]] = []
        dim_options: List[int | None] = []
        if output_dimensionality and output_dimensionality > 0:
            dim_options.append(int(output_dimensionality))
        dim_options.append(None)

        if self._resolved_embed_model and self._resolved_embed_api_version:
            for dim in dim_options:
                candidates.append((self._resolved_embed_api_version, self._resolved_embed_model, dim))

        model_candidates = self._embedding_model_candidates()
        for model_name in model_candidates:
            for dim in dim_options:
                candidates.append(("v1beta", model_name, dim))
                candidates.append(("v1", model_name, dim))

        seen: set[tuple[str, str, int | None]] = set()
        errors: List[str] = []
        async with aiohttp.ClientSession() as session:
            for api_version, model_name, dim in candidates:
                key = (api_version, model_name, dim)
                if key in seen:
                    continue
                seen.add(key)
                values, status, body = await self._call_gemini_embed(
                    session=session,
                    text=text,
                    model_name=model_name,
                    api_version=api_version,
                    output_dimensionality=dim,
                )
                if values:
                    if (
                        model_name != self.gemini_embed_model
                        or api_version != "v1beta"
                        or dim != output_dimensionality
                    ):
                        print(
                            "ℹ️  Gemini embed fallback in use: "
                            f"model={model_name} api={api_version} dim={len(values)}"
                        )
                    self._resolved_embed_model = model_name
                    self._resolved_embed_api_version = api_version
                    return values
                errors.append(f"{api_version}:{model_name}:dim={dim}:{status}")
                # For auth/quota style failures, trying more models is usually pointless.
                if status in {401, 403, 429}:
                    break
                # Continue on model/version mismatch.
                if status == 404:
                    continue

        if errors:
            print(
                "⚠️  Gemini embed unavailable after fallbacks. "
                f"Tried {len(errors)} endpoint(s): {', '.join(errors[:6])}"
            )
        return []

    async def _call_gemini_embed(
        self,
        session: aiohttp.ClientSession,
        text: str,
        model_name: str,
        api_version: str,
        output_dimensionality: int | None = None,
    ) -> tuple[List[float], int, str]:
        """Call Gemini embedContent endpoint for one model/version pair."""
        url = (
            f"https://generativelanguage.googleapis.com/{api_version}/models/"
            f"{model_name}:embedContent?key={self.gemini_api_key}"
        )
        payload = {
            "model": f"models/{model_name}",
            "content": {"parts": [{"text": text}]},
        }
        if output_dimensionality and output_dimensionality > 0:
            payload["outputDimensionality"] = int(output_dimensionality)
        try:
            async with session.post(
                url,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                if resp.status >= 400:
                    body = await resp.text()
                    msg = body.replace("\n", " ")[:220]
                    print(
                        f"⚠️  Gemini embed failed ({resp.status}) "
                        f"model={model_name} api={api_version} dim={output_dimensionality}: {msg}"
                    )
                    return [], resp.status, msg
                data = await resp.json()
                values = data.get("embedding", {}).get("values", [])
                return values or [], resp.status, ""
        except Exception as exc:
            print(
                f"⚠️  Gemini embed error model={model_name} api={api_version} "
                f"dim={output_dimensionality}: {exc}"
            )
            return [], 0, str(exc)

    def _get_db_vector_dim(self) -> int | None:
        """Detect pgvector dimension from knowledge_chunks.embedding."""
        if self._db_vector_dim:
            return self._db_vector_dim
        if not self._db_conn:
            return None
        try:
            cur = self._db_conn.cursor()
            cur.execute(
                """
                SELECT vector_dims(embedding)
                FROM knowledge_chunks
                WHERE embedding IS NOT NULL
                LIMIT 1
                """
            )
            row = cur.fetchone()
            cur.close()
            if row and row[0]:
                self._db_vector_dim = int(row[0])
                print(f"ℹ️  RAG DB vector dimension detected: {self._db_vector_dim}")
                return self._db_vector_dim
        except Exception as exc:
            print(f"⚠️  Could not detect DB vector dimension: {exc}")
        return None

    @staticmethod
    def _coerce_embedding_dimension(values: List[float], target_dim: int) -> List[float]:
        if target_dim <= 0:
            return values
        if len(values) == target_dim:
            return values
        if len(values) > target_dim:
            return values[:target_dim]
        # pad short vectors with zeros
        return values + [0.0] * (target_dim - len(values))

    @staticmethod
    def _normalize_model_name(name: str) -> str:
        return str(name or "").replace("models/", "").strip()

    def _embedding_model_candidates(self) -> List[str]:
        candidates = [
            self.gemini_embed_model,
            "gemini-embedding-001",
            "text-embedding-004",
            "embedding-001",
        ]
        deduped: List[str] = []
        seen = set()
        for model_name in candidates:
            norm = self._normalize_model_name(model_name)
            if not norm or norm in seen:
                continue
            seen.add(norm)
            deduped.append(norm)
        return deduped

    # Shared unit vocabularies for _extract_numerics
    _CURRENCY_SYMBOLS = r"[\$¥€£₹₩]"
    _CURRENCY_CODES = (
        r"(?:USD|JPY|EUR|GBP|INR|CNY|RMB|KRW|AUD|CAD|CHF|SGD|HKD|Rs|R\$)"
    )
    _SCALE_WORDS = r"(?:trillion|billion|million|thousand|crore|lakh)"
    _SCALE_ABBR = r"(?:tn|bn|mn|cr|[TBMK])"
    # Korean scale words: 억 (100M), 조 (1T), 만 (10K)
    _KOREAN_SCALE = r"(?:억\s*원|조\s*원|만\s*원|억|조|만)"
    _PEOPLE_UNITS = (
        r"(?:employees|subscribers|users|customers|patients|people|members"
        r"|households|accounts|stores|sites|factories|countries|명)"  # 명 = people in Korean
    )
    _INDUSTRY_UNITS = (
        r"(?:GWh|MWh|kWh|TWh|GW|MW|kW|TW"        # energy (longer first)
        r"|bps|bp"                                  # basis points
        r"|tons|tonnes|barrels|bbl"                 # commodities
        r"|units|doses|devices"                     # manufacturing / pharma
        r"|ms|seconds|minutes|hours|days|weeks|months|years"  # duration
        r")"
    )
    # Structured field labels from DB knowledge store
    _FIELD_LABELS = (
        r"(?:Revenue|Market Size|Estimated Revenue|Financial|Funding|Valuation"
        r"|ARR|MRR|GMV|CAGR|Growth Rate|TAM|SAM|SOM|Headcount|Team Size"
        r"|Customers|Users|매출|시장\s*규모|투자|기업\s*가치)"  # Korean: revenue, market size, investment, valuation
    )

    @staticmethod
    def _extract_numerics(text: str) -> List[str]:
        """Extract structured numeric facts from chunk text.

        Works across document types: IR reports, pitch decks,
        healthcare, energy, SaaS, banking, manufacturing, etc.
        Also handles structured DB fields like "Revenue: $5M → $25M".
        Returns short, LLM-friendly strings for chart/table use.
        """
        results: List[str] = []
        seen = set()

        SYM = RagService._CURRENCY_SYMBOLS
        CODE = RagService._CURRENCY_CODES
        SCALE = RagService._SCALE_WORDS
        ABBR = RagService._SCALE_ABBR
        KR_SCALE = RagService._KOREAN_SCALE
        PEOPLE = RagService._PEOPLE_UNITS
        IND = RagService._INDUSTRY_UNITS
        FIELDS = RagService._FIELD_LABELS

        def _add(val: str):
            v = val.strip().rstrip(".")
            # Minimum length 3 (allows "45명", "$5M") but filters noise like "12"
            if not v or v in seen or len(v) < 3:
                return
            seen.add(v)
            results.append(v)

        # 1. Currency with symbol: $250B, ¥1,280 billion, ₹500 crore, £12.5bn
        for m in re.finditer(
            SYM + r"\s*[\d,]+\.?\d*\s*(?:" + SCALE + r"|" + ABBR + r")?\b",
            text, re.IGNORECASE
        ):
            _add(m.group())

        # 2. Currency with code prefix: USD 5.0M, INR 5,000 crore, Rs 1,200 crore
        for m in re.finditer(
            CODE + r"\s+[\d,]+\.?\d*\s*(?:" + SCALE + r"|" + ABBR + r")?\b",
            text, re.IGNORECASE
        ):
            _add(m.group())

        # 3. Amounts with scale word (no symbol): 1.28 trillion, 300 billion, 500 crore
        for m in re.finditer(
            r"[\d,]+\.?\d*\s+(?:" + SCALE + r")\b"
            r"(?:\s+(?:yen|usd|jpy|dollars|euros|rupees|yuan|won))?",
            text, re.IGNORECASE
        ):
            _add(m.group())

        # 4. Amounts with abbreviation suffix (no symbol): 12.5bn, 250mn, 4.2tn
        for m in re.finditer(
            r"[\d,]+\.?\d*\s*(?:" + ABBR + r")\b",
            text, re.IGNORECASE
        ):
            _add(m.group())

        # 5. Korean amounts: 450억원, 1.2조원, 5000만원, ₩450억
        for m in re.finditer(
            r"₩\s*[\d,]+\.?\d*\s*(?:" + KR_SCALE + r")?"
            r"|[\d,]+\.?\d*\s*" + KR_SCALE,
            text
        ):
            _add(m.group())

        # 6. Percentages: 25%, +20%, -5.3%, CAGR 15%, up 12%
        for m in re.finditer(
            r"(?:CAGR|YoY|QoQ|MoM|growth|decline|increase|decrease|up|down"
            r"|margin|ratio|rate)\s+[+-]?\d+\.?\d*\s*%"
            r"|[+-]?\d+\.?\d*\s*%",
            text, re.IGNORECASE
        ):
            _add(m.group())

        # 7. Basis points: 285 bps, +20 bp
        for m in re.finditer(r"[+-]?\d+\.?\d*\s*(?:bps|bp)\b", text, re.IGNORECASE):
            _add(m.group())

        # 8. Year-value pairs: FY2024: ¥1.28T, 2023: $450M
        #    Require value to have currency symbol or scale suffix
        for m in re.finditer(
            r"(?:FY|CY|H[12]|[12]H|Q[1-4]\s*)?20\d{2}\s*[:/]\s*"
            + SYM + r"?\s*[\d,]+\.?\d*\s*(?:" + SCALE + r"|" + ABBR + r")?"
            r"|(?:FY|CY|H[12]|[12]H|Q[1-4]\s*)20\d{2}\s+"
            + SYM + r"\s*[\d,]+\.?\d*\s*(?:" + SCALE + r"|" + ABBR + r")?",
            text, re.IGNORECASE
        ):
            val = m.group()
            # Filter out year + bare small number (e.g., "2040 69" = page ref)
            if re.search(r"[" + r"$¥€£₹₩" + r"]|" + SCALE + r"|" + ABBR, val, re.IGNORECASE):
                _add(val)

        # 9. People / entity counts: 3,200 patients, 45,000 employees, 50명
        for m in re.finditer(
            r"[\d,]+\.?\d*\s*(?:" + ABBR + r")?\s*" + PEOPLE,
            text, re.IGNORECASE
        ):
            _add(m.group())
        # 9b. Korean people count: 45명, 100명
        for m in re.finditer(r"[\d,]+\s*명", text):
            _add(m.group())

        # 10. Industry units: 4.5 GW, 8,200 GWh, 850 MW, 285 bps, 120ms
        for m in re.finditer(
            r"[\d,]+\.?\d*\s*" + IND + r"\b",
            text, re.IGNORECASE
        ):
            _add(m.group())

        # 11. Per-unit pricing: $35/MWh, $45,000 per patient, ₹180/month
        for m in re.finditer(
            SYM + r"\s*[\d,]+\.?\d*\s*(?:/" + IND + r"|/\w+|per\s+\w+)",
            text, re.IGNORECASE
        ):
            _add(m.group())

        # 12. Ratios and multiples: 2.5x, 1.3x, LTV/CAC 4.2x
        for m in re.finditer(r"(?:\w+[/]\w+\s+)?\d+\.?\d*\s*[xX]\b", text):
            _add(m.group())

        # 13. Structured field patterns from DB: "Revenue: $5M", "TAM: 4.5조원"
        #     Require a full currency amount (with symbol OR scale word)
        for m in re.finditer(
            FIELDS + r"\s*[:\-]\s*" + SYM + r"\s*[\d,]+\.?\d*\s*(?:" + SCALE + r"|" + ABBR + r"|" + KR_SCALE + r")",
            text, re.IGNORECASE
        ):
            _add(m.group())

        # 14. Value progressions: $5M → $25M → $80M (common in revenue projections)
        for m in re.finditer(
            SYM + r"\s*[\d,]+\.?\d*\s*(?:" + SCALE + r"|" + ABBR + r")"
            r"(?:\s*[→\->]+\s*" + SYM + r"?\s*[\d,]+\.?\d*\s*(?:" + SCALE + r"|" + ABBR + r"))+",
            text, re.IGNORECASE
        ):
            _add(m.group())

        return results

    def _merge_local(
        self,
        file_chunks: List[RagChunk],
        file_vector_scores: Dict[Tuple[str, str], float] | None = None,
        top_k: int = 6,
    ) -> List[RagChunk]:
        """Hybrid merge: keyword overlap + optional local vector re-rank."""
        if not file_chunks:
            return []
        file_vector_scores = file_vector_scores or {}
        ranked: List[RagChunk] = []
        for chunk in file_chunks:
            key = (chunk.source, chunk.text)
            score_vector = file_vector_scores.get(key, 0.0)
            score_keyword = float(chunk.score or 0.0)
            if self.enable_local_vector and score_vector:
                chunk.score = (self.vector_weight * score_vector) + (self.keyword_weight * score_keyword)
            else:
                chunk.score = score_keyword
            ranked.append(chunk)
        ranked.sort(key=lambda c: c.score, reverse=True)
        return ranked[:top_k]

    @staticmethod
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

    @staticmethod
    def _keyword_score(query_tokens: List[str], text: str) -> float:
        if not query_tokens or not text:
            return 0.0
        text_tokens = set(re.findall(r"[a-zA-Z0-9%]+", text.lower()))
        overlap = set(query_tokens).intersection(text_tokens)
        return float(len(overlap)) / float(len(set(query_tokens)) or 1)

    async def _score_file_chunks_vector(
        self,
        query: str,
        file_chunks: List[RagChunk],
    ) -> Dict[Tuple[str, str], float]:
        """Optional local vector scoring for file chunks (embedding-based)."""
        if not query or not file_chunks:
            return {}
        # If embeddings are unavailable (no OpenAI key), skip.
        texts = [query] + [c.text for c in file_chunks[: self.local_embed_candidates]]
        embeddings = await self._embed_texts(texts)
        if not embeddings or len(embeddings) != len(texts):
            return {}

        query_vec = embeddings[0]
        query_norm = self._vec_norm(query_vec)
        if query_norm <= 0:
            return {}

        scores: Dict[Tuple[str, str], float] = {}
        for chunk, vec in zip(file_chunks[: self.local_embed_candidates], embeddings[1:]):
            denom = query_norm * self._vec_norm(vec)
            if denom <= 0:
                sim = 0.0
            else:
                sim = self._dot(query_vec, vec) / denom
            scores[(chunk.source, chunk.text)] = float(sim)
        return scores

    async def _embed_texts(self, texts: List[str]) -> List[List[float]]:
        if not self.openai_key:
            return []
        payload = {"model": self.embed_model, "input": texts}
        headers = {
            "Authorization": f"Bearer {self.openai_key}",
            "Content-Type": "application/json",
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.openai.com/v1/embeddings",
                headers=headers,
                json=payload,
                timeout=60,
            ) as resp:
                if resp.status >= 400:
                    return []
                data = await resp.json()
        return [item.get("embedding", []) for item in data.get("data", [])]

    @staticmethod
    def _dot(a: List[float], b: List[float]) -> float:
        return sum(x * y for x, y in zip(a, b))

    @staticmethod
    def _vec_norm(a: List[float]) -> float:
        return sum(x * x for x in a) ** 0.5

    # Web retrieval removed; local file RAG only.

    def _list_files(self, root: str) -> List[str]:
        if not os.path.isdir(root):
            return []
        files = []
        for name in os.listdir(root):
            if name.startswith("."):
                continue
            path = os.path.join(root, name)
            if os.path.isfile(path) and self._is_supported(path):
                files.append(path)
        return sorted(files)

    def _is_supported(self, path: str) -> bool:
        lower = path.lower()
        return lower.endswith(".pdf") or lower.endswith(".txt") or lower.endswith(".md")

    def _extract_pdf(self, path: str) -> str:
        try:
            reader = PdfReader(path)
            parts = []
            for page in reader.pages:
                try:
                    text = page.extract_text() or ""
                except Exception:
                    text = ""
                if text:
                    parts.append(text)
            return "\n".join(parts)
        except Exception:
            return ""

    def _extract_pdf_pages(self, path: str) -> List[str]:
        """Extract text per page for page-aware chunking."""
        try:
            reader = PdfReader(path)
            pages = []
            for page in reader.pages:
                try:
                    text = page.extract_text() or ""
                except Exception:
                    text = ""
                cleaned = re.sub(r"\s+", " ", text).strip()
                if cleaned:
                    pages.append(cleaned)
            return pages
        except Exception:
            return []

    def _extract_text(self, path: str) -> str:
        if path.lower().endswith(".pdf"):
            return self._extract_pdf(path)
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except OSError:
            return ""

    def _chunk_text(self, text: str, page_texts: List[str] | None = None) -> List[str]:
        """Chunk text, optionally using page boundaries from PDF extraction.

        Strategy:
        1. If page_texts are provided, use each page as a natural boundary.
           - Small pages (≤ chunk_size) become one chunk.
           - Large pages are split at sentence boundaries.
        2. Otherwise, fall back to sentence-aware sliding window.
        """
        if page_texts:
            return self._chunk_by_pages(page_texts)
        if not text:
            return []
        cleaned = re.sub(r"\s+", " ", text).strip()
        if not cleaned:
            return []
        return self._chunk_with_sentences(cleaned)

    def _chunk_by_pages(self, pages: List[str]) -> List[str]:
        """Chunk using PDF page boundaries. Merge small pages, split large ones."""
        chunks: List[str] = []
        buffer = ""
        for page_text in pages:
            # If adding this page would exceed limit, flush buffer
            if buffer and len(buffer) + len(page_text) > self.chunk_size:
                chunks.append(buffer.strip())
                buffer = ""
            # If single page exceeds limit, split it at sentence boundaries
            if len(page_text) > self.chunk_size:
                if buffer:
                    chunks.append(buffer.strip())
                    buffer = ""
                chunks.extend(self._chunk_with_sentences(page_text))
            else:
                buffer = (buffer + " " + page_text).strip() if buffer else page_text
        if buffer.strip():
            chunks.append(buffer.strip())
        return chunks

    def _chunk_with_sentences(self, text: str) -> List[str]:
        """Sliding window that breaks at sentence boundaries."""
        # Split into sentences
        sentences = re.split(r'(?<=[.!?;])\s+', text)
        chunks: List[str] = []
        current = ""
        for sent in sentences:
            if current and len(current) + len(sent) + 1 > self.chunk_size:
                chunks.append(current.strip())
                # Overlap: keep last portion of current chunk
                overlap_text = current[-self.overlap:] if len(current) > self.overlap else current
                # Find sentence boundary in overlap
                last_break = overlap_text.rfind(". ")
                if last_break > 0:
                    overlap_text = overlap_text[last_break + 2:]
                current = overlap_text + " " + sent
            else:
                current = (current + " " + sent).strip() if current else sent
        if current.strip():
            chunks.append(current.strip())
        return chunks

    def _tokenize(self, text: str) -> List[str]:
        tokens = re.findall(r"[a-zA-Z0-9%]+", text.lower())
        return [t for t in tokens if t not in _STOPWORDS and len(t) > 1]

    def _overlap_score(self, q_tokens: List[str], c_tokens: List[str], chunk_text: str = "") -> float:
        if not q_tokens or not c_tokens:
            return 0.0
        q_set = set(q_tokens)
        c_set = set(c_tokens)
        overlap = q_set.intersection(c_set)
        base = float(len(overlap)) / float(len(q_set) or 1)
        # Boost chunks that contain numeric data (currency, %, billions, etc.)
        if chunk_text and re.search(
            r"([\$¥€£₹₩]\s*\d|\d+[.,]\d+|\d+\s*[%KMBT]"
            r"|\d{2,}\s*(billion|million|thousand|trillion|crore|lakh|yen|usd|jpy)"
            r"|\d+\s*(GW|MW|kW|GWh|MWh|bps|bp)\b"
            r"|\d+\s*(억\s*원|조\s*원|만\s*원|억|조))",  # Korean: 억 = 100M, 조 = 1T
            chunk_text, re.IGNORECASE
        ):
            base *= 1.3
        return base
