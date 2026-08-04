from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import upload, rates, uploads

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Air Freight Rate Analysis API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(rates.router, prefix="/api/rates", tags=["rates"])
app.include_router(uploads.router, prefix="/api/uploads", tags=["uploads"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Air Freight Rate Analysis API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
