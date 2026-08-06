from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import upload, rates, uploads, tenders

# Create database tables
Base.metadata.create_all(bind=engine)

# Run database migrations to add any missing columns/tables
try:
    from migrate import run_migrations
    run_migrations()
except Exception as e:
    print(f"Warning: Migration failed: {e}")

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
app.include_router(tenders.router, prefix="/api/tenders", tags=["tenders"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Air Freight Rate Analysis API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
