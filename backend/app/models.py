import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class JobStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ArtifactType(str, enum.Enum):
    CHAT = "chat"
    SMS = "sms"
    CALL = "call"
    CONTACT = "contact"
    LOCATION = "location"
    MEDIA = "media"
    WEB = "web"
    APP = "app"
    OTHER = "other"


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    case_number: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String(100), default="io")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    extractions: Mapped[list["Extraction"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="case", cascade="all, delete-orphan")


class Extraction(Base):
    __tablename__ = "extractions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(512))
    file_hash: Mapped[str] = mapped_column(String(64), index=True)
    file_size: Mapped[int] = mapped_column(Integer)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.PENDING)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    device_info: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    stats: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    case: Mapped["Case"] = relationship(back_populates="extractions")
    artifacts: Mapped[list["Artifact"]] = relationship(back_populates="extraction", cascade="all, delete-orphan")


class Artifact(Base):
    __tablename__ = "artifacts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    extraction_id: Mapped[str] = mapped_column(ForeignKey("extractions.id", ondelete="CASCADE"), index=True)
    artifact_type: Mapped[ArtifactType] = mapped_column(Enum(ArtifactType), index=True)
    source_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    app_name: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    participants: Mapped[list | None] = mapped_column(JSON, nullable=True)
    timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    extraction: Mapped["Extraction"] = relationship(back_populates="artifacts")
    entities: Mapped[list["ExtractedEntity"]] = relationship(back_populates="artifact", cascade="all, delete-orphan")
    chunks: Mapped[list["SearchChunk"]] = relationship(back_populates="artifact", cascade="all, delete-orphan")


class ExtractedEntity(Base):
    __tablename__ = "extracted_entities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    artifact_id: Mapped[str] = mapped_column(ForeignKey("artifacts.id", ondelete="CASCADE"), index=True)
    entity_type: Mapped[str] = mapped_column(String(50), index=True)
    value: Mapped[str] = mapped_column(String(512), index=True)
    context: Mapped[str | None] = mapped_column(Text, nullable=True)

    artifact: Mapped["Artifact"] = relationship(back_populates="entities")


class SearchChunk(Base):
    __tablename__ = "search_chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    artifact_id: Mapped[str] = mapped_column(ForeignKey("artifacts.id", ondelete="CASCADE"), index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    text: Mapped[str] = mapped_column(Text)
    embedding_hint: Mapped[str | None] = mapped_column(Text, nullable=True)

    artifact: Mapped["Artifact"] = relationship(back_populates="chunks")


class QueryLog(Base):
    __tablename__ = "query_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    query_text: Mapped[str] = mapped_column(Text)
    response_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_count: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[str] = mapped_column(String(100), default="io")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    case_id: Mapped[str | None] = mapped_column(ForeignKey("cases.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(100))
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    user_id: Mapped[str] = mapped_column(String(100), default="io")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    case: Mapped["Case | None"] = relationship(back_populates="audit_logs")
