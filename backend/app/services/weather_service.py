"""여행 지역 단기예보(강수확률·하늘상태) 조회.

기상청 API허브(apihub.kma.go.kr)의 "단기 육상예보" API를 사용한다. 예보구역코드(REG_ID)
기준으로 텍스트(콤마 구분) 형식의 예보를 반환하며, 하루 2회(주간/야간) 해상도다.
지역명 -> REG_ID 매핑은 apihub의 "단기 예보구역 조회" API로 직접 확인한 값을 고정 테이블로 둔다
(현재 관광지 데이터가 소수 지역만 다루므로 위경도->격자 변환 없이 이 방식이 더 간단하고 안전하다).

이 서비스도 "있으면 좋은" 부가 정보이므로, 조회 실패 시 예외를 던지지 않고 found=False로 반환한다.
"""

import logging
import os
from typing import Optional

import httpx

from app.schemas.weather import WeatherForecastData

logger = logging.getLogger(__name__)

_BASE_URL = "https://apihub.kma.go.kr/api/typ01/url/fct_afs_dl.php"
_TIMEOUT_SECONDS = 8.0

# apihub "단기 예보구역 조회"(fct_shrt_reg.php)로 직접 확인한 도시(C: 도시) 단위 코드.
_REGION_CODES = {
    "부산": "11H20201",
    "서울": "11B10101",
    "제주": "11G00201",
    "경주": "11H10202",
}

_NOT_FOUND = WeatherForecastData(found=False, message="날씨 정보를 찾을 수 없습니다.")


def _resolve_region_code(destination: str) -> Optional[str]:
    for name, code in _REGION_CODES.items():
        if name in destination:
            return code
    return None


def _get_auth_key() -> Optional[str]:
    key = os.getenv("KMA_API_KEY")
    if not key:
        logger.warning("KMA_API_KEY 환경변수가 설정되지 않았습니다.")
        return None
    return key


def _parse_forecast_lines(text: str) -> list:
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        fields = line.split(",")
        if len(fields) < 17:
            continue
        rows.append(fields)
    return rows


def get_weather_forecast(destination: str) -> WeatherForecastData:
    region_code = _resolve_region_code(destination)
    if region_code is None:
        return WeatherForecastData(found=False, message="이 지역은 날씨 조회를 지원하지 않습니다.")

    key = _get_auth_key()
    if key is None:
        return _NOT_FOUND

    try:
        response = httpx.get(
            _BASE_URL,
            params={"authKey": key, "reg": region_code, "tmfc1": "0", "tmfc2": "0", "disp": "1"},
            timeout=_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as exc:
        logger.warning("기상청 API 호출 실패: %s", type(exc).__name__)
        return _NOT_FOUND

    if response.status_code != 200:
        logger.warning("기상청 API 응답 오류: status=%s", response.status_code)
        return _NOT_FOUND

    rows = _parse_forecast_lines(response.text)
    if not rows:
        return _NOT_FOUND

    # TA(기온)가 -99(값 없음)인 행은 건너뛰고, 가장 먼저 나오는 유효한 예보 구간을 대표값으로 쓴다.
    for fields in rows:
        temperature_raw = fields[12]
        precipitation_flag = fields[15]
        weather_text = fields[16]

        try:
            temperature = int(temperature_raw)
        except ValueError:
            temperature = None
        if temperature == -99:
            continue

        return WeatherForecastData(
            found=True,
            precipitationExpected=precipitation_flag == "1",
            sky=weather_text,
            temperature=temperature,
            message=weather_text,
        )

    return _NOT_FOUND
