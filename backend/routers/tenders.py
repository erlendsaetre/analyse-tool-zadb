from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models, schemas
import openpyxl
import io

router = APIRouter()


@router.post("/import-te-connect")
async def import_te_connect(
    file: UploadFile = File(...),
    tender_name: str = Form(...),
    tender_description: str = Form(None),
    db: Session = Depends(get_db)
):
    """Import a TE Connect Excel file and create a tender with all lanes."""
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="Only Excel files are supported.")

    try:
        contents = await file.read()
        wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)

        # Find the Row_based sheet
        sheet_name = None
        for name in wb.sheetnames:
            if name.lower().startswith("row_based") or name == "Row_based":
                sheet_name = name
                break
        if not sheet_name:
            # Fallback to first sheet
            sheet_name = wb.sheetnames[0]

        ws = wb[sheet_name]

        # Create the tender
        tender = models.Tender(
            name=tender_name,
            description=tender_description or f"Imported from {file.filename}"
        )
        db.add(tender)
        db.flush()

        # Column mapping (1-indexed for openpyxl)
        # Based on analysis of TE Connect format: headers on row 12, data from row 14
        COL_MAP = {
            'H': 8,    # KN Lane ID
            'P': 16,   # Origin Country Code
            'S': 19,   # Origin City
            'X': 24,   # KN Origin Airport
            'Y': 25,   # KN Origin Gateway
            'AG': 33,  # Destination Country Code
            'AJ': 36,  # Destination City
            'AO': 41,  # KN Destination Airport
            'AP': 42,  # KN Destination Gateway
            'AV': 48,  # Weekly demand
            'BM': 65,  # KN Service Level
            'BN': 66,  # KN Product
            'BO': 67,  # Terms of Delivery
            'CC': 81,  # Origin Currency
            'DE': 109,  # Main Carriage Currency
            'DM': 117, # Main Carriage (MIN)
            'DN': 118, # Main Carriage (+0KG)
            'DO': 119, # Main Carriage (+45KG)
            'DP': 120, # Main Carriage (+100KG)
            'DQ': 121, # Main Carriage (+300KG)
            'DR': 122, # Main Carriage (+500KG)
            'DS': 123, # Main Carriage (+1000KG)
            'DT': 124, # Main Carriage (+3000KG)
            'DW': 127, # Fuel Charge
            'EB': 132, # Carrier
            'EC': 133, # Routing
            'ED': 134, # Transit Airport
        }

        def safe_float(val):
            if val is None:
                return None
            try:
                return float(val)
            except (ValueError, TypeError):
                return None

        def safe_str(val):
            if val is None:
                return ""
            return str(val).strip()

        rate_count = 0
        # Data rows start at row 14 (1-indexed)
        for row_idx in range(14, ws.max_row + 1):
            # Skip rows without a lane ID
            lane_id = ws.cell(row=row_idx, column=COL_MAP['H']).value
            if not lane_id:
                continue

            origin_airport = safe_str(ws.cell(row=row_idx, column=COL_MAP['X']).value)
            dest_airport = safe_str(ws.cell(row=row_idx, column=COL_MAP['AO']).value)
            carrier = safe_str(ws.cell(row=row_idx, column=COL_MAP['EB']).value)
            routing = safe_str(ws.cell(row=row_idx, column=COL_MAP['EC']).value)
            product = safe_str(ws.cell(row=row_idx, column=COL_MAP['BN']).value)
            service_level = safe_str(ws.cell(row=row_idx, column=COL_MAP['BM']).value)
            currency = safe_str(ws.cell(row=row_idx, column=COL_MAP['DE']).value)
            origin_city = safe_str(ws.cell(row=row_idx, column=COL_MAP['S']).value)
            dest_city = safe_str(ws.cell(row=row_idx, column=COL_MAP['AJ']).value)
            transit = safe_str(ws.cell(row=row_idx, column=COL_MAP['ED']).value)

            # Build airline string from carrier code
            airline_str = carrier if carrier else "Unknown"

            # Build via from routing/transit
            via = transit if transit else ""

            tender_rate = models.TenderRate(
                tender_id=tender.id,
                airline=airline_str,
                product=f"{product} ({service_level})" if service_level else product,
                origin=origin_airport,
                destination=dest_airport,
                via=via if via else (routing if routing else None),
                currency=currency or "NOK",
                cost_min=safe_float(ws.cell(row=row_idx, column=COL_MAP['DM']).value),
                cost_normal=safe_float(ws.cell(row=row_idx, column=COL_MAP['DN']).value),
                cost_q45=safe_float(ws.cell(row=row_idx, column=COL_MAP['DO']).value),
                cost_q100=safe_float(ws.cell(row=row_idx, column=COL_MAP['DP']).value),
                cost_q300=safe_float(ws.cell(row=row_idx, column=COL_MAP['DQ']).value),
                cost_q500=safe_float(ws.cell(row=row_idx, column=COL_MAP['DR']).value),
                cost_q1000=safe_float(ws.cell(row=row_idx, column=COL_MAP['DS']).value),
                cost_q3000=safe_float(ws.cell(row=row_idx, column=COL_MAP['DT']).value),
                notes=f"Lane {lane_id} | {origin_city} → {dest_city} | {routing}"
            )
            db.add(tender_rate)
            rate_count += 1

        tender.description = (tender_description or f"Imported from {file.filename}") + f" ({rate_count} lanes)"
        db.commit()
        db.refresh(tender)

        return {
            "message": f"Successfully imported {rate_count} lanes into tender '{tender_name}'",
            "tender_id": tender.id,
            "rate_count": rate_count
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error parsing file: {str(e)}")


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
