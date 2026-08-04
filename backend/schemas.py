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
