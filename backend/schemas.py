from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# ─────────────────────────── Upload ───────────────────────────

class UploadBase(BaseModel):
    filename: str
    upload_date: datetime
    record_count: int

class UploadResponse(UploadBase):
    id: int
    class Config:
        from_attributes = True

class UploadCreateResponse(BaseModel):
    message: str
    count: int
    upload_id: int
    filename: str
    upload_date: datetime

# ─────────────────────────── AirFreightRate ───────────────────────────

class AirFreightRateBase(BaseModel):
    airline: str
    gsa: Optional[str] = None
    product: str
    origin: str
    destination: str
    via: Optional[str] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    relation_kg_m3: Optional[float] = None
    fuel: Optional[str] = None
    security_surcharge: Optional[str] = None
    fixed: Optional[str] = None
    min_rate: Optional[float] = None
    normal_rate: Optional[float] = None
    q45: Optional[float] = None
    q100: Optional[float] = None
    q300: Optional[float] = None
    q500: Optional[float] = None
    q1000: Optional[float] = None
    q3000: Optional[float] = None
    currency: Optional[str] = None

class AirFreightRate(AirFreightRateBase):
    id: int
    upload_id: Optional[int] = None
    class Config:
        from_attributes = True

class RouteInfo(BaseModel):
    origin: str
    destination: str

class AnalyticsSummary(BaseModel):
    total_rates: int
    total_airlines: int
    airlines_with_prices: int
    cheapest_airline: Optional[str] = None
    cheapest_product: Optional[str] = None
    cheapest_price: Optional[float] = None
    price_range_min: Optional[float] = None
    price_range_max: Optional[float] = None
    weight_bracket: str = "q100"

class ComparisonItem(BaseModel):
    airline: str
    gsa: Optional[str] = None
    product: str
    via: Optional[str] = None
    valid_until: Optional[datetime] = None
    min_rate: Optional[float] = None
    normal_rate: Optional[float] = None
    q45: Optional[float] = None
    q100: Optional[float] = None
    q300: Optional[float] = None
    q500: Optional[float] = None
    q1000: Optional[float] = None
    q3000: Optional[float] = None
    currency: Optional[str] = None

# ─────────────────────────── TenderImport ───────────────────────────

class TenderImportResponse(BaseModel):
    id: int
    tender_id: int
    filename: str
    format_type: str
    imported_at: datetime
    lane_count: int
    notes: Optional[str] = None
    class Config:
        from_attributes = True

# ─────────────────────────── TenderRate ───────────────────────────

class TenderRateCreate(BaseModel):
    source_rate_id: Optional[int] = None
    lane_id: Optional[str] = None
    airline: str
    product: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    via: Optional[str] = None
    routing: Optional[str] = None
    currency: Optional[str] = None
    terms: Optional[str] = None
    cost_min: Optional[float] = None
    cost_normal: Optional[float] = None
    cost_q45: Optional[float] = None
    cost_q100: Optional[float] = None
    cost_q300: Optional[float] = None
    cost_q500: Optional[float] = None
    cost_q1000: Optional[float] = None
    cost_q3000: Optional[float] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None
    is_selected: Optional[bool] = False

class TenderRateUpdate(BaseModel):
    notes: Optional[str] = None
    is_selected: Optional[bool] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    sort_order: Optional[int] = None

class TenderRateResponse(BaseModel):
    id: int
    tender_id: int
    tender_import_id: Optional[int] = None
    source_rate_id: Optional[int] = None
    lane_id: Optional[str] = None
    airline: str
    product: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    via: Optional[str] = None
    routing: Optional[str] = None
    currency: Optional[str] = None
    terms: Optional[str] = None
    cost_min: Optional[float] = None
    cost_normal: Optional[float] = None
    cost_q45: Optional[float] = None
    cost_q100: Optional[float] = None
    cost_q300: Optional[float] = None
    cost_q500: Optional[float] = None
    cost_q1000: Optional[float] = None
    cost_q3000: Optional[float] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None
    is_selected: bool = False
    sort_order: int = 0
    class Config:
        from_attributes = True

# ─────────────────────────── Tender ───────────────────────────

class TenderCreate(BaseModel):
    name: str
    description: Optional[str] = None
    customer: Optional[str] = None

class TenderUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    customer: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    tender_url: Optional[str] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    markup_min: Optional[float] = None
    markup_normal: Optional[float] = None
    markup_q45: Optional[float] = None
    markup_q100: Optional[float] = None
    markup_q300: Optional[float] = None
    markup_q500: Optional[float] = None
    markup_q1000: Optional[float] = None
    markup_q3000: Optional[float] = None

class TenderResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    customer: Optional[str] = None
    status: str
    notes: Optional[str] = None
    tender_url: Optional[str] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    markup_min: float
    markup_normal: float
    markup_q45: float
    markup_q100: float
    markup_q300: float
    markup_q500: float
    markup_q1000: float
    markup_q3000: float
    created_at: datetime
    updated_at: datetime
    rates: List[TenderRateResponse] = []
    imports: List[TenderImportResponse] = []
    class Config:
        from_attributes = True

class TenderListItem(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    customer: Optional[str] = None
    status: str
    tender_url: Optional[str] = None
    valid_until: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    rate_count: int
    class Config:
        from_attributes = True
