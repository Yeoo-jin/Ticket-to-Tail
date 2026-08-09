import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routes import bookings, diaries, health, places, timelines, weather
from app.utils.errors import AppError

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": {"code": exc.code, "message": exc.message}},
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "error": {"code": "INVALID_INPUT", "message": "필수 입력값이 누락되었습니다."},
        },
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    logger.exception("처리되지 않은 서버 오류가 발생했습니다.")
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": {"code": "INTERNAL_ERROR", "message": "서버 오류가 발생했습니다."}},
    )


app.include_router(health.router)
app.include_router(bookings.router)
app.include_router(places.router)
app.include_router(timelines.router)
app.include_router(diaries.router)
app.include_router(weather.router)
