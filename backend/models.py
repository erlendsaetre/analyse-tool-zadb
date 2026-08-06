from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
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
    gsa = Column(String, nullable=True)
    product = Column(String)
    origin = Column(String, index=True)
    destination = Column(String, index=True)
    via = Column(String)
    valid_from = Column(DateTime, nullable=True)
    valid_until = Column(DateTime, nullable=True)
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
    """
    Represents a pricing tender/RFQ project.
    Can contain multiple lanes (TenderRate) for one or more customers/routes.
    Markup is stored per weight bracket and applied globally to all rates in the tender.
    """
    __tablename__ = "tenders"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    customer = Column(String, nullable=True)          # Customer/client name
    status = Column(String, default="draft")          # draft, active, submitted, won, lost, expired
    notes = Column(Text, nullable=True)               # Free-text notes & assessments
    
    # Direct link to the tender in the KN system (TE Connect, Siouxfalls, etc.)
    tender_url = Column(String, nullable=True)
    
    # Validity / deadline dates
    valid_from = Column(DateTime, nullable=True)      # When the rates become valid
    valid_until = Column(DateTime, nullable=True)     # Submission / rate expiry deadline
    
    # Markup % per weight bracket (applied globally across all rates in tender)
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
    imports = relationship("TenderImport", back_populates="tender", cascade="all, delete-orphan")


class TenderImport(Base):
    """
    Tracks each file import into a tender.
    Allows auditing of what was imported, when, and from which file.
    Future: could also track mapping versions or import profiles.
    """
    __tablename__ = "tender_imports"
    
    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=False)
    filename = Column(String, nullable=False)
    format_type = Column(String, default="kn_row_based")  # kn_row_based, custom, etc.
    imported_at = Column(DateTime, default=datetime.utcnow)
    lane_count = Column(Integer, default=0)
    notes = Column(String, nullable=True)
    
    tender = relationship("Tender", back_populates="imports")


class TenderRate(Base):
    """
    A single lane/carrier rate within a tender.
    Stores cost (buy) rates as a snapshot. Selling price is computed via tender markup.
    Supports per-rate validity dates so rates can have different expiry windows.
    """
    __tablename__ = "tender_rates"
    
    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=False)
    tender_import_id = Column(Integer, ForeignKey("tender_imports.id"), nullable=True)  # track import source
    source_rate_id = Column(Integer, nullable=True)   # reference to AirFreightRate if added from dashboard
    lane_id = Column(String, nullable=True)           # KN Lane ID from TE Connect / KN system
    
    airline = Column(String, nullable=False)
    product = Column(String, nullable=True)
    origin = Column(String, nullable=True)
    destination = Column(String, nullable=True)
    via = Column(String, nullable=True)
    routing = Column(String, nullable=True)           # Full routing string e.g. OSL-DOH-BKK
    currency = Column(String, nullable=True)
    terms = Column(String, nullable=True)             # DTD, DTA, ATA, ATD
    
    # Cost (buy) rates — main carriage
    cost_min = Column(Float, nullable=True)
    cost_normal = Column(Float, nullable=True)
    cost_q45 = Column(Float, nullable=True)
    cost_q100 = Column(Float, nullable=True)
    cost_q300 = Column(Float, nullable=True)
    cost_q500 = Column(Float, nullable=True)
    cost_q1000 = Column(Float, nullable=True)
    cost_q3000 = Column(Float, nullable=True)
    
    # Rate-level validity (overrides tender-level if set)
    valid_from = Column(DateTime, nullable=True)
    valid_until = Column(DateTime, nullable=True)
    
    # Meta
    notes = Column(Text, nullable=True)
    is_selected = Column(Boolean, default=False)      # Mark preferred/selected rates
    sort_order = Column(Integer, default=0)           # Manual ordering
    
    tender = relationship("Tender", back_populates="rates")
