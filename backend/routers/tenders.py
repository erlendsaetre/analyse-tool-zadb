"""
Tenders Router
==============
Handles all CRUD for Tenders, TenderRates, and file imports.
Uses smart_parser for auto-detecting and parsing any Excel file format.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models, schemas
import io
from datetime import datetime

router = APIRouter()


# ══════════════════════════════════════════════════════════════
#  Tender CRUD
# ══════════════════════════════════════════════════════════════

@router.get("/", response_model=List[schemas.TenderListItem])
def list_tenders(db: Session = Depends(get_db)):
    tenders = db.query(models.Tender).order_by(models.Tender.updated_at.desc()).all()
    result = []
    for t in tenders:
        result.append(schemas.TenderListItem(
            id=t.id,
            name=t.name,
            description=t.description,
            customer=t.customer,
            status=t.status,
            tender_url=t.tender_url,
            valid_until=t.valid_until,
            created_at=t.created_at,
            updated_at=t.updated_at,
            rate_count=len(t.rates)
        ))
    return result


@router.post("/", response_model=schemas.TenderResponse)
def create_tender(tender: schemas.TenderCreate, db: Session = Depends(get_db)):
    db_tender = models.Tender(
        name=tender.name,
        description=tender.description,
        customer=tender.customer,
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


# ══════════════════════════════════════════════════════════════
#  TenderRate CRUD
# ══════════════════════════════════════════════════════════════

@router.post("/{tender_id}/rates", response_model=schemas.TenderRateResponse)
def add_rate_to_tender(tender_id: int, rate: schemas.TenderRateCreate, db: Session = Depends(get_db)):
    tender = db.query(models.Tender).filter(models.Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    db_rate = models.TenderRate(tender_id=tender_id, **rate.model_dump())
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


# ══════════════════════════════════════════════════════════════
#  File Import — Preview (dry-run) + Commit
# ══════════════════════════════════════════════════════════════

@router.post("/{tender_id}/import/preview")
async def preview_import(
    tender_id: int,
    file: UploadFile = File(...),
):
    """
    Preview what the smart parser would extract from an Excel file.
    Returns detected format, column mapping, direction, and first 5 sample rows.
    Does NOT save anything to the database.
    """
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xls, .xlsx) are supported.")

    try:
        from smart_parser import smart_parse
        contents = await file.read()
        rates, metadata = smart_parse(contents)

        # Return first 5 rows as sample
        sample = []
        for r in rates[:5]:
            row = {k: v for k, v in r.items()}
            # Convert dates to strings for JSON
            if row.get('valid_from'):
                row['valid_from'] = row['valid_from'].isoformat()
            if row.get('valid_until'):
                row['valid_until'] = row['valid_until'].isoformat()
            sample.append(row)

        return {
            "filename": file.filename,
            "format_detected": metadata['format_detected'],
            "sheet_used": metadata['sheet_used'],
            "direction": metadata['direction'],
            "total_rates": metadata['total_rows'],
            "columns_mapped": metadata['columns_mapped'],
            "columns_unmapped": metadata['columns_unmapped'],
            "sample_rows": sample,
            "notes": metadata['notes']
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing file: {str(e)}")


@router.post("/{tender_id}/import")
async def import_file_into_tender(
    tender_id: int,
    file: UploadFile = File(...),
    import_notes: str = Form(None),
    db: Session = Depends(get_db)
):
    """
    Import an Excel file into an existing tender using smart auto-detection.
    Automatically detects the file format and extracts all rate information.
    """
    tender = db.query(models.Tender).filter(models.Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xls, .xlsx) are supported.")

    try:
        from smart_parser import smart_parse
        contents = await file.read()
        rates_data, metadata = smart_parse(contents)

        if not rates_data:
            raise HTTPException(status_code=400, detail=f"No rates found in file. {metadata['notes']}")

        # Record this import
        import_record = models.TenderImport(
            tender_id=tender_id,
            filename=file.filename,
            format_type=metadata['format_detected'],
            imported_at=datetime.utcnow(),
            lane_count=len(rates_data),
            notes=import_notes or metadata['notes']
        )
        db.add(import_record)
        db.flush()

        # Insert all extracted rates
        for rd in rates_data:
            db_rate = models.TenderRate(
                tender_id=tender_id,
                tender_import_id=import_record.id,
                lane_id=rd.get('lane_id'),
                airline=rd.get('airline', 'Unknown'),
                product=rd.get('product'),
                origin=rd.get('origin'),
                destination=rd.get('destination'),
                via=rd.get('via'),
                routing=rd.get('routing'),
                currency=rd.get('currency', 'NOK'),
                terms=rd.get('terms'),
                cost_min=rd.get('cost_min'),
                cost_normal=rd.get('cost_normal'),
                cost_q45=rd.get('cost_q45'),
                cost_q100=rd.get('cost_q100'),
                cost_q300=rd.get('cost_q300'),
                cost_q500=rd.get('cost_q500'),
                cost_q1000=rd.get('cost_q1000'),
                cost_q3000=rd.get('cost_q3000'),
                valid_from=rd.get('valid_from'),
                valid_until=rd.get('valid_until'),
                notes=rd.get('notes'),
            )
            db.add(db_rate)

        db.commit()

        return {
            "message": f"Imported {len(rates_data)} rates from '{file.filename}'",
            "tender_id": tender_id,
            "import_id": import_record.id,
            "lane_count": len(rates_data),
            "format_detected": metadata['format_detected'],
            "direction": metadata['direction'],
            "columns_mapped": metadata['columns_mapped'],
            "columns_unmapped": metadata['columns_unmapped'],
            "notes": metadata['notes']
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error parsing file: {str(e)}")
