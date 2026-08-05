from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class Upload(Base):
    __tablename__ = "uploads"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    upload_date = Column(DateTime, default=datetime.utcnow)
    record_count = Column(Integer, default=0)
    
    rates = relationship("AirFreightRate", back_populates="upload", cascade="all, delete-orphan")

class AirFreightRate(Base):
    __tablename__ = "air_freight_rates"

    id = Column(Integer, primary_key=True, index=True)
    upload_id = Column(Integer, ForeignKey("uploads.id"), nullable=True)
    airline = Column(String, index=True)
    product = Column(String)
    origin = Column(String, index=True)
    destination = Column(String, index=True)
    via = Column(String)
    relation_kg_m3 = Column(Float, nullable=True)
    fuel = Column(String)
    security_surcharge = Column(String)
    fixed = Column(String)
    min_rate = Column(Float, nullable=True)
    normal_rate = Column(Float, nullable=True)
    q45 = Column(Float, nullable=True)
    q100 = Column(Float, nullable=True)
    q300 = Column(Float, nullable=True)
    q500 = Column(Float, nullable=True)
    q1000 = Column(Float, nullable=True)
    q3000 = Column(Float, nullable=True)
    currency = Column(String)
    
    upload = relationship("Upload", back_populates="rates")


class Tender(Base):
    __tablename__ = "tenders"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="draft")
    notes = Column(String, nullable=True)
    
    markup_min = Column(Float, default=0)
    markup_normal = Column(Float, default=0)
    markup_q45 = Column(Float, default=0)
    markup_q100 = Column(Float, default=0)
    markup_q300 = Column(Float, default=0)
    markup_q500 = Column(Float, default=0)
    markup_q1000 = Column(Float, default=0)
    markup_q3000 = Column(Float, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    rates = relationship("TenderRate", back_populates="tender", cascade="all, delete-orphan")


class TenderRate(Base):
    __tablename__ = "tender_rates"
    
    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=False)
    source_rate_id = Column(Integer, nullable=True)
    
    airline = Column(String, nullable=False)
    product = Column(String, nullable=True)
    origin = Column(String, nullable=True)
    destination = Column(String, nullable=True)
    via = Column(String, nullable=True)
    currency = Column(String, nullable=True)
    
    cost_min = Column(Float, nullable=True)
    cost_normal = Column(Float, nullable=True)
    cost_q45 = Column(Float, nullable=True)
    cost_q100 = Column(Float, nullable=True)
    cost_q300 = Column(Float, nullable=True)
    cost_q500 = Column(Float, nullable=True)
    cost_q1000 = Column(Float, nullable=True)
    cost_q3000 = Column(Float, nullable=True)
    
    notes = Column(String, nullable=True)
    
    tender = relationship("Tender", back_populates="rates")
