from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import models, schemas

router = APIRouter()

@router.get("/", response_model=List[schemas.AirFreightRate])
def get_rates(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    rates = db.query(models.AirFreightRate).offset(skip).limit(limit).all()
    return rates

@router.delete("/")
def clear_rates(db: Session = Depends(get_db)):
    db.query(models.AirFreightRate).delete()
    db.commit()
    return {"message": "All rates cleared"}
