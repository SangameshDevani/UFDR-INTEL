from datetime import datetime

from pydantic import BaseModel, Field


class CaseCreate(BaseModel):
    case_number: str = Field(..., min_length=1, max_length=100)
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    created_by: str = "io"


class CaseResponse(BaseModel):
    id: str
    case_number: str
    title: str
    description: str | None
    created_by: str
    created_at: datetime
    extraction_count: int = 0

    model_config = {"from_attributes": True}


class ExtractionResponse(BaseModel):
    id: str
    case_id: str
    filename: str
    file_hash: str
    file_size: int
    status: str
    progress: int
    error_message: str | None
    device_info: dict | None
    stats: dict | None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class EntityResponse(BaseModel):
    entity_type: str
    value: str


class ArtifactResponse(BaseModel):
    id: str
    extraction_id: str
    artifact_type: str
    app_name: str | None
    title: str | None
    content: str | None
    participants: list[str] | None
    timestamp: datetime | None
    metadata_json: dict | None
    entities: list[EntityResponse] = []

    model_config = {"from_attributes": True}


class SearchRequest(BaseModel):
    query: str | None = None
    artifact_type: str | None = None
    app_name: str | None = None
    entity_type: str | None = None
    foreign_numbers_only: bool = False
    limit: int = 50


class NLQueryRequest(BaseModel):
    query: str = Field(..., min_length=3)
    user_id: str = "io"


class CitationResponse(BaseModel):
    artifact_id: str
    artifact_type: str
    title: str | None
    app_name: str | None
    timestamp: str | None
    excerpt: str
    entities: list[EntityResponse]


class NLQueryResponse(BaseModel):
    query: str
    intent: str
    summary: str
    result_count: int
    citations: list[CitationResponse]
    filters_applied: dict


class AuditLogResponse(BaseModel):
    id: str
    action: str
    details: dict | None
    user_id: str
    created_at: datetime

    model_config = {"from_attributes": True}
