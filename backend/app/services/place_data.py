"""backend/app/data/places.json 로딩.

이 파일의 운영시간·체류시간·주소는 실시간 관광 정보가 아니라
예선 데모용 샘플 데이터다 (docs/idea.md 5절: 본선에서 실제 관광 공공데이터로 대체 예정).
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import List

from app.schemas.place import PlaceRecord

_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "places.json"


@lru_cache(maxsize=1)
def load_places() -> List[PlaceRecord]:
    with _DATA_PATH.open(encoding="utf-8") as f:
        raw_records = json.load(f)
    return [PlaceRecord.model_validate(record) for record in raw_records]
