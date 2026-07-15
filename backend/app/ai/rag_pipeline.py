import json
from dataclasses import dataclass

import httpx
from sqlalchemy.orm import Session

from app.ai.query_planner import QueryPlan, plan_query
from app.config import settings
from app.models import ArtifactType, QueryLog
from app.search.retriever import search_artifacts, search_chunks


@dataclass
class Citation:
    artifact_id: str
    artifact_type: str
    title: str | None
    app_name: str | None
    timestamp: str | None
    excerpt: str
    entities: list[dict]


@dataclass
class QueryResponse:
    query: str
    intent: str
    summary: str
    result_count: int
    citations: list[Citation]
    filters_applied: dict


def _artifact_to_citation(artifact, excerpt_len: int = 300) -> Citation:
    content = artifact.content or ""
    excerpt = content[:excerpt_len] + ("..." if len(content) > excerpt_len else "")
    return Citation(
        artifact_id=artifact.id,
        artifact_type=artifact.artifact_type.value,
        title=artifact.title,
        app_name=artifact.app_name,
        timestamp=artifact.timestamp.isoformat() if artifact.timestamp else None,
        excerpt=excerpt,
        entities=[{"type": e.entity_type, "value": e.value} for e in artifact.entities],
    )


def _retrieve(db: Session, case_id: str, plan: QueryPlan) -> list:
    artifact_type = ArtifactType(plan.artifact_type) if plan.artifact_type else None

    artifacts = search_artifacts(
        db,
        case_id=case_id,
        query=" ".join(plan.search_terms) if plan.search_terms else None,
        artifact_type=artifact_type,
        app_name=plan.app_name,
        entity_type=plan.entity_type,
        foreign_numbers_only=plan.foreign_numbers_only,
        limit=settings.search_result_limit,
    )

    if not artifacts and plan.search_terms:
        for term in plan.search_terms:
            chunks = search_chunks(db, case_id, term, limit=10)
            seen = {a.id for a in artifacts}
            for chunk in chunks:
                if chunk.artifact_id not in seen:
                    artifacts.append(chunk.artifact)
                    seen.add(chunk.artifact_id)

    return artifacts


def _rule_based_summary(plan: QueryPlan, count: int) -> str:
    if count == 0:
        return f"No evidence found for {plan.summary_hint}. Try broadening the query or verify the UFDR was fully ingested."

    return (
        f"Found {count} relevant record(s) for {plan.summary_hint}. "
        "Each finding below is linked to its source artifact in the UFDR. "
        "Verify critical evidence against the original extraction before use in proceedings."
    )


async def _llm_summary(query: str, citations: list[Citation], plan: QueryPlan) -> str | None:
    if not settings.llm_api_url:
        return None

    payload = {
        "model": settings.llm_model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a digital forensics assistant for investigating officers. "
                    "Summarize ONLY the provided evidence excerpts. Do not invent facts. "
                    "Highlight key entities (phones, crypto, URLs). Keep under 200 words."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "query": query,
                        "intent": plan.intent,
                        "evidence": [
                            {
                                "type": c.artifact_type,
                                "app": c.app_name,
                                "time": c.timestamp,
                                "excerpt": c.excerpt,
                                "entities": c.entities,
                            }
                            for c in citations[:15]
                        ],
                    }
                ),
            },
        ],
        "temperature": 0.2,
    }

    headers = {"Authorization": f"Bearer {settings.llm_api_key}"} if settings.llm_api_key else {}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(settings.llm_api_url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
    except Exception:
        return None


async def run_query(db: Session, case_id: str, query_text: str, user_id: str = "io") -> QueryResponse:
    plan = plan_query(query_text)
    artifacts = _retrieve(db, case_id, plan)
    citations = [_artifact_to_citation(a) for a in artifacts]

    summary = await _llm_summary(query_text, citations, plan)
    if not summary:
        summary = _rule_based_summary(plan, len(citations))

    filters = {
        "intent": plan.intent,
        "search_terms": plan.search_terms,
        "artifact_type": plan.artifact_type,
        "entity_type": plan.entity_type,
        "foreign_numbers_only": plan.foreign_numbers_only,
        "app_name": plan.app_name,
    }

    db.add(
        QueryLog(
            case_id=case_id,
            query_text=query_text,
            response_summary=summary,
            result_count=len(citations),
            created_by=user_id,
        )
    )
    db.commit()

    return QueryResponse(
        query=query_text,
        intent=plan.intent,
        summary=summary,
        result_count=len(citations),
        citations=citations,
        filters_applied=filters,
    )
