from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.ai.rag_pipeline import run_query
from app.database import get_db
from app.models import Case
from app.schemas import CitationResponse, EntityResponse, NLQueryRequest, NLQueryResponse

router = APIRouter(prefix="/cases/{case_id}/query", tags=["query"])


@router.post("", response_model=NLQueryResponse)
async def natural_language_query(case_id: str, payload: NLQueryRequest, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    result = await run_query(db, case_id, payload.query, user_id=payload.user_id)

    return NLQueryResponse(
        query=result.query,
        intent=result.intent,
        summary=result.summary,
        result_count=result.result_count,
        citations=[
            CitationResponse(
                artifact_id=c.artifact_id,
                artifact_type=c.artifact_type,
                title=c.title,
                app_name=c.app_name,
                timestamp=c.timestamp,
                excerpt=c.excerpt,
                entities=[EntityResponse(entity_type=e["type"], value=e["value"]) for e in c.entities],
            )
            for c in result.citations
        ],
        filters_applied=result.filters_applied,
    )
