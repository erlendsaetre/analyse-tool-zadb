from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas

router = APIRouter()


@router.get("/", response_model=List[schemas.TenderListItem])
def list_tenders(db: Session = Depends(get_db)):
    tenders = db.query(models.Tender).order_by(models.Tender.updated_at.desc()).all()
    result = []
    for t in tenders:
        result.append(schemas.TenderListItem(
            id=t.id,
            name=t.name,
            description=t.description,
            status=t.status,
            created_at=t.created_at,
            updated_at=t.updated_at,
            rate_count=len(t.rates)
        ))
    return result


@router.post("/", response_model=schemas.TenderResponse)
def create_tender(tender: schemas.TenderCreate, db: Session = Depends(get_db)):
    db_tender = models.Tender(
        name=tender.name,
        description=tender.description
    )
    db.add(db_tender)
    db.commit()
    db.refresh(db_tender)
    return db_tender


@router.get("/{tender_id}", response_model=schemas.TenderResponse)
def get_tender(tender_id: int, db: Session = Depends(get_db)):
    tender = db.query(models.Tender).filter(models.Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    return tender


@router.put("/{tender_id}", response_model=schemas.TenderResponse)
def update_tender(tender_id: int, update: schemas.TenderUpdate, db: Session = Depends(get_db)):
    tender = db.query(models.Tender).filter(models.Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    
    update_data = update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(tender, key, value)
    
    db.commit()
    db.refresh(tender)
    return tender


@router.delete("/{tender_id}")
def delete_tender(tender_id: int, db: Session = Depends(get_db)):
    tender = db.query(models.Tender).filter(models.Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    db.delete(tender)
    db.commit()
    return {"message": f"Tender '{tender.name}' deleted"}


@router.post("/{tender_id}/rates", response_model=schemas.TenderRateResponse)
def add_rate_to_tender(tender_id: int, rate: schemas.TenderRateCreate, db: Session = Depends(get_db)):
    tender = db.query(models.Tender).filter(models.Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    
    db_rate = models.TenderRate(
        tender_id=tender_id,
        source_rate_id=rate.source_rate_id,
        airline=rate.airline,
        product=rate.product,
        origin=rate.origin,
        destination=rate.destination,
        via=rate.via,
        currency=rate.currency,
        cost_min=rate.cost_min,
        cost_normal=rate.cost_normal,
        cost_q45=rate.cost_q45,
        cost_q100=rate.cost_q100,
        cost_q300=rate.cost_q300,
        cost_q500=rate.cost_q500,
        cost_q1000=rate.cost_q1000,
        cost_q3000=rate.cost_q3000,
        notes=rate.notes
    )
    db.add(db_rate)
    db.commit()
    db.refresh(db_rate)
    return db_rate


@router.put("/{tender_id}/rates/{rate_id}", response_model=schemas.TenderRateResponse)
def update_tender_rate(tender_id: int, rate_id: int, update: schemas.TenderRateUpdate, db: Session = Depends(get_db)):
    rate = db.query(models.TenderRate).filter(
        models.TenderRate.id == rate_id,
        models.TenderRate.tender_id == tender_id
    ).first()
    if not rate:
        raise HTTPException(status_code=404, detail="Rate not found in this tender")
    
    update_data = update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rate, key, value)
    
    db.commit()
    db.refresh(rate)
    return rate


@router.delete("/{tender_id}/rates/{rate_id}")
def delete_tender_rate(tender_id: int, rate_id: int, db: Session = Depends(get_db)):
    rate = db.query(models.TenderRate).filter(
        models.TenderRate.id == rate_id,
        models.TenderRate.tender_id == tender_id
    ).first()
    if not rate:
        raise HTTPException(status_code=404, detail="Rate not found in this tender")
    db.delete(rate)
    db.commit()
    return {"message": "Rate removed from tender"}
