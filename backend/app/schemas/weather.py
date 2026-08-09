from typing import Optional

from pydantic import BaseModel


class WeatherForecastRequest(BaseModel):
    destination: str


class WeatherForecastData(BaseModel):
    found: bool
    precipitationExpected: bool = False
    sky: Optional[str] = None
    temperature: Optional[int] = None
    message: str


class WeatherForecastResponse(BaseModel):
    success: bool = True
    data: WeatherForecastData
