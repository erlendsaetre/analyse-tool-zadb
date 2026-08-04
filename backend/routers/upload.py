import pandas as pd
from openpyxl import load_workbook
import io
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
import math

router = APIRouter()

@router.post("/", response_model=schemas.UploadResponse)
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="Only Excel files are supported.")
        
    try:
        contents = await file.read()
        
        # Read the Excel file, specifically the "ML-Rates" sheet
        try:
            df = pd.read_excel(io.BytesIO(contents), sheet_name="ML-Rates")
        except ValueError:
            raise HTTPException(status_code=400, detail="Sheet 'ML-Rates' not found in the Excel file.")

        # Clean the dataframe (drop empty rows)
        df.dropna(how='all', inplace=True)
        
        # Map columns (assuming headers are in the first row or pandas inferred them)
        # For a robust solution, we use column indices or exact names based on the schema
        # A: Airline, B: Product, C: Origin, D: Destination, E: Via, F: Relation Kg/m3, G: Fuel, H: Security Surc, I: Fixed, J: Min, K: Normal, L: q45, M: q100, N: q300, O: q500, P: q1000, Q: q3000, R: Currency
        
        expected_columns = [
            "Airline", "Product", "Origin", "Destination", "Via", 
            "Relation Kg/m3", "Fuel", "Security Surc", "Fixed", "Min",
            "Normal", "q45", "q100", "q300", "q500", "q1000", "q3000", "Currency"
        ]
        
        # If headers are slightly different, we might need to map them manually.
        # Let's just iterate over rows to be safe.
        saved_count = 0
        
        for index, row in df.iterrows():
            # Basic validation
            airline = str(row.iloc[0])
            if pd.isna(row.iloc[0]) or airline == 'nan':
                continue
                
            def safe_float(val):
                if pd.isna(val) or val == 'No' or val == 'nan' or str(val).strip() == '':
                    return None
                try:
                    return float(val)
                except ValueError:
                    return None
                    
            def safe_str(val):
                if pd.isna(val) or val == 'nan':
                    return ""
                return str(val).strip()
            
            rate = models.AirFreightRate(
                airline=safe_str(row.iloc[0]),
                product=safe_str(row.iloc[1]),
                origin=safe_str(row.iloc[2]),
                destination=safe_str(row.iloc[3]),
                via=safe_str(row.iloc[4]),
                relation_kg_m3=safe_float(row.iloc[5]),
                fuel=safe_str(row.iloc[6]),
                security_surcharge=safe_str(row.iloc[7]),
                fixed=safe_str(row.iloc[8]),
                min_rate=safe_float(row.iloc[9]),
                normal_rate=safe_float(row.iloc[10]),
                q45=safe_float(row.iloc[11]),
                q100=safe_float(row.iloc[12]),
                q300=safe_float(row.iloc[13]),
                q500=safe_float(row.iloc[14]),
                q1000=safe_float(row.iloc[15]),
                q3000=safe_float(row.iloc[16]),
                currency=safe_str(row.iloc[17])
            )
            db.add(rate)
            saved_count += 1
            
        db.commit()
        
        return schemas.UploadResponse(message=f"Successfully processed and saved {saved_count} rates.", count=saved_count)
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
