from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

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

class AirFreightRateBase(BaseModel):
    airline: str
    product: str
    origin: str
    destination: str
    via: Optional[str] = None
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
    product: str
    via: Optional[str] = None
    min_rate: Optional[float] = None
    normal_rate: Optional[float] = None
    q45: Optional[float] = None
    q100: Optional[float] = None
    q300: Optional[float] = None
    q500: Optional[float] = None
    q1000: Optional[float] = None
    q3000: Optional[float] = None
    currency: Optional[str] = None


# --- Tender Schemas ---

class TenderCreate(BaseModel):
    name: str
    description: Optional[str] = None

class TenderUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    markup_min: Optional[float] = None
    markup_normal: Optional[float] = None
    markup_q45: Optional[float] = None
    markup_q100: Optional[float] = None
    markup_q300: Optional[float] = None
    markup_q500: Optional[float] = None
    markup_q1000: Optional[float] = None
    markup_q3000: Optional[float] = None

class TenderRateCreate(BaseModel):
    source_rate_id: Optional[int] = None
    airline: str
    product: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    via: Optional[str] = None
    currency: Optional[str] = None
    cost_min: Optional[float] = None
    cost_normal: Optional[float] = None
    cost_q45: Optional[float] = None
    cost_q100: Optional[float] = None
    cost_q300: Optional[float] = None
    cost_q500: Optional[float] = None
    cost_q1000: Optional[float] = None
    cost_q3000: Optional[float] = None
    notes: Optional[str] = None

class TenderRateUpdate(BaseModel):
    notes: Optional[str] = None

class TenderRateResponse(BaseModel):
    id: int
    tender_id: int
    source_rate_id: Optional[int] = None
    airline: str
    product: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    via: Optional[str] = None
    currency: Optional[str] = None
    cost_min: Optional[float] = None
    cost_normal: Optional[float] = None
    cost_q45: Optional[float] = None
    cost_q100: Optional[float] = None
    cost_q300: Optional[float] = None
    cost_q500: Optional[float] = None
    cost_q1000: Optional[float] = None
    cost_q3000: Optional[float] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True

class TenderResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    status: str
    notes: Optional[str] = None
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

    class Config:
        from_attributes = True

class TenderListItem(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    rate_count: int

    class Config:
        from_attributes = True
