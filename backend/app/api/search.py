from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ArtifactType, AuditLog, Case
from app.schemas import ArtifactResponse, EntityResponse, SearchRequest
from app.search.retriever import search_artifacts

router = APIRouter(prefix="/cases/{case_id}/search", tags=["search"])


@router.post("", response_model=list[ArtifactResponse])
def search(case_id: str, payload: SearchRequest, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    artifact_type = None
    if payload.artifact_type:
        try:
            artifact_type = ArtifactType(payload.artifact_type)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid artifact_type")

    results = search_artifacts(
        db,
        case_id=case_id,
        query=payload.query,
        artifact_type=artifact_type,
        app_name=payload.app_name,
        entity_type=payload.entity_type,
        foreign_numbers_only=payload.foreign_numbers_only,
        limit=min(payload.limit, 100),
    )

    db.add(
        AuditLog(
            case_id=case_id,
            action="search",
            details={"query": payload.query, "result_count": len(results)},
        )
    )
    db.commit()

    return [
        ArtifactResponse(
            id=a.id,
            extraction_id=a.extraction_id,
            artifact_type=a.artifact_type.value,
            app_name=a.app_name,
            title=a.title,
            content=a.content,
            participants=a.participants,
            timestamp=a.timestamp,
            metadata_json=a.metadata_json,
            entities=[EntityResponse(entity_type=e.entity_type, value=e.value) for e in a.entities],
        )
        for a in results
    ]
