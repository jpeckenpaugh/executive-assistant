from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from .db import Base, engine, SessionLocal
from .services.seed import seed
from .routers.app import router

@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(engine)
    with SessionLocal() as session: seed(session)
    yield
app=FastAPI(title="Executive Assistant", lifespan=lifespan)
app.state.templates=Jinja2Templates(directory="backend/templates")
app.mount("/static",StaticFiles(directory="backend/static"),name="static")
app.include_router(router)
