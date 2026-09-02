"""Single source of local, naive time used by the application."""
from datetime import datetime

def now() -> datetime:
    return datetime.now().replace(microsecond=0)

def today():
    return now().date()
