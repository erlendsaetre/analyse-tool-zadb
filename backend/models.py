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
