from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import distinct, func
from typing import List, Optional
from database import get_db
import models, schemas

router = APIRouter()

@router.get("/", response_model=List[schemas.AirFreightRate])
def get_rates(
    skip: int = 0,
    limit: int = 1000,
    origin: Optional[str] = None,
    destination: Optional[str] = None,
    airline: Optional[str] = None,
    upload_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.AirFreightRate)
    if origin:
        query = query.filter(models.AirFreightRate.origin == origin)
    if destination:
        query = query.filter(models.AirFreightRate.destination == destination)
    if airline:
        query = query.filter(models.AirFreightRate.airline == airline)
    if upload_id:
        query = query.filter(models.AirFreightRate.upload_id == upload_id)
    return query.offset(skip).limit(limit).all()

@router.get("/routes", response_model=List[schemas.RouteInfo])
def get_routes(db: Session = Depends(get_db)):
    routes = db.query(
        distinct(models.AirFreightRate.origin),
        models.AirFreightRate.destination
    ).group_by(
        models.AirFreightRate.origin,
        models.AirFreightRate.destination
    ).all()
    return [schemas.RouteInfo(origin=r[0], destination=r[1]) for r in routes]

@router.get("/airlines", response_model=List[str])
def get_airlines(db: Session = Depends(get_db)):
    airlines = db.query(distinct(models.AirFreightRate.airline)).all()
    return [a[0] for a in airlines if a[0]]

@router.get("/analytics", response_model=schemas.AnalyticsSummary)
def get_analytics(
    origin: Optional[str] = None,
    destination: Optional[str] = None,
    upload_id: Optional[int] = None,
    weight_bracket: str = "q100",
    db: Session = Depends(get_db)
):
    query = db.query(models.AirFreightRate)
    if origin:
        query = query.filter(models.AirFreightRate.origin == origin)
    if destination:
        query = query.filter(models.AirFreightRate.destination == destination)
    if upload_id:
        query = query.filter(models.AirFreightRate.upload_id == upload_id)
    
    rates = query.all()
    
    if not rates:
        return schemas.AnalyticsSummary(
            total_rates=0,
            total_airlines=0,
            airlines_with_prices=0,
            weight_bracket=weight_bracket
        )
    
    # Get the price field based on weight bracket
    bracket_map = {
        "min_rate": "min_rate",
        "normal_rate": "normal_rate",
        "q45": "q45",
        "q100": "q100",
        "q300": "q300",
        "q500": "q500",
        "q1000": "q1000",
        "q3000": "q3000"
    }
    field = bracket_map.get(weight_bracket, "q100")
    
    all_airlines = set()
    airlines_with_price = set()
    prices = []
    cheapest = None
    cheapest_price = None
    cheapest_product = None
    
    for rate in rates:
        all_airlines.add(rate.airline)
        price = getattr(rate, field)
        if price is not None and price > 0:
            airlines_with_price.add(rate.airline)
            prices.append(price)
            if cheapest_price is None or price < cheapest_price:
                cheapest_price = price
                cheapest = rate.airline
                cheapest_product = rate.product
    
    return schemas.AnalyticsSummary(
        total_rates=len(rates),
        total_airlines=len(all_airlines),
        airlines_with_prices=len(airlines_with_price),
        cheapest_airline=cheapest,
        cheapest_product=cheapest_product,
        cheapest_price=cheapest_price,
        price_range_min=min(prices) if prices else None,
        price_range_max=max(prices) if prices else None,
        weight_bracket=weight_bracket
    )

@router.get("/comparison", response_model=List[schemas.ComparisonItem])
def get_comparison(
    origin: Optional[str] = None,
    destination: Optional[str] = None,
    upload_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.AirFreightRate)
    if origin:
        query = query.filter(models.AirFreightRate.origin == origin)
    if destination:
        query = query.filter(models.AirFreightRate.destination == destination)
    if upload_id:
        query = query.filter(models.AirFreightRate.upload_id == upload_id)
    
    rates = query.order_by(models.AirFreightRate.airline).all()
    
    return [
        schemas.ComparisonItem(
            airline=r.airline,
            product=r.product,
            via=r.via,
            min_rate=r.min_rate,
            normal_rate=r.normal_rate,
            q45=r.q45,
            q100=r.q100,
            q300=r.q300,
            q500=r.q500,
            q1000=r.q1000,
            q3000=r.q3000,
            currency=r.currency
        )
        for r in rates
    ]

@router.delete("/")
def clear_rates(db: Session = Depends(get_db)):
    db.query(models.AirFreightRate).delete()
    db.query(models.Upload).delete()
    db.commit()
    return {"message": "All rates and uploads cleared"}
