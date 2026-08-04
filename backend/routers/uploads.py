from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas

router = APIRouter()

@router.get("/", response_model=List[schemas.UploadResponse])
def get_uploads(db: Session = Depends(get_db)):
    uploads = db.query(models.Upload).order_by(models.Upload.upload_date.desc()).all()
    return uploads

@router.delete("/{upload_id}")
def delete_upload(upload_id: int, db: Session = Depends(get_db)):
    upload = db.query(models.Upload).filter(models.Upload.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    db.delete(upload)
    db.commit()
    return {"message": f"Upload '{upload.filename}' and its rates deleted"}
