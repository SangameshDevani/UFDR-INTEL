from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditLog, Case
from app.schemas import AuditLogResponse, CaseCreate, CaseResponse

router = APIRouter(prefix="/cases", tags=["cases"])


def _case_response(case: Case) -> CaseResponse:
    return CaseResponse(
        id=case.id,
        case_number=case.case_number,
        title=case.title,
        description=case.description,
        created_by=case.created_by,
        created_at=case.created_at,
        extraction_count=len(case.extractions),
    )


@router.get("", response_model=list[CaseResponse])
def list_cases(db: Session = Depends(get_db)):
    cases = db.query(Case).order_by(Case.created_at.desc()).all()
    return [_case_response(c) for c in cases]


@router.post("", response_model=CaseResponse, status_code=201)
def create_case(payload: CaseCreate, db: Session = Depends(get_db)):
    existing = db.query(Case).filter(Case.case_number == payload.case_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Case number already exists")

    case = Case(
        case_number=payload.case_number,
        title=payload.title,
        description=payload.description,
        created_by=payload.created_by,
    )
    db.add(case)
    db.add(AuditLog(case_id=case.id, action="case_created", details={"case_number": payload.case_number}, user_id=payload.created_by))
    db.commit()
    db.refresh(case)
    return _case_response(case)


@router.get("/{case_id}", response_model=CaseResponse)
def get_case(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return _case_response(case)


@router.get("/{case_id}/audit", response_model=list[AuditLogResponse])
def get_audit_logs(case_id: str, db: Session = Depends(get_db)):
    logs = db.query(AuditLog).filter(AuditLog.case_id == case_id).order_by(AuditLog.created_at.desc()).all()
    return logs
