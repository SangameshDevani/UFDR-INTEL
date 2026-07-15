import shutil
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal, get_db
from app.ingestion.ufdr_parser import file_sha256, is_valid_ufdr
from app.ingestion.worker import process_extraction
from app.models import AuditLog, Case, Extraction, JobStatus
from app.schemas import ExtractionResponse

router = APIRouter(prefix="/cases/{case_id}/extractions", tags=["extractions"])


def _run_ingestion(extraction_id: str, ufdr_path: Path, extract_path: Path, password: str | None):
    db = SessionLocal()
    try:
        extraction = db.query(Extraction).filter(Extraction.id == extraction_id).first()
        if not extraction:
            return
        process_extraction(db, extraction, ufdr_path, extract_path, password=password)
        db.add(
            AuditLog(
                case_id=extraction.case_id,
                action="ufdr_ingested",
                details={"extraction_id": extraction_id, "stats": extraction.stats},
                user_id="io",
            )
        )
        db.commit()
    finally:
        db.close()


@router.get("", response_model=list[ExtractionResponse])
def list_extractions(case_id: str, db: Session = Depends(get_db)):
    return db.query(Extraction).filter(Extraction.case_id == case_id).order_by(Extraction.created_at.desc()).all()


@router.post("", response_model=ExtractionResponse, status_code=202)
async def upload_ufdr(
    case_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    password: str | None = Form(default=None),
    db: Session = Depends(get_db),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    if not file.filename or not file.filename.lower().endswith(".ufdr"):
        raise HTTPException(status_code=400, detail="File must have .ufdr extension")

    case_dir = settings.upload_dir / case_id
    case_dir.mkdir(parents=True, exist_ok=True)
    dest = case_dir / file.filename

    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    if dest.stat().st_size > settings.max_upload_size_mb * 1024 * 1024:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="File exceeds maximum upload size")

    if not is_valid_ufdr(dest):
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Invalid UFDR file — report.xml not found in archive")

    file_hash = file_sha256(dest)
    duplicate = (
        db.query(Extraction)
        .filter(Extraction.case_id == case_id, Extraction.file_hash == file_hash)
        .first()
    )
    if duplicate:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=409, detail="This UFDR was already uploaded for this case")

    extraction = Extraction(
        case_id=case_id,
        filename=file.filename,
        file_hash=file_hash,
        file_size=dest.stat().st_size,
        status=JobStatus.PENDING,
    )
    db.add(extraction)
    db.add(
        AuditLog(
            case_id=case_id,
            action="ufdr_uploaded",
            details={"filename": file.filename, "hash": file_hash, "size": extraction.file_size},
        )
    )
    db.commit()
    db.refresh(extraction)

    extract_path = settings.extract_dir / case_id / extraction.id
    background_tasks.add_task(_run_ingestion, extraction.id, dest, extract_path, password or None)

    return extraction


@router.get("/{extraction_id}", response_model=ExtractionResponse)
def get_extraction(case_id: str, extraction_id: str, db: Session = Depends(get_db)):
    extraction = (
        db.query(Extraction)
        .filter(Extraction.id == extraction_id, Extraction.case_id == case_id)
        .first()
    )
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")
    return extraction
