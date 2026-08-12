"""backend/app/data/places.json의 address를 카카오 로컬 API(주소 검색)로 좌표(lat/lng)로
변환해 파일에 채워 넣는다. 지도(동선 직선 표시)용 좌표를 요청 때마다 실시간으로 조회하지
않고, 이 스크립트를 한 번 실행해 미리 구워 넣는 방식이다.

실행:
    cd backend
    source venv/bin/activate
    python scripts/geocode_places.py

새 관광지·음식점을 places.json에 추가한 뒤 이 스크립트를 다시 실행하면, 이미 좌표가
채워진 레코드는 건드리지 않고(재요청 절약) 좌표가 없는 레코드만 새로 채운다.
--force를 주면 전부 다시 조회한다.
"""

import argparse
import json
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
PLACES_PATH = BACKEND_DIR / "app" / "data" / "places.json"
ADDRESS_SEARCH_URL = "https://dapi.kakao.com/v2/local/search/address.json"
KEYWORD_SEARCH_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"


load_dotenv(BACKEND_DIR / ".env")


def _search(client: httpx.Client, api_key: str, url: str, query: str) -> tuple[float, float] | None:
    response = client.get(
        url,
        params={"query": query},
        headers={"Authorization": f"KakaoAK {api_key}"},
        timeout=10.0,
    )
    response.raise_for_status()
    documents = response.json().get("documents", [])
    if not documents:
        return None
    doc = documents[0]
    return float(doc["y"]), float(doc["x"])  # 카카오는 y=위도(lat), x=경도(lng)


def geocode_address(
    client: httpx.Client, api_key: str, address: str, name: str, region: str
) -> tuple[float, float] | None:
    """도로명 주소로 먼저 찾고, 실패하면(정확한 주소 형식이 아니거나 등록 안 된 주소)
    "지역 + 장소 이름" 키워드 검색으로 한 번 더 시도한다. 키워드 검색에 (틀렸을 수 있는)
    address 전체를 그대로 넣으면 오히려 매칭이 안 돼, 지역명만 붙여서 검색한다."""
    result = _search(client, api_key, ADDRESS_SEARCH_URL, address)
    if result is not None:
        return result
    return _search(client, api_key, KEYWORD_SEARCH_URL, f"{region} {name}")


def main() -> int:
    import os

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="이미 좌표가 있는 레코드도 다시 조회한다")
    args = parser.parse_args()

    api_key = os.environ.get("KAKAO_REST_API_KEY", "").strip()
    if not api_key:
        print("KAKAO_REST_API_KEY가 backend/.env에 설정되어 있지 않습니다.", file=sys.stderr)
        return 1

    places = json.loads(PLACES_PATH.read_text(encoding="utf-8"))

    targets = [p for p in places if args.force or p.get("lat") is None or p.get("lng") is None]
    if not targets:
        print("모든 레코드에 이미 좌표가 있습니다 (--force로 강제 재조회 가능).")
        return 0

    print(f"{len(targets)}개 장소 좌표 변환 시작...")
    failures: list[str] = []
    with httpx.Client() as client:
        for place in targets:
            try:
                result = geocode_address(client, api_key, place["address"], place["name"], place["region"])
            except httpx.HTTPError as exc:
                failures.append(f'{place["placeId"]} ({place["name"]}): {exc}')
                continue

            if result is None:
                failures.append(f'{place["placeId"]} ({place["name"]}): 주소 검색 결과 없음 - {place["address"]}')
                continue

            lat, lng = result
            place["lat"] = lat
            place["lng"] = lng
            print(f'  {place["placeId"]} {place["name"]}: {lat}, {lng}')
            time.sleep(0.05)  # 무료 쿼터 안에서도 예의상 살짝 간격을 둔다.

    PLACES_PATH.write_text(json.dumps(places, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"\n완료: {len(targets) - len(failures)}개 성공, {len(failures)}개 실패.")
    if failures:
        print("실패 목록:")
        for line in failures:
            print(f"  - {line}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
