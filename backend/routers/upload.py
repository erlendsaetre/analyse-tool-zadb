import pandas as pd
from openpyxl import load_workbook
import io
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
import math
from datetime import datetime

router = APIRouter()

@router.post("/", response_model=schemas.UploadCreateResponse)
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="Only Excel files are supported.")
        
    try:
        contents = await file.read()
        
        try:
            df = pd.read_excel(io.BytesIO(contents), sheet_name="ML-Rates")
        except ValueError:
            raise HTTPException(status_code=400, detail="Sheet 'ML-Rates' not found in the Excel file.")

        df.dropna(how='all', inplace=True)
        
        # Create upload record
        upload_record = models.Upload(
            filename=file.filename,
            upload_date=datetime.utcnow(),
            record_count=0
        )
        db.add(upload_record)
        db.flush()  # Get the ID
        
        saved_count = 0
        
        for index, row in df.iterrows():
            # Support both old and new formats by using .get() with fallback
            # Old format had Airline at index 0, but pandas reads it as header if not careful,
            # so we use column names for robustness.
            airline_val = row.get('Airline')
            
            # If 'Airline' column not found, fallback to old positional logic if needed,
            # but pandas reads the first row as columns anyway. Let's assume standard headers.
            if pd.isna(airline_val) or str(airline_val) == 'nan' or not airline_val:
                # try fallback to first column
                airline_val = row.iloc[0] if len(row) > 0 else None
                if pd.isna(airline_val) or str(airline_val) == 'nan' or not airline_val:
                    continue
            
            def safe_float(col_name, fallback_idx=None):
                val = row.get(col_name)
                if val is None and fallback_idx is not None and fallback_idx < len(row):
                    val = row.iloc[fallback_idx]
                if pd.isna(val) or val == 'No' or str(val).strip().lower() in ('nan', ''):
                    return None
                try:
                    return float(val)
                except (ValueError, TypeError):
                    return None
                    
            def safe_str(col_name, fallback_idx=None):
                val = row.get(col_name)
                if val is None and fallback_idx is not None and fallback_idx < len(row):
                    val = row.iloc[fallback_idx]
                if pd.isna(val) or str(val).strip().lower() in ('nan', ''):
                    return ""
                return str(val).strip()

            def safe_date(col_name):
                val = row.get(col_name)
                if pd.isna(val) or str(val).strip() in ('-', 'nan', ''):
                    return None
                if isinstance(val, datetime):
                    return val
                try:
                    # typical formats in Excel: 18/06/2024 or 2024-06-18
                    return pd.to_datetime(val, dayfirst=True).to_pydatetime()
                except Exception:
                    return None
            
            rate = models.AirFreightRate(
                upload_id=upload_record.id,
                airline=safe_str('Airline', 0),
                gsa=safe_str('GSA') if 'GSA' in df.columns else None,
                product=safe_str('Product', 1),
                origin=safe_str('Origin', 2),
                destination=safe_str('Destination', 3),
                via=safe_str('Via', 4),
                valid_from=safe_date('Valid') if 'Valid' in df.columns else None,
                valid_until=safe_date('Expires') if 'Expires' in df.columns else None,
                relation_kg_m3=safe_float('Relation Kg/m3', 5),
                fuel=safe_str('Fuel', 6),
                security_surcharge=safe_str('Security Surcharge', 7),
                fixed=safe_str('Fixed', 8),
                min_rate=safe_float('Min', 9),
                normal_rate=safe_float('Normal', 10),
                q45=safe_float('q45', 11),
                q100=safe_float('q100', 12),
                q300=safe_float('q300', 13),
                q500=safe_float('q500', 14),
                q1000=safe_float('q1000', 15),
                q3000=safe_float('q3000', 16),
                currency=safe_str('Currency', 17) or safe_str('Curr')
            )
            db.add(rate)
            saved_count += 1
            
        upload_record.record_count = saved_count
        db.commit()
        db.refresh(upload_record)
        
        return schemas.UploadCreateResponse(
            message=f"Successfully processed and saved {saved_count} rates.",
            count=saved_count,
            upload_id=upload_record.id,
            filename=upload_record.filename,
            upload_date=upload_record.upload_date
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
