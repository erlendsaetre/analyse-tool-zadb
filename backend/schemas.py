from pydantic import BaseModel
from typing import Optional, List

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

    class Config:
        from_attributes = True

class UploadResponse(BaseModel):
    message: str
    count: int
