import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import health

load_dotenv()

app = FastAPI(title="Ticket to Tale API")

default_origins = "http://localhost:5173,http://127.0.0.1:5173"
frontend_origins = os.getenv("FRONTEND_ORIGIN", default_origins).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
