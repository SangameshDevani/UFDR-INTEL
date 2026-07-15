from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.entities.extractors import extract_entities
from app.ingestion.ufdr_parser import ParseResult, content_hash, extract_ufdr, parse_report_xml
from app.models import Artifact, ArtifactType, Extraction, ExtractedEntity, JobStatus, SearchChunk
from app.search.indexer import build_chunks


def _persist_artifact(db: Session, extraction_id: str, parsed) -> Artifact:
    artifact = Artifact(
        extraction_id=extraction_id,
        artifact_type=parsed.artifact_type,
        source_path=parsed.source_path,
        app_name=parsed.app_name,
        title=parsed.title,
        content=parsed.content,
        participants=parsed.participants or None,
        timestamp=parsed.timestamp,
        metadata_json=parsed.metadata or None,
        content_hash=content_hash(parsed.content),
    )
    db.add(artifact)
    db.flush()

    for entity in extract_entities(parsed.content):
        db.add(
            ExtractedEntity(
                artifact_id=artifact.id,
                entity_type=entity.entity_type,
                value=entity.value,
                context=entity.context,
            )
        )

    for idx, chunk_text in enumerate(build_chunks(parsed)):
        db.add(
            SearchChunk(
                artifact_id=artifact.id,
                chunk_index=idx,
                text=chunk_text,
            )
        )

    return artifact


def process_extraction(
    db: Session,
    extraction: Extraction,
    ufdr_path,
    extract_path,
    password: str | None = None,
) -> dict:
    extraction.status = JobStatus.PROCESSING
    extraction.progress = 5
    db.commit()

    try:
        report_xml = extract_ufdr(ufdr_path, extract_path, password=password)
        extraction.progress = 20
        db.commit()

        result: ParseResult = parse_report_xml(report_xml)
        extraction.device_info = result.device_info
        extraction.progress = 40
        db.commit()

        total = max(len(result.artifacts), 1)
        for i, parsed in enumerate(result.artifacts):
            _persist_artifact(db, extraction.id, parsed)
            extraction.progress = 40 + int((i + 1) / total * 55)
            if i % 100 == 0:
                db.commit()

        extraction.status = JobStatus.COMPLETED
        extraction.progress = 100
        extraction.stats = result.stats
        extraction.completed_at = datetime.now(timezone.utc)
        extraction.error_message = None
        db.commit()

        return result.stats

    except Exception as exc:
        extraction.status = JobStatus.FAILED
        extraction.error_message = str(exc)
        db.commit()
        raise
