from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, ConfigDict
from backend.app.config import settings

class ConfidenceBucket(BaseModel):
    bucket: str
    label: str
    count: int
    percentage: float

class RecentActivityItem(BaseModel):
    id: str
    action: str
    document_id: Optional[str] = None
    document_filename: Optional[str] = None
    user_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

class DashboardMetricsResponse(BaseModel):
    role: str
    total_documents: int
    total_cases: int
    processing: int
    needs_review: int
    mismatches: int
    approved: int
    confidence_distribution: List[ConfidenceBucket]
    recent_activity: List[RecentActivityItem]
    disclaimer: str = settings.DEMO_DISCLAIMER

class SearchResultItem(BaseModel):
    result_type: str  # "document" or "case"
    id: str
    title: str
    subtitle: str
    matched_field: str
    matched_value: str
    link: str
    status: str
    village: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None

class GlobalSearchResponse(BaseModel):
    query: str
    total_results: int
    documents_count: int
    cases_count: int
    results: List[SearchResultItem]
    disclaimer: str = settings.DEMO_DISCLAIMER
