"""Validation helpers shared by the HTML routers."""
from datetime import datetime
from fastapi import HTTPException

def text(value: str, label: str) -> str:
    value = value.strip()
    if not value: raise HTTPException(422, f"{label} is required")
    return value
def local_datetime(value: str, label: str, required=False):
    if not value.strip():
        if required: raise HTTPException(422, f"{label} is required")
        return None
    try: return datetime.fromisoformat(value)
    except ValueError: raise HTTPException(422, f"{label} must be a local ISO date/time")
def choice(value: str, choices: set[str], label: str) -> str:
    if value not in choices: raise HTTPException(422, f"Invalid {label}")
    return value
