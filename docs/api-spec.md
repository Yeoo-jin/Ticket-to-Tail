## 1. 공통 사항

- **Base URL:** `/api`
- **기본 요청·응답 형식:** JSON
- **사진 포함 요청:** `multipart/form-data`
- **성공:** `200 OK`
- **입력값 오류:** `400 Bad Request`
- **서버 또는 AI 처리 오류:** `500 Internal Server Error`

### 공통 오류 응답

```
{
  "success":false,
  "error": {
    "code":"INVALID_INPUT",
    "message":"필수 입력값이 누락되었습니다."
  }
}
```

---

# 2. 예매정보 텍스트 분석

## POST `/api/bookings/parse`

사용자가 입력한 항공·철도 예매정보에서 출발지, 도착지, 날짜, 시간 등의 정보를 추출한다.
텍스트 또는 사진(예매 내역 목록 캡처 화면) 둘 중 하나로 입력받으며, `multipart/form-data`로 요청한다
(사진이 없어도 `bookingText`만 form 필드로 보내는 방식으로 통일했다 — 사진 첨부 가능성이 있는
요청은 항상 `multipart/form-data`를 쓴다는 공통 규칙을 따름).

### 요청 (`multipart/form-data`)

| 필드 | 자료형 | 필수 | 설명 |
| --- | --- | --- | --- |
| `bookingText` | string (form field) | `photos`와 둘 중 하나 | 항공·철도 예매정보가 포함된 자유 텍스트 |
| `photos` | file (여러 개 가능) | `bookingText`와 둘 중 하나 | 예매 내역을 촬영·캡처한 이미지(jpg/png/webp, 장당 최대 5MB, 최대 5장). 예: 항공권 캡처 1장 + KTX 캡처 1장처럼 서로 다른 예매 건을 각각 다른 사진으로 첨부해도 되고, 한 장에 왕복 등 여러 건이 보여도 전부 추출한다 |

`bookingText`와 `photos`를 둘 다 보내거나 둘 다 안 보내면 `400 INVALID_INPUT`을 반환한다.

### 처리 내용

1. 텍스트 또는 사진에서 항공편과 열차 정보를 구분한다.
2. 출발지·도착지·날짜·시간을 추출한다.
3. 항공편명 또는 열차 편명·번호(`transitNumber`)가 있으면 함께 추출한다. 없으면 `null`.
4. 타임라인 생성에 사용할 수 있는 데이터 형태로 변환한다.
5. 필수 정보가 부족한 경우 누락된 항목을 반환한다.

사진 입력에서 AI 추출이 실패하면(텍스트처럼 규칙 기반 fallback을 쓸 수 없음) `500 AI_SERVICE_ERROR`로
응답하며, 프론트는 이때 텍스트 직접 입력으로 전환하도록 안내한다.

### 성공 응답

```
{
  "success":true,
  "data": {
    "bookings": [
      {
        "type":"flight",
        "transitNumber":null,
        "departureLocation":null,
        "arrivalLocation":"인천공항",
        "departureTime":null,
        "arrivalTime":"2026-08-12T10:30:00"
      },
      {
        "type":"train",
        "transitNumber":"KTX 101",
        "departureLocation":"서울역",
        "arrivalLocation":"부산역",
        "departureTime":"2026-08-12T13:20:00",
        "arrivalTime":"2026-08-12T16:05:00"
      },
      {
        "type":"flight",
        "transitNumber":"OZ102",
        "departureLocation":"인천공항",
        "arrivalLocation":null,
        "departureTime":"2026-08-14T18:00:00",
        "arrivalTime":null
      }
    ],
    "missingFields": []
  }
}
```

### 정보가 부족한 경우

```
{
  "success":true,
  "data": {
    "bookings": [
      {
        "type":"train",
        "transitNumber":null,
        "departureLocation":"서울역",
        "arrivalLocation":"부산역",
        "departureTime":null,
        "arrivalTime":null
      }
    ],
    "missingFields": ["열차 출발 날짜","열차 출발 시간"
    ]
  }
}
```

### 담당

- **백엔드·AI 로직:** 여진
- **입력 화면:** 서영

---

## POST `/api/bookings/status`

편명·열차번호를 기준으로 공공데이터포털(인천국제공항공사/한국철도공사) 실시간 운항 정보를 조회해
지연 여부를 반환한다. 부가 정보 API이므로 외부 API 호출이 실패하거나 일치하는 데이터를 찾지 못해도
오류를 내지 않고 `found:false`로 응답한다.

### 요청

```
{
  "type":"flight",
  "transitNumber":"OZ102",
  "departureLocation":"인천공항",
  "arrivalLocation":null,
  "departureTime":"2026-08-14T18:00:00",
  "arrivalTime":null
}
```

### 요청 필드

| 필드 | 자료형 | 필수 | 설명 |
| --- | --- | --- | --- |
| `type` | string | O | `flight` 또는 `train` |
| `transitNumber` | string | X | 편명 또는 열차번호. `/api/bookings/parse` 응답의 값을 그대로 전달 |
| `departureLocation` | string | X | 출발지 |
| `arrivalLocation` | string | X | 도착지 |
| `departureTime` | string | X | 출발 시각 (ISO 8601) |
| `arrivalTime` | string | X | 도착 시각 (ISO 8601) |

항공편은 인천공항 도착·출발 구간만 조회 가능하다(인천국제공항공사 API 특성). 그 외 구간은
`found:false`로 응답한다.

### 성공 응답

```
{
  "success":true,
  "data": {
    "found":true,
    "delayed":true,
    "delayMinutes":15,
    "scheduledTime":"2026-08-14T18:00:00",
    "actualTime":"2026-08-14T18:15:00",
    "message":"15분 지연되었습니다."
  }
}
```

### 정보를 찾지 못한 경우

```
{
  "success":true,
  "data": {
    "found":false,
    "delayed":false,
    "delayMinutes":null,
    "scheduledTime":null,
    "actualTime":null,
    "message":"실시간 운항 정보를 찾을 수 없습니다."
  }
}
```

### 담당

- **백엔드·API 연동:** 여진

---

## POST `/api/weather/forecast`

여행 지역의 단기예보(하늘상태·강수여부·기온)를 조회한다. 참고용 부가 정보이며, 관광지
추천 로직 자체를 바꾸지 않는다 — 화면에 안내로만 보여주고 실내/실외 선택은 사용자가 한다.
현재 부산·서울·제주·경주만 지원하며, 그 외 지역은 `found:false`로 응답한다.

### 요청

```
{
  "destination":"부산"
}
```

### 성공 응답

```
{
  "success":true,
  "data": {
    "found":true,
    "precipitationExpected":true,
    "sky":"흐리고 가끔 비",
    "temperature":26,
    "message":"흐리고 가끔 비"
  }
}
```

### 지원하지 않는 지역

```
{
  "success":true,
  "data": {
    "found":false,
    "precipitationExpected":false,
    "sky":null,
    "temperature":null,
    "message":"이 지역은 날씨 조회를 지원하지 않습니다."
  }
}
```

### 담당

- **백엔드·API 연동:** 여진

---

# 3. 관광지 후보 추천

### POST `/api/places/recommend`

여행 지역과 동행 조건, 예매정보(`bookings`)를 바탕으로 **여행 날짜별로** 관광지·음식점 후보를 추천한다.
예매정보의 도착~출발 시각으로 여행이 며칠짜리인지 계산해, 날짜마다 관광지 후보와 그날 해당하는
끼니(아침/점심/저녁)별 음식점 후보를 함께 반환한다. 관광지와 음식점은 서로 다른 후보 풀이며 개수를
나눠 쓰지 않는다(관광지 선택 개수가 음식점 선택 개수에 영향을 주지 않는다).

### 요청

```
{
  "destination":"부산",
  "companionTypes": ["infant"],
  "bookings": [
    {
      "type":"flight",
      "transitNumber":null,
      "departureLocation":null,
      "arrivalLocation":"인천공항",
      "departureTime":null,
      "arrivalTime":"2026-08-12T10:30:00"
    },
    {
      "type":"flight",
      "transitNumber":"OZ102",
      "departureLocation":"인천공항",
      "arrivalLocation":null,
      "departureTime":"2026-08-14T18:00:00",
      "arrivalTime":null
    }
  ],
  "excludePlaceIds": [],
  "keepPlaceIds": [],
  "targetDate": null
}
```

### 요청 필드

| 필드 | 자료형 | 필수 | 설명 |
| --- | --- | --- | --- |
| `destination` | string | O | 여행 목적 지역 |
| `companionTypes` | string[] | O | 동행 조건 |
| `bookings` | object[] | O | `/api/bookings/parse` 응답의 `bookings`를 그대로 전달. 여행 날짜(며칠인지)와 도착일·출발일 판단에 쓰인다. 비어 있으면(도착 시각을 알 수 없으면) `placesByDay`/`restaurantsByDay` 모두 빈 객체(`{}`)로 반환한다 |
| `excludePlaceIds` | string[] | X | 이미 다른 날짜에 추천됐거나, 같은 날짜에서 노출됐지만 선택하지 않아 다시 추천하지 않을 관광지·음식점 ID |
| `keepPlaceIds` | string[] | X | `targetDate`로 지정한 날짜에서, 사용자가 이미 선택해 그대로 유지할 관광지 ID(그날 응답의 맨 앞쪽에 포함됨). `places.json`에 없는 ID가 포함되면 공통 오류 응답(`INVALID_INPUT`). 음식점은 끼니당 1곳만 고르므로 keep 대상이 아니다 |
| `targetDate` | string | X | `YYYY-MM-DD`. 있으면 이 날짜 하나만 다시 계산한다("다른 후보 추천받기" 새로고침용). 없으면 `bookings` 기준 여행 전체 날짜를 한 번에 계산한다. 여행 기간 밖의 날짜면 공통 오류 응답(`INVALID_INPUT`) |

날짜를 넘어가며 이미 추천된 관광지·음식점은 계속 제외 목록에 누적돼, 같은 곳이 다른 날짜에 중복 추천되지 않는다. "다른 관광지 추천받기"를 호출할 때는 `targetDate`에 그 날짜를, 사용자가 선택한 관광지를 `keepPlaceIds`로, 선택하지 않은 관광지 + 다른 날짜에서 이미 나온 후보 전체를 `excludePlaceIds`로 함께 전달한다.

카페(`category:"카페"`)는 별도 카테고리가 아니라 "관광지"로 취급한다. 하루 안에 이미 카페가 없고(그날 `keepPlaceIds`에도 없고) 새로 채울 자리가 남아 있으면, 그날의 관광지 후보 안에 카페가 최소 1개는 포함되도록 보장한다(카페 후보 자체가 없거나 채울 자리가 없으면 보장하지 않는다).

### 동행 조건 선택값 (`companionTypes`)

아래 값은 `/api/timelines/generate`의 동행 조건 선택값과 동일하며, `companionTypes`를 사용하는 모든 API에서 공통으로 사용한다. 이전에는 `friends`/`couple`이 분리되어 있었으나, 최종 서비스 기획에 맞춰 `friends_couple` 하나로 통합했다.

```
solo
friends_couple
infant
senior
mobility_impaired
pet
```

**공통 검증 규칙** (`companionTypes`를 사용하는 모든 API에 동일하게 적용):

- 최소 1개 이상 선택해야 한다. 비어 있으면 공통 오류 응답(`INVALID_INPUT`).
- `solo`는 "동행인 없음"을 의미하므로 다른 조건과 함께 선택할 수 없다. `solo`와 다른 값이 함께 오면 공통 오류 응답(`INVALID_INPUT`).
  - 허용: `["solo"]`, `["infant"]`, `["infant","senior"]`, `["friends_couple","mobility_impaired","pet"]`
  - 거부: `["solo","infant"]`, `["pet","solo"]`, `["solo","friends_couple","senior"]`
- `solo`가 아닌 조건끼리는 여러 개를 자유롭게 함께 선택할 수 있다.

### 성공 응답

```
{
  "success":true,
  "data": {
    "placesByDay": {
      "2026-08-12": [
        {
          "placeId":"place-001",
          "name":"국립해양박물관",
          "description":"부산의 해양 문화를 체험할 수 있는 실내 관광지입니다.",
          "recommendationReason":"실내 이동이 가능하고 유아 편의시설이 있어 유아 동반 여행에 적합합니다.",
          "estimatedDurationMinutes":90,
          "tags": ["실내","유아 동반","휴식 공간"],
          "imageUrl":"/images/places/place-001.jpg",
          "category":"박물관",
          "openTime":"09:00",
          "closeTime":"18:00",
          "lat":35.0785634152872,
          "lng":129.080244864532
        }
      ],
      "2026-08-13": ["... 2026-08-12와 동일한 구조, 관광지 카드 배열 ..."],
      "2026-08-14": ["... 2026-08-12와 동일한 구조, 관광지 카드 배열 ..."]
    },
    "autoSelectedPlaceIdsByDay": {
      "2026-08-12": ["place-001"],
      "2026-08-13": ["..."],
      "2026-08-14": ["..."]
    },
    "restaurantsByDay": {
      "2026-08-12": {
        "dinner": [
          {
            "placeId":"place-018",
            "name":"해운대 암소갈비집",
            "description":"숯불 갈비를 파는 저녁 식사에 어울리는 식당입니다.",
            "recommendationReason":"혼자서도 편하게 저녁 한 끼를 즐길 수 있는 식당입니다.",
            "estimatedDurationMinutes":60,
            "tags": ["실내","저상 시설","음식","대중교통 접근"],
            "imageUrl":null,
            "category":"음식점",
            "openTime":"11:00",
            "closeTime":"22:00"
          }
        ]
      },
      "2026-08-13": {
        "breakfast": ["... 관광지 카드와 동일한 구조 ..."],
        "lunch": ["..."],
        "dinner": ["..."]
      },
      "2026-08-14": {
        "breakfast": ["..."]
      }
    }
  }
}
```

`category`, `openTime`, `closeTime`은 카드 UI 표시를 위해 추가된 선택 필드다. 값은 실시간 운영 정보가 아니라 예선 데모용 샘플 데이터다(본선에서 실제 관광 공공데이터로 대체 예정, `docs/idea.md` 5절 참고).

`lat`/`lng`는 지도(동선 직선 표시)에 마커를 찍기 위한 좌표다. `backend/scripts/geocode_places.py`가 `places.json`의 `address`를 카카오 로컬 API로 미리 변환해 채워 넣으며, 매 요청마다 실시간으로 조회하지 않는다. 지오코딩에 실패한 레코드는 `null`일 수 있고, 그런 장소는 지도에 표시되지 않는다.

### 응답 필드 - `placesByDay` / `autoSelectedPlaceIdsByDay`

| 필드 | 자료형 | 필수 | 설명 |
| --- | --- | --- | --- |
| `placesByDay` | object | O | 키는 날짜(`YYYY-MM-DD`). 값은 그날의 관광지 카드 배열이며, 하루 기본 추천 개수는 6개다(후보가 부족하면 6개 미만 가능). `targetDate` 요청이면 그 날짜 하나만, 아니면 여행 전체 날짜가 채워진다. `bookings`가 없어 날짜를 계산할 수 없으면 `{}` |
| `autoSelectedPlaceIdsByDay` | object | O | 키는 날짜. 값은 "추천 관광지 자동 선택"에 쓸 placeId 목록 — 그날 `placesByDay`의 부분집합이며 내부 추천 점수 상위 최대 3개 |

프론트엔드는 추천 점수를 직접 계산하거나 카드 순서만으로 자동 선택 대상을 판단하지 않고, 이 필드 값을 그대로 사용한다. 관광지는 하루 3개를 선택해야 하며(요청사항 기준), 이 선택 개수 제한은 화면에서 검증한다 — 음식점 선택 개수와는 서로 슬롯을 나누지 않는다.

### 응답 필드 - `restaurantsByDay`

카페를 제외한 음식점 추천을 날짜별·식사 시간대별로 묶어 반환하는 필드다. `placesByDay`와 별도 목록이며, `placesByDay`에는 음식점(`category:"음식점"`)이 포함되지 않는다.

| 필드 | 자료형 | 필수 | 설명 |
| --- | --- | --- | --- |
| `restaurantsByDay` | object | O | 키는 날짜(`YYYY-MM-DD`). 값의 키는 `"breakfast"`/`"lunch"`/`"dinner"` 중 그날 해당하는 것만, 값은 관광지 카드와 동일한 구조의 배열(기본 최대 3개). `bookings`가 없으면 `{}` |

각 날짜에 어떤 끼니가 포함되는지는 `backend/app/utils/meal_recommendation.py`의 `recommend_daily_meals()` 기준으로 다음과 같이 결정된다:

- **도착일**: 도착 시각 "이후"에 아직 먹을 수 있는 끼니만. 09시 이전 도착 → 아침+점심+저녁, 09~13시 도착 → 점심+저녁, 13시 이후 도착 → 저녁만
- **출발일(도착일과 다른, 여행 마지막 날)**: 출발 시각 "이전"에 이미 먹을 시간이 있었던 끼니만(도착일 규칙의 대칭). 09시 이전 출발 → 없음, 09~13시 출발 → 아침만, 13~19시 출발 → 아침+점심, 19시 이후 출발 → 아침+점심+저녁
- **도착일이자 동시에 출발일(당일치기)**: 위 두 규칙의 교집합
- **그 외 중간 날짜**: 항상 아침+점심+저녁 모두

프론트엔드는 끼니마다 음식점을 최대 1곳만 선택할 수 있게 하고(라디오 형태), "선택 안 함"을 허용한다. 각 버킷의 후보 개수는 해당 지역·조건·날짜에 맞는 음식점이 없으면 빈 배열일 수 있다.

### 담당

- **추천 기준 및 데이터:** 준영
- **백엔드 연결:** 여진
- **화면:** 서영

### 자동 선택 요청 예시

```
{
  "bookings": [],
  "companionTypes": ["infant"],
  "selectionMode":"auto",
  "selectedPlaces": []
}
```

### 응답에 추가하면 좋은 값

```
{
  "selectionMode":"manual",
  "includedPlaces": ["국립해양박물관","부산시민공원"],
  "excludedPlaces": [
    {
      "name":"광안리해수욕장",
      "reason":"교통편 출발시간 전까지 방문하기 어렵습니다."
    }
  ]
}
```

---

# 3. 맞춤 타임라인 생성

## POST `/api/timelines/generate`

구조화된 예매정보와 날짜별로 선택한 관광지(하루 1~3개)·음식점(끼니당 최대 1곳)을 바탕으로,
운영시간·예상 이동시간·휴식시간을 고려한 여행 타임라인을 생성한다. 시간·제약조건 계산은 전부
백엔드 코드에서 결정적으로 처리하며 Gemini(AI)는 호출하지 않는다.

### 요청

```
{
  "bookings": [
    {
      "type":"flight",
      "transitNumber":null,
      "departureLocation":null,
      "arrivalLocation":"인천공항",
      "departureTime":null,
      "arrivalTime":"2026-08-12T10:30:00"
    },
    {
      "type":"train",
      "transitNumber":"KTX 101",
      "departureLocation":"서울역",
      "arrivalLocation":"부산역",
      "departureTime":"2026-08-12T13:20:00",
      "arrivalTime":"2026-08-12T16:05:00"
    },
    {
      "type":"flight",
      "transitNumber":"OZ102",
      "departureLocation":"인천공항",
      "arrivalLocation":null,
      "departureTime":"2026-08-14T18:00:00",
      "arrivalTime":null
    }
  ],
  "companionTypes": ["infant","mobility_impaired"],
  "days": [
    {
      "date":"2026-08-12",
      "placeIds": ["place-001","place-009","place-013"],
      "restaurantIds": { "dinner":"place-018" }
    },
    {
      "date":"2026-08-13",
      "placeIds": ["place-006","place-008","place-015"],
      "restaurantIds": { "breakfast":"place-021", "lunch":"place-016", "dinner":"place-020" }
    },
    {
      "date":"2026-08-14",
      "placeIds": ["place-004","custom-171234"],
      "restaurantIds": { "breakfast":"place-022" }
    }
  ],
  "destination":"부산",
  "pace":"normal",
  "seed":42,
  "customPlaces": {
    "custom-171234": { "name":"우리 가족 단골 산책로", "address":null, "lat":null, "lng":null }
  },
  "accommodation": { "name":"해운대 게스트하우스", "address":"부산 해운대구 해운대해변로 264", "lat":35.1591, "lng":129.1602 },
  "layoverPlace": { "name":"앙꼬", "address":"서울 용산구 청파로47다길 6", "lat":37.5454, "lng":126.9657 }
}
```

### 요청 필드

| 필드 | 자료형 | 필수 | 설명 |
| --- | --- | --- | --- |
| `bookings` | object[] | O | `/api/bookings/parse` 응답의 `bookings`를 그대로 전달 |
| `companionTypes` | string[] | O | 동행 조건. `/api/places/recommend`의 `companionTypes`와 같은 enum, 같은 필드명, 같은 공통 검증 규칙(위 2절 참고: 최소 1개, `solo`는 다른 값과 함께 선택 불가)을 그대로 사용한다. 서로 다른 값을 여러 개 선택할 수 있으며, **동일한 값의 중복만 금지**(예: `["infant","infant"]`는 오류) — 배열 순서는 결과에 영향을 주지 않는다 |
| `days` | object[] | O | 날짜별 선택 결과. `/api/places/recommend`가 날짜별로 준 후보 중에서 고른 것을 그대로 다시 보낸다 |
| `days[].date` | string | O | `YYYY-MM-DD` |
| `days[].placeIds` | string[] | O | 그날 방문할 관광지(카페 포함) ID, 1개 이상 3개 이하. `places.json`에 존재하는 ID만 허용 |
| `days[].restaurantIds` | object | X | 그날 끼니별로 선택한 음식점 ID. 키는 `"breakfast"`/`"lunch"`/`"dinner"` 중 그날 추천된 것만, "선택 안 함"을 고른 끼니는 키 자체를 넣지 않는다(끼니당 최대 1곳) |
| `destination` | string | O | 여행 목적 지역 (표시·검증용) |
| `pace` | string | O | 일정 여유 정도: `normal` 또는 `relaxed`. `relaxed`는 이동·휴식 여유를 더 크게 반영 |
| `seed` | integer | X | 같은 seed로 요청하면 동일한 결과를 재현한다. "다른 일정 추천받기" 시 새 seed(또는 생략)로 재요청 |
| `customPlaces` | object | X | 추천 후보 대신 사용자가 직접 입력한 장소. 키는 프론트가 만든 임시 ID이며 `days[].placeIds`/`restaurantIds`에서 이 ID로 참조한다. `places.json`에서 찾을 수 없는 ID를 만나면 여기서 찾는다. 여기에도 없는 ID면 공통 오류(`INVALID_INPUT`) |
| `customPlaces{}.name` | string | O | 장소 이름 |
| `customPlaces{}.address` | string | X | 카카오 장소검색으로 골랐을 때의 주소. 없으면 `name`을 주소처럼 표시에 대신 쓴다 |
| `customPlaces{}.lat`/`lng` | number | X | 카카오 장소검색으로 좌표까지 받았으면 채운다. 있으면 다른 장소와의 이동시간이 직선거리 기반으로 계산되고 지도에도 표시되며, 없으면 거점 기준 기본 이동시간으로 대체되고 지도에는 표시되지 않는다 |
| `accommodation` | object | X | 숙소 정보. `customPlaces{}`와 같은 구조(`name`/`address`/`lat`/`lng`). 입력하면 매일 마지막 일정 뒤에 숙소로 이동하는 항목(`type: "accommodation"`)이 추가되고, 다음날은 숙소에서 출발하는 것으로 이동시간을 계산한다. 입력하지 않으면 기존과 동일하게(거점 기준으로 매일 새로 출발) 동작한다 |
| `layoverPlace` | object | X | `customPlaces{}`와 같은 구조(`name`/`address`/`lat`/`lng`). 항공↔철도 환승 뒤 대기시간이 충분히 남는 구간이 있으면 이 장소를 최우선으로 채운다(서울역·인천공항처럼 서버가 미리 가진 데이터가 없는 거점이어도 동작). 입력하지 않으면 서버가 가진 데이터로 자동으로 채우거나, 데이터가 없으면 빈 시간으로 남긴다 |

직접 입력한 장소는 운영시간 제약 없이 하루 중 아무 때나 배치 가능한 것으로 보고, 체류시간은 항상 60분 고정이다.

"다른 일정 추천받기"(재생성)를 호출하면 `days`의 `placeIds`/`restaurantIds`는 그대로 유지한 채 새 `seed`로 다시 요청한다 — 그날 관광지의 방문 순서만 다시 계산되고, 끼니는 이미 아침/점심/저녁 시간대에 고정 배치되므로(끼니당 1곳뿐이라 순서 개념이 없음) 순서가 바뀌지 않는다.

### 동행 조건별 반영 방식 (복수 선택 시 모두 반영)

`companionTypes`에 여러 값이 있으면 하나만 우선하지 않고 전부 반영한다.

| 값 | 반영 내용 | 여러 조건 선택 시 결합 방식 |
| --- | --- | --- |
| `solo` | 기본 이동·휴식 여유 | 다른 조건과 함께 선택할 수 없음(동행인 없음을 의미) — 함께 오면 `INVALID_INPUT` |
| `friends_couple` | 야경·사진 명소 태그가 있는 장소는 체류 시간을 추가로 늘림 | 체류시간 가산에 포함(상한 있음) |
| `infant` | 이동 여유와 휴식시간을 크게 늘림 | 이동 배수·휴식·정착 버퍼 후보값에 포함 |
| `senior` | 이동·휴식시간을 확대 | 이동 배수·휴식·정착 버퍼 후보값에 포함 |
| `mobility_impaired` | 이동·환승 여유를 가장 넉넉하게 반영 | 이동 배수·휴식·정착 버퍼 후보값에 포함(대체로 가장 큼) |
| `pet` | 반려동물 동반이 불가능한 선택 관광지는 제외(`warnings`에 사유 표시), 휴식은 야외 휴식으로 안내 | 선택된 조건 중 하나라도 `pet`이면 적용 |

- **이동시간 배수 / 휴식시간 / 정착·환승 버퍼**: 선택된 `companionTypes` 각각의 기준값 중 **가장 넉넉한(큰) 값**을 채택한다.
- **체류시간 가산**(예: `friends_couple`의 야경·사진 명소 여유): 해당되는 조건을 반영하되 한 장소당 합리적인 상한을 둔다.
- **`pet`**: 선택된 조건에 `pet`이 포함되어 있으면, 반려동물 동반이 불가능한 선택 관광지는 배치하지 않고 사유를 `warnings`에 남긴다.

### 처리 내용

1. `bookings`에서 가장 늦은 도착 시각 이후부터 관광 가능 시간이 시작된다(그 이전에는 일정을 넣지 않음).
2. 도착 이후에 남은 출발 예매가 있으면, 그 출발 시각 전까지 이동 여유를 남기고 관광 가능 시간을 끝낸다.
3. `days`의 각 날짜마다 그날 09:00~22:00(도착일·출발일은 도착/출발 시각으로 더 좁혀짐) 안에서만 그날의 `placeIds`·`restaurantIds`를 배치한다 — 다른 날짜로 넘어가 배치하지 않는다.
4. **끼니(아침/점심/저녁)를 관광지보다 먼저, 우선적으로 배치한다.** 각각 아침 08~10시, 점심 11~13시, 저녁 18~20시 시간대에 고정 배치하며, 이 시간대를 넘겨서까지 밀어 배치하지 않는다(관광지 일정이 밀려도 끼니는 영향받지 않음). 그다음 그날의 관광지를, 끼니 시간대 사이사이 남는 시간에 그 여유 길이에 비례해 나눠 배치한다. 그래도 시간이 부족하면 `warnings`에 남기고 그 관광지·끼니는 제외한다(끼니를 우선 배치하므로 관광지 쪽에서만 주로 발생한다).
5. 각 관광지·음식점은 `places.json`의 `openTime`~`closeTime` 안에서만 방문하고, `estimatedDurationMinutes`만큼 체류한다.
6. 관광지·음식점 사이·역/공항에서 첫 일정까지는 데모 규칙으로 예상 이동시간을 계산해 별도 `transport` 항목으로 넣는다(실시간 지도 API 미사용). 두 장소 모두 좌표(`lat`/`lng`)가 있으면 직선거리 기반으로 계산하고, 없으면 같은 구(區)인지 여부로 대략 구분한다.
7. 서로 다른 교통수단(항공↔철도)으로 짧은 간격 안에 이어지는 예매편 사이에는 공항·역 환승 이동을 별도 `transport` 항목으로 추가한다(같은 교통수단이 이어지거나 간격이 크면 추가하지 않음).
8. 동행 조건·`pace`에 따라 이동 여유·휴식시간을 가감한다.
9. 시간이 부족하거나 운영시간과 맞지 않아 배치하지 못한 관광지·음식점은 조용히 빼지 않고 `warnings`에 사유를 남긴다.
10. 모든 항목은 겹치지 않게, 시간순으로 정렬해 반환한다.

### 성공 응답

```
{
  "success":true,
  "data": {
    "timeline": [
      {
        "id":"item-001",
        "type":"arrival",
        "startTime":"2026-08-12T10:30:00",
        "endTime":"2026-08-12T11:00:00",
        "title":"인천공항 도착",
        "placeId":null,
        "location":"인천공항",
        "description":"예매정보 기준 도착 시각이며, 정리·이동 준비 여유 시간을 함께 표시합니다.",
        "estimated":false
      },
      {
        "id":"item-002",
        "type":"transport",
        "startTime":"2026-08-12T13:20:00",
        "endTime":"2026-08-12T16:05:00",
        "title":"열차로 서울역 → 부산역 이동",
        "placeId":null,
        "location":"부산역",
        "description":"예매된 교통편 이동 구간입니다.",
        "estimated":false
      },
      {
        "id":"item-003",
        "type":"transport",
        "startTime":"2026-08-12T16:35:00",
        "endTime":"2026-08-12T17:14:00",
        "title":"씨라이프 부산아쿠아리움으로 이동",
        "placeId":null,
        "location":"씨라이프 부산아쿠아리움",
        "description":"데모 데이터를 기반으로 계산한 예상 이동시간입니다. 실제 소요시간과 다를 수 있습니다.",
        "estimated":true
      },
      {
        "id":"item-004",
        "type":"attraction",
        "startTime":"2026-08-12T17:14:00",
        "endTime":"2026-08-12T18:44:00",
        "title":"씨라이프 부산아쿠아리움",
        "placeId":"place-009",
        "location":"부산 해운대구 해운대해변로 266",
        "description":"해운대 인근에 위치한 실내 아쿠아리움입니다.",
        "estimated":true
      },
      {
        "id":"item-005",
        "type":"meal",
        "startTime":"2026-08-12T19:00:00",
        "endTime":"2026-08-12T20:00:00",
        "title":"해운대 암소갈비집",
        "placeId":"place-018",
        "location":"부산 해운대구 구남로 20",
        "description":"숯불 갈비를 파는 저녁 식사에 어울리는 식당입니다.",
        "estimated":true
      },
      {
        "id":"item-006",
        "type":"rest",
        "startTime":"2026-08-12T18:44:00",
        "endTime":"2026-08-12T19:00:00",
        "title":"휴식",
        "placeId":null,
        "location":"부산 해운대구 해운대해변로 266",
        "description":"다음 일정 전 휴식 시간입니다.",
        "estimated":true
      }
    ],
    "summary": {
      "placeCount":3,
      "sightseeingMinutes":260,
      "estimatedTravelMinutes":143,
      "companionTypes": ["infant"],
      "pace":"normal"
    },
    "warnings": [],
    "stationFacilities": [
      {
        "stationName":"서울역",
        "hasElevator":true,
        "elevatorCount":18,
        "escalatorCount":23,
        "hasGeneralRestroom":true,
        "hasInfoCenter":true,
        "hasNursingRoom":true,
        "hasAccessibleRestroom":null,
        "hasWheelchairRamp":null,
        "wheelchairLiftCount":null
      }
    ]
  }
}
```

### 타임라인 항목 타입 (`type`)

```
arrival
transport
attraction
meal
rest
departure
accommodation
```

`meal`은 날짜별로 선택한 음식점 방문 항목이다(`attraction`과 필드 구조는 동일하고 타입만 다르다).
`accommodation`은 `accommodation` 요청 필드를 입력했을 때만 나타나며, 매일 마지막 일정 뒤 숙소로 이동하는 항목이다.

`estimated`는 해당 항목의 시각이 예매정보 그대로의 정확한 값(`false`: `arrival`/`departure`/예매편 `transport`)인지,
백엔드가 데모 규칙으로 계산한 추정값(`true`: 관광지·음식점 사이 `transport`(환승 이동 포함), `attraction`, `meal`, `rest`)인지 구분한다.
화면에는 `estimated:true` 항목을 "예상 이동시간"처럼 추정값임을 알 수 있게 표시한다.

### `warnings`

시간·운영시간 제약으로 배치하지 못한 관광지, 동행 조건과 맞지 않아 제외한 관광지가 있으면
빈 배열이 아닌 사유 문자열 목록으로 반환한다(성공 응답이면서 `warnings`가 있을 수 있음).

### `stationFacilities`

`companionTypes`에 `infant` 또는 `mobility_impaired`가 포함되어 있을 때만 채워지며, 그 외에는
항상 빈 배열이다. 예매정보(`bookings`)에 있는 철도 구간의 출발역·도착역 이름으로 공공데이터포털
한국철도공사_편의시설정보 API를 조회한 결과이며, 외부 API 호출이 실패하거나 데이터가 없는 역은
조용히 목록에서 빠진다(응답 전체가 실패하지 않음).

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `stationName` | string | 역명 (예매정보에 있던 표기 그대로, 예: "서울역") |
| `hasElevator` | boolean | 엘리베이터 보유 여부 |
| `elevatorCount` | number | 엘리베이터 수 |
| `escalatorCount` | number | 에스컬레이터 수 |
| `hasGeneralRestroom` | boolean | 일반 화장실 유무 |
| `hasInfoCenter` | boolean | 종합안내센터 유무 |
| `hasNursingRoom` | boolean \| null | 수유실 유무. `companionTypes`에 `infant`가 없으면 항상 `null` |
| `hasAccessibleRestroom` | boolean \| null | 장애인 화장실 유무. `companionTypes`에 `mobility_impaired`가 없으면 항상 `null` |
| `hasWheelchairRamp` | boolean \| null | 장애인 경사로 유무. 위와 동일 조건 |
| `wheelchairLiftCount` | number \| null | 휠체어리프트 수. 위와 동일 조건 |

### 담당

- **백엔드 로직:** 여진
- **동행 조건별 반영 기준:** 준영
- **결과 화면:** 서영

---

## POST `/api/timelines/layover-candidates`

항공↔철도 예매 사이에 데이터를 가진 거점(서울역·인천공항 등)과 겹치는 환승 대기 구간이
있으면, 그 구간에 넣을 수 있는 추천 후보 목록을 미리 보여준다. 타임라인을 실제로 만들기
전(동행 조건을 아직 안 골랐을 수도 있는 예매정보 확인 화면)에 호출하므로 `companionTypes`는
생략할 수 있다.

### 요청

```
{
  "bookings": [ ... ],
  "companionTypes": ["pet"]
}
```

### 성공 응답

```
{
  "success":true,
  "data": {
    "hubRegion":"서울",
    "windowMinutes":230,
    "candidates": [
      { "placeId":"place-108", "name":"앙꼬", "description":"...", "recommendationReason":"...",
        "estimatedDurationMinutes":50, "tags":[], "category":"음식점",
        "openTime":"11:00", "closeTime":"21:00", "lat":37.5454, "lng":126.9657,
        "address":"서울 용산구 청파로47다길 6" }
    ]
  }
}
```

매칭되는 환승 구간이 없으면 `hubRegion`은 `null`, `candidates`는 빈 배열이다 — 이때 화면은
직접 검색 입력만 보여주면 된다. `candidates[].address`는 `/api/places/recommend`의 `Place`와
달리 이 응답에서만 채워지며, 선택한 후보를 그대로 `/api/timelines/generate`의
`layoverPlace`(`name`/`address`/`lat`/`lng`)로 보낼 수 있게 하기 위한 것이다.

### 담당

- **백엔드 로직:** 여진
- **결과 화면:** 서영
- **예선 구현:** 선택

---

# 4. 여행 다이어리 생성

## POST `/api/diaries/generate`

선택 관광지 기반으로 생성된 여행 타임라인과, 사용자가 입력한 사진·메모를 바탕으로
AI(Gemini) 여행 다이어리를 생성한다. 시간·제약조건 계산이 아니라 자연어 생성이 핵심이므로
Gemini를 사용하지만, 사진/개수/용량 검증과 결과 정규화는 전부 백엔드 코드에서 처리한다.

사진 파일을 포함할 수 있으므로 `multipart/form-data`로 요청한다. JSON으로 표현하기 애매한
배열·객체 필드는 JSON 문자열로 감싸 전달하고, 백엔드가 파싱한 뒤 반드시 Pydantic으로 재검증한다.

### 요청 필드 (`multipart/form-data`)

| 필드 | 자료형 | 필수 | 설명 |
| --- | --- | --- | --- |
| `destination` | string | O | 여행 목적 지역 |
| `tone` | string | O | 다이어리 문체. 아래 "문체 선택값" 참고 |
| `memo` | string | X | 전체 여행 메모 |
| `companionTypesJson` | JSON string | O | 동행 조건 배열(`companionTypes`)을 JSON 문자열로 인코딩. `/api/places/recommend`·`/api/timelines/generate`와 동일한 enum·공통 검증 규칙(최소 1개, solo 배타 정책) 적용 |
| `timelineJson` | JSON string | O | `/api/timelines/generate` 응답의 `data`(`timeline`/`summary`/`warnings`)를 그대로 JSON 문자열로 인코딩 |
| `selectedPlaceIdsJson` | JSON string | O | 선택한 관광지 ID 배열. `places.json`에 존재하는 ID만 허용 |
| `photoMemosJson` | JSON string | X | 사진별 메모 배열(문자열[]). 사진 순서와 배열 순서가 일치해야 한다 |
| `photoTimelineItemIdsJson` | JSON string | X | 사진이 타임라인의 어떤 항목(`TimelineItem.id`)에서 첨부됐는지 배열((string\|null)[]). 사진 순서와 일치해야 하며, 없으면 전부 `null`로 취급 |
| `photos` | File[] | X | 여행 사진. 최대 5장, 1장당 최대 5MB, `image/jpeg`·`image/png`·`image/webp`만 허용 |

`memo`와 `photos`가 모두 없으면 공통 오류 응답(`INVALID_INPUT`)을 반환한다.

### 문체 선택값 (`tone`)

```
emotional   감성적인 - 감정과 여운을 담아 서정적으로
plain       담백한 - 꾸밈없이 사실 위주로 간결하게
cheerful    유쾌한 - 밝고 경쾌한 어조로
concise     간결한 - 짧고 명료한 문장으로 핵심만
```

### 처리 내용

1. `multipart/form-data` 요청을 검증하고, JSON 문자열 필드를 파싱해 Pydantic 모델로 재검증한다.
2. 타임라인 항목과 전체 메모를 텍스트로 정규화한다.
3. 사진의 MIME 타입·개수(최대 5장)·용량(장당 최대 5MB)을 검증한다(실패 시 어떤 사진도 저장하지 않고 `INVALID_INPUT` 반환).
4. 타임라인·메모·사진을 Gemini에 전달해 구조화된 JSON을 생성한다.
5. Gemini 응답을 Pydantic으로 검증하고, JSON 오류나 스키마 오류는 최대 1회 교정 재시도한다.
6. `photoCaptions` 개수를 실제 업로드된 사진 개수에 맞추고, `hashtags`를 `#` 접두사로 정규화한다.
7. AI 호출 자체가 실패하면(네트워크/타임아웃/429/5xx, 또는 재시도 후에도 검증 실패) 제한적인 템플릿 fallback으로 응답한다.
8. `storyCards`의 `photoIndexes`가 업로드된 사진 범위를 벗어나면 걸러내고, `id`를 `card-1`, `card-2`... 순서로 재부여한다.

### 성공 응답

```
{
  "success": true,
  "data": {
    "title": "부산에서 보낸 여유로운 하루",
    "diary": "인천공항에 도착한 뒤 서울역을 거쳐 부산으로 이동했다. 긴 이동 후 숙소에서 잠시 쉬고 부산의 저녁을 천천히 즐겼다.",
    "summary": "기차를 타고 부산으로 이동해 지역 음식과 야경을 즐긴 여행입니다.",
    "snsPost": "기차를 타고 떠난 부산 여행. 여유롭게 쉬고 아름다운 야경까지 즐긴 하루!",
    "photoCaptions": [
      { "photoIndex": 0, "caption": "부산에서 시작된 첫 번째 저녁" }
    ],
    "hashtags": ["#부산여행", "#KTX여행", "#가족여행"],
    "storyCards": [
      {
        "id": "card-1",
        "type": "cover",
        "photoIndexes": [0],
        "headline": "부산에서의 하루",
        "body": "기차를 타고 도착한 부산에서 여유로운 저녁을 보냈다.",
        "caption": "",
        "locationLabel": "부산",
        "dateLabel": "2026-08-13",
        "accentWords": ["여유", "야경"],
        "layoutVariant": "full-bleed"
      },
      {
        "id": "card-2",
        "type": "quote",
        "photoIndexes": [],
        "headline": "기억에 남는 순간",
        "body": "긴 이동 후 맞이한 부산의 저녁이 가장 좋았다.",
        "caption": "",
        "locationLabel": null,
        "dateLabel": null,
        "accentWords": [],
        "layoutVariant": "text-only"
      },
      {
        "id": "card-3",
        "type": "ending",
        "photoIndexes": [],
        "headline": "여행을 마치며",
        "body": "짧지만 알찬 부산 여행이었다.",
        "caption": "",
        "locationLabel": null,
        "dateLabel": null,
        "accentWords": [],
        "layoutVariant": "text-only"
      }
    ],
    "generationMode": "ai",
    "warnings": []
  }
}
```

### 응답 필드

| 필드 | 자료형 | 설명 |
| --- | --- | --- |
| `title` | string | 다이어리 제목 |
| `diary` | string | 본문 형태의 여행 일기 |
| `summary` | string | 여행 한줄 또는 짧은 요약 |
| `snsPost` | string | SNS 게시글용 문구 |
| `photoCaptions` | object[] | `{photoIndex, caption}`. 업로드된 사진 개수와 항상 동일한 길이(사진이 없으면 빈 배열) |
| `hashtags` | string[] | `#`으로 시작하도록 정규화된 해시태그 (최대 10개) |
| `storyCards` | object[] | 사진 중심 SNS 캐러셀·블로그형 포토 스토리를 렌더링하기 위한 카드 배열(3~6개). 아래 "storyCards 필드" 참고 |
| `generationMode` | string | `ai` 또는 `fallback`. AI 호출 실패로 템플릿 결과를 반환했으면 `fallback` |
| `warnings` | string[] | fallback 사용 등 참고 사항. 없으면 빈 배열 |

### `storyCards` 필드

프론트엔드는 `title`/`diary`/`summary`/`snsPost`/`photoCaptions`/`hashtags`를 보조 텍스트 콘텐츠로 유지하면서,
`storyCards` 배열을 SNS 캐러셀(4:5 카드)과 블로그형 포토 스토리의 메인 콘텐츠로 사용한다. 테마(`film`/`scrapbook`/`magazine`)
전환은 프론트엔드에서 동일한 `storyCards` 데이터를 다른 CSS로 렌더링하는 방식으로 처리하며, AI를 다시 호출하지 않는다.

| 필드 | 자료형 | 설명 |
| --- | --- | --- |
| `id` | string | 카드 고유 ID. 백엔드가 `card-1`, `card-2`... 순서로 재부여 |
| `type` | string | `cover` \| `single_photo` \| `collage` \| `quote` \| `ending` |
| `photoIndexes` | int[] | 이 카드가 사용하는 사진 인덱스(0부터 시작). 업로드된 사진 범위를 벗어나는 값은 제거됨. 사진이 없으면 항상 빈 배열 |
| `headline` | string | 짧은 제목 |
| `body` | string | 1~3문장의 짧은 본문(긴 `diary` 본문을 그대로 복사하지 않음) |
| `caption` | string | 사진 위/아래에 표시할 짧은 문구. 없으면 빈 문자열 |
| `locationLabel` | string \| null | 장소 표시. 근거가 없으면 `null` |
| `dateLabel` | string \| null | 날짜 표시. 근거가 없으면 `null` |
| `accentWords` | string[] | 스티커처럼 표시할 짧은 단어(0~4개) |
| `layoutVariant` | string | `full-bleed` \| `framed` \| `split-2` \| `asymmetric` \| `text-only` |

생성 규칙: 사진이 있으면 사진 개수·순서를 고려해 3~6개 카드를 생성하고(사진이 1장이면 같은 사진을 무리하게 반복하지 않음),
사진이 없으면 `cover`·`quote`·`ending` 타입의 텍스트 기반 카드만 생성한다. `photoIndexes` 범위 초과나 카드 개수(3~6개) 위반은
기존 다이어리 검증과 동일하게 최대 1회 교정 재시도하며, 재시도 후에도 실패하면 제한적 템플릿 fallback이 최소한
`cover`·`quote`·`ending` 3개 카드를 반환한다.

### 담당

- **AI·백엔드 로직:** 여진
- **사진·메모 입력 및 결과 화면:** 서영

---

# 5. 타임라인 재생성 — 선택 구현

## POST `/api/timelines/regenerate`

기존 타임라인과 사용자의 수정 요청을 바탕으로 새로운 타임라인을 생성한다.

### 요청

```
{
  "currentTimeline": {
    "timelineId":"timeline-001",
    "title":"유아와 함께하는 부산 여행",
    "days": []
  },
  "request":"야외 일정을 줄이고 실내 장소 중심으로 바꿔줘"
}
```

### 성공 응답

```
{
  "success":true,
  "data": {
    "timelineId":"timeline-002",
    "changedReason":"사용자의 요청에 따라 야외 일정을 실내 장소 중심으로 변경했습니다.",
    "days": []
  }
}
```

### 담당

- **AI·백엔드:** 여진
- **화면:** 서영
- **예선 구현:** 선택

---

# 6. 다이어리 재생성 — 선택 구현

## POST `/api/diaries/regenerate`

기존 다이어리와 사용자의 수정 요청을 반영해 다이어리를 다시 생성한다.

### 요청

```
{
  "currentDiary": {
    "diaryId":"diary-001",
    "title":"부산에서 보낸 여유로운 하루",
    "content":"기존 다이어리 내용"
  },
  "request":"SNS에 올릴 수 있도록 짧고 밝은 문체로 바꿔줘"
}
```

### 성공 응답

```
{
  "success":true,
  "data": {
    "diaryId":"diary-002",
    "title":"부산에서 보낸 하루",
    "content":"기차를 타고 부산으로 떠난 하루! 맛있는 음식과 멋진 야경까지 완벽했다.",
    "snsText":"부산에서 먹고 보고 쉬었던 알찬 하루!",
    "hashtags": ["#부산여행","#기차여행","#여행기록"
    ]
  }
}
```

### 담당

- **AI·백엔드:** 여진
- **화면:** 서영
- **예선 구현:** 선택

---

# 7. 예선 API 요약

| API | 기능 | 우선순위 |
| --- | --- | --- |
| `POST /api/bookings/parse` | 예매정보 텍스트 구조화 | 필수 |
| `POST /api/places/recommend` | 관광지 후보 추천 및 새 후보 추천 | 필수 |
| `POST /api/timelines/generate` | 선택 관광지 기반 타임라인 생성 | 필수 |
| `POST /api/diaries/generate` | 여행 다이어리 생성 | 필수 |
| `POST /api/timelines/regenerate` | 타임라인 재생성 | 선택 |
| `POST /api/diaries/regenerate` | 다이어리 재생성 | 선택 |
| `POST /api/share/timeline`, `POST /api/share/diary` | 결과 공유 링크 생성 | 선택 |
| `GET /api/share/timeline/{id}`, `GET /api/share/diary/{id}` | 공유 링크로 결과 열람(로그인 불필요) | 선택 |

---

# 8. 공유 (카카오톡 공유용 읽기 전용 링크)

타임라인 결과 화면·다이어리 결과 화면에만 있는 "공유" 버튼을 누르면, 그 결과를 서버에
저장하고 로그인 없이 누구나 열람할 수 있는 링크를 발급한다. 프론트는 이 링크로
카카오톡 공유하기(Kakao.Share.sendDefault)를 호출한다.

DB 없이 `backend/app/data/shares/`에 공유 하나당 파일 하나로 저장하며(관광지 데이터와
같은 방식), 다이어리 사진은 `backend/app/static/shares/{shareId}/`에 저장돼
`/static/shares/...` 경로로 서빙된다. 이 프로젝트의 "업로드 사진을 서버에 저장하지
않는다"는 원칙과 부딪히는 유일한 예외이며, 그 대신 **7일이 지난 공유는 다음 접근 시점에
자동으로 삭제**된다(별도 배치 작업 없이, 조회/생성 시점에 만료된 파일을 정리).

## POST `/api/share/timeline`

### 요청

```
{
  "destination":"부산",
  "timeline": ["... /api/timelines/generate 응답의 timeline 배열 그대로 ..."],
  "summary": { "placeCount":3, "sightseeingMinutes":260, "estimatedTravelMinutes":143, "companionTypes":["infant"], "pace":"normal" }
}
```

### 성공 응답

```
{ "success":true, "data": { "shareId":"AbC123xy" } }
```

## GET `/api/share/timeline/{shareId}`

### 성공 응답

```
{
  "success":true,
  "data": {
    "destination":"부산",
    "timeline": ["... 저장된 timeline 배열 그대로 ..."],
    "summary": { "placeCount":3, "sightseeingMinutes":260, "estimatedTravelMinutes":143, "companionTypes":["infant"], "pace":"normal" },
    "createdAt":"2026-08-12T10:30:00+00:00"
  }
}
```

존재하지 않거나 만료된 `shareId`면 공통 오류 응답 형식으로 404(`NOT_FOUND`)를 반환한다.

## POST `/api/share/diary` (`multipart/form-data`)

| 필드 | 자료형 | 필수 | 설명 |
| --- | --- | --- | --- |
| `destination` | string | O | 여행 목적 지역 |
| `title` | string | O | `/api/diaries/generate` 응답의 `title` |
| `diary` | string | O | `/api/diaries/generate` 응답의 `diary` |
| `summary` | string | O | `/api/diaries/generate` 응답의 `summary` |
| `snsPost` | string | O | `/api/diaries/generate` 응답의 `snsPost` |
| `hashtagsJson` | JSON string | X | 해시태그 배열(문자열[]) |
| `photoCaptionsJson` | JSON string | X | 사진별 캡션 배열. 사진 순서와 일치해야 한다 |
| `photos` | File[] | X | 공유할 사진. 최대 5장, `/api/diaries/generate`와 동일한 형식·용량 제한 |

### 성공 응답

```
{ "success":true, "data": { "shareId":"XyZ789ab" } }
```

## GET `/api/share/diary/{shareId}`

### 성공 응답

```
{
  "success":true,
  "data": {
    "destination":"부산",
    "title":"부산에서 보낸 하루",
    "diary":"...",
    "summary":"...",
    "snsPost":"...",
    "hashtags": ["#부산여행"],
    "photos": [
      { "url":"/static/shares/XyZ789ab/0.jpg", "caption":"광안대교 야경" }
    ],
    "createdAt":"2026-08-12T10:30:00+00:00"
  }
}
```

`photos[].url`은 백엔드 기준 상대 경로다. 카카오톡 공유처럼 외부에서 접근해야 하는
곳에 쓸 때는 프론트가 API 베이스 URL을 붙여 절대 URL로 만들어 사용한다.

존재하지 않거나 만료된 `shareId`면 공통 오류 응답 형식으로 404(`NOT_FOUND`)를 반환한다.

### 담당

- **백엔드·라우팅:** 여진
- **공유 버튼·결과 화면:** 서영