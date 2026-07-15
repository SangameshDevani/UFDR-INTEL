from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models import Artifact, ArtifactType, ExtractedEntity, Extraction, SearchChunk


def search_artifacts(
    db: Session,
    case_id: str,
    query: str | None = None,
    artifact_type: ArtifactType | None = None,
    app_name: str | None = None,
    entity_type: str | None = None,
    foreign_numbers_only: bool = False,
    limit: int = 50,
) -> list[Artifact]:
    q = (
        db.query(Artifact)
        .join(Extraction)
        .filter(Extraction.case_id == case_id)
        .options(joinedload(Artifact.entities), joinedload(Artifact.extraction))
    )

    if artifact_type:
        q = q.filter(Artifact.artifact_type == artifact_type)

    if app_name:
        q = q.filter(Artifact.app_name.ilike(f"%{app_name}%"))

    if query:
        pattern = f"%{query}%"
        q = q.filter(
            or_(
                Artifact.content.ilike(pattern),
                Artifact.title.ilike(pattern),
                Artifact.app_name.ilike(pattern),
            )
        )

    if entity_type or foreign_numbers_only:
        q = q.join(ExtractedEntity)
        if entity_type:
            q = q.filter(ExtractedEntity.entity_type == entity_type)
        if foreign_numbers_only:
            q = q.filter(ExtractedEntity.entity_type == "phone_foreign")

    return q.order_by(Artifact.timestamp.desc().nullslast()).limit(limit).all()


def search_chunks(db: Session, case_id: str, query: str, limit: int = 20) -> list[SearchChunk]:
    pattern = f"%{query}%"
    return (
        db.query(SearchChunk)
        .join(Artifact)
        .join(Extraction)
        .filter(Extraction.case_id == case_id)
        .filter(SearchChunk.text.ilike(pattern))
        .options(joinedload(SearchChunk.artifact).joinedload(Artifact.entities))
        .limit(limit)
        .all()
    )
