from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.core.database import get_db
from app.services.import_engine import ImportEngine
from pydantic import BaseModel

router = APIRouter(prefix="/data-import", tags=["data-import"])

class CommitImportRequest(BaseModel):
    org_id: int
    records: List[Dict[str, Any]]
    mode: str = "continue_valid"  # continue_valid or strict

@router.post("/preview")
async def preview_file(
    org_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Parses uploaded CSV or Excel file, automatically detects column mappings,
    checks for missing fields and duplicates, and returns a detailed preview
    and data quality score.
    """
    if not (file.filename.endswith(".csv") or file.filename.endswith(".xlsx") or file.filename.endswith(".xls")):
        raise HTTPException(status_code=400, detail="Only .csv and .xlsx files are supported")

    content = await file.read()
    result = ImportEngine.parse_and_validate(
        file_bytes=content,
        filename=file.filename,
        org_id=org_id,
        db=db
    )
    return result

@router.post("/commit")
def commit_imported_data(payload: CommitImportRequest, db: Session = Depends(get_db)):
    """
    Commits verified spreadsheet rows to the database.
    Supports transactional safety and modes (continue_valid or strict).
    """
    res = ImportEngine.commit_import(
        org_id=payload.org_id,
        records=payload.records,
        db=db,
        mode=payload.mode
    )
    return res

@router.get("/template")
def get_sample_csv_template():
    """
    Returns a sample CSV format for staff import.
    """
    csv_content = (
        "Name,Email,Employee Code,Role,Department,Skills,Qualifications,Phone,Weekly Hours Limit\n"
        "Dr. Eleanor Vance,eleanor.vance@college.edu,EMP-101,Associate Professor,Computer Science & Eng,\"DBMS, SQL, Python\",\"M.Tech, Ph.D\",+1-555-0192,36\n"
        "Marcus Sterling,marcus.s@company.io,EMP-102,Senior Full-Stack Dev,Engineering,\"React, TypeScript, FastAPI, Docker\",\"B.Tech CSE\",+1-555-0144,40\n"
        "Sarah Jenkins,sarah.j@hospital.org,EMP-103,Lead RN Nurse,Emergency Room (ER),\"ICU, Emergency, ACLS / CPR, Triage\",\"BSN, RN\",+1-555-0188,38\n"
        "David K. Chen,david.chen@college.edu,EMP-104,Assistant Professor,Computer Science & Eng,\"Python, Machine Learning, Data Structures\",\"M.Tech CSE\",+1-555-0172,40\n"
        "Elena Rostova,elena.r@logistics.net,EMP-105,Fleet Supervisor,Fleet Transport,\"Fleet Transport, Logistics, Safety Routing\",\"B.Sc Logistics\",+1-555-0155,42\n"
    )
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=staff_import_template.csv"}
    )
