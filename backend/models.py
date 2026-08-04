from sqlalchemy import Column, Integer, String, Float
from .database import Base

class AirFreightRate(Base):
    __tablename__ = "air_freight_rates"

    id = Column(Integer, primary_key=True, index=True)
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
