from fastapi import APIRouter

from app.schemas.weather import WeatherForecastRequest, WeatherForecastResponse
from app.services.weather_service import get_weather_forecast

router = APIRouter(prefix="/api/weather", tags=["weather"])


@router.post("/forecast", response_model=WeatherForecastResponse)
def check_weather_forecast(request: WeatherForecastRequest) -> WeatherForecastResponse:
    data = get_weather_forecast(request.destination)
    return WeatherForecastResponse(data=data)
