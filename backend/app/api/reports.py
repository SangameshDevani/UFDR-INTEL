from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.ai.query_planner import plan_query
from app.database import get_db
from app.models import Case, QueryLog
from app.search.retriever import search_artifacts

router = APIRouter(prefix="/cases/{case_id}/reports", tags=["reports"])


@router.get("/latest-query")
def latest_query_report(case_id: str, db: Session = Depends(get_db)):
    log = (
        db.query(QueryLog)
        .filter(QueryLog.case_id == case_id)
        .order_by(QueryLog.created_at.desc())
        .first()
    )
    if not log:
        raise HTTPException(status_code=404, detail="No queries recorded for this case")
    return {
        "query": log.query_text,
        "summary": log.response_summary,
        "result_count": log.result_count,
        "created_at": log.created_at,
        "created_by": log.created_by,
    }


@router.get("/export", response_class=PlainTextResponse)
def export_report(case_id: str, query: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    plan = plan_query(query)
    from app.models import ArtifactType

    artifact_type = ArtifactType(plan.artifact_type) if plan.artifact_type else None
    results = search_artifacts(
        db,
        case_id=case_id,
        query=" ".join(plan.search_terms) if plan.search_terms else None,
        artifact_type=artifact_type,
        app_name=plan.app_name,
        entity_type=plan.entity_type,
        foreign_numbers_only=plan.foreign_numbers_only,
    )

    lines = [
        "UFDR ANALYSIS REPORT",
        "=" * 60,
        f"Case Number : {case.case_number}",
        f"Case Title  : {case.title}",
        f"Generated   : {datetime.utcnow().isoformat()}Z",
        f"Query       : {query}",
        f"Intent      : {plan.intent}",
        f"Results     : {len(results)}",
        "",
        "DISCLAIMER: AI-assisted analysis. Verify all findings against original UFDR.",
        "",
        "FINDINGS",
        "-" * 60,
    ]

    for i, art in enumerate(results, 1):
        lines.extend(
            [
                f"\n[{i}] {art.artifact_type.value.upper()} — {art.title or 'Untitled'}",
                f"    App         : {art.app_name or 'N/A'}",
                f"    Timestamp   : {art.timestamp.isoformat() if art.timestamp else 'N/A'}",
                f"    Artifact ID : {art.id}",
                f"    Content     : {(art.content or '')[:500]}",
            ]
        )
        if art.entities:
            ents = ", ".join(f"{e.entity_type}={e.value}" for e in art.entities[:10])
            lines.append(f"    Entities    : {ents}")

    lines.append("\n" + "=" * 60)
    lines.append("End of Report")
    return "\n".join(lines)
