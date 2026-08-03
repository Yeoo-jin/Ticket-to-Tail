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

사용자가 입력한 항공·철도 예매정보 텍스트에서 출발지, 도착지, 날짜, 시간 등의 정보를 추출한다.

### 요청

```
{
  "bookingText":"8월 12일 오전 10시 30분 인천공항 도착. 오후 1시 20분 서울역에서 KTX 출발, 오후 4시 5분 부산역 도착. 8월 14일 오후 6시 인천공항 출발."
}
```

### 요청 필드

| 필드 | 자료형 | 필수 | 설명 |
| --- | --- | --- | --- |
| `bookingText` | string | O | 항공·철도 예매정보가 포함된 자유 텍스트 |

### 처리 내용

1. 입력된 텍스트에서 항공편과 열차 정보를 구분한다.
2. 출발지·도착지·날짜·시간을 추출한다.
3. 타임라인 생성에 사용할 수 있는 데이터 형태로 변환한다.
4. 필수 정보가 부족한 경우 누락된 항목을 반환한다.

### 성공 응답

```
{
  "success":true,
  "data": {
    "bookings": [
      {
        "type":"flight",
        "departureLocation":null,
        "arrivalLocation":"인천공항",
        "departureTime":null,
        "arrivalTime":"2026-08-12T10:30:00"
      },
      {
        "type":"train",
        "departureLocation":"서울역",
        "arrivalLocation":"부산역",
        "departureTime":"2026-08-12T13:20:00",
        "arrivalTime":"2026-08-12T16:05:00"
      },
      {
        "type":"flight",
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

# 3. 관광지 후보 추천

### POST `/api/places/recommend`

여행 지역과 동행 조건을 바탕으로 적합한 관광지 후보를 추천한다. 이전에 노출된 관광지를 전달하면 해당 장소를 제외하고 새로운 후보를 반환한다.

### 요청

```
{
  "destination":"부산",
  "companionTypes": ["infant"],
  "excludePlaceIds": [],
  "keepPlaceIds": []
}
```

### 요청 필드

| 필드 | 자료형 | 필수 | 설명 |
| --- | --- | --- | --- |
| `destination` | string | O | 여행 목적 지역 |
| `companionTypes` | string[] | O | 동행 조건 |
| `excludePlaceIds` | string[] | X | 직전 추천에서 노출됐지만 사용자가 선택하지 않은 관광지 ID (다시 추천하지 않음) |
| `keepPlaceIds` | string[] | X | 사용자가 이미 선택해 그대로 유지할 관광지 ID (응답 앞쪽에 그대로 포함됨). `places.json`에 없는 ID가 포함되면 공통 오류 응답(`INVALID_INPUT`)을 반환한다 |

`keepPlaceIds` + 새로 추천되는 관광지를 합쳐 `places`는 항상 최대 6개이며(부족하면 6개 미만 가능), `keepPlaceIds`로 넘긴 관광지는 응답의 맨 앞쪽에, 나머지 새 후보가 그 뒤에 오는 순서로 반환된다. "다른 관광지 추천받기"를 호출할 때는 사용자가 선택한 관광지를 `keepPlaceIds`로, 선택하지 않은 관광지를 `excludePlaceIds`로 함께 전달한다.

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
    "places": [
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
        "closeTime":"18:00"
      }
    ],
    "autoSelectedPlaceIds": ["place-001"]
  }
}
```

`category`, `openTime`, `closeTime`은 카드 UI 표시를 위해 추가된 선택 필드다. 값은 실시간 운영 정보가 아니라 예선 데모용 샘플 데이터다(본선에서 실제 관광 공공데이터로 대체 예정, `docs/idea.md` 5절 참고).

### 응답 필드 - `autoSelectedPlaceIds`

`places` 응답에 포함된 관광지 중, "추천 관광지 자동 선택"에 사용할 대상을 서버가 미리 계산해 알려주는 **정식 응답 필드**다 (선택 필드가 아님).

| 필드 | 자료형 | 필수 | 설명 |
| --- | --- | --- | --- |
| `autoSelectedPlaceIds` | string[] | O | 자동 선택 대상 placeId 목록. `places`의 부분집합이며 내부 추천 점수 상위 최대 3개. 후보가 3개 미만이면 존재하는 만큼만 포함, 지원하지 않는 지역 등으로 `places`가 빈 배열이면 `[]` |

프론트엔드는 추천 점수를 직접 계산하거나 카드 순서만으로 자동 선택 대상을 판단하지 않고, 이 필드 값을 그대로 사용한다.

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

구조화된 예매정보와 선택한 관광지(1~3개)를 바탕으로, 운영시간·예상 이동시간·휴식시간을 고려한
여행 타임라인을 생성한다. 시간·제약조건 계산은 전부 백엔드 코드에서 결정적으로 처리하며
Gemini(AI)는 호출하지 않는다.

### 요청

```
{
  "bookings": [
    {
      "type":"flight",
      "departureLocation":null,
      "arrivalLocation":"인천공항",
      "departureTime":null,
      "arrivalTime":"2026-08-12T10:30:00"
    },
    {
      "type":"train",
      "departureLocation":"서울역",
      "arrivalLocation":"부산역",
      "departureTime":"2026-08-12T13:20:00",
      "arrivalTime":"2026-08-12T16:05:00"
    },
    {
      "type":"flight",
      "departureLocation":"인천공항",
      "arrivalLocation":null,
      "departureTime":"2026-08-14T18:00:00",
      "arrivalTime":null
    }
  ],
  "companionTypes": ["infant","mobility_impaired"],
  "selectedPlaceIds": ["place-001","place-009","place-013"],
  "destination":"부산",
  "pace":"normal",
  "seed":42
}
```

### 요청 필드

| 필드 | 자료형 | 필수 | 설명 |
| --- | --- | --- | --- |
| `bookings` | object[] | O | `/api/bookings/parse` 응답의 `bookings`를 그대로 전달 |
| `companionTypes` | string[] | O | 동행 조건. `/api/places/recommend`의 `companionTypes`와 같은 enum, 같은 필드명, 같은 공통 검증 규칙(위 2절 참고: 최소 1개, `solo`는 다른 값과 함께 선택 불가)을 그대로 사용한다. 서로 다른 값을 여러 개 선택할 수 있으며, **동일한 값의 중복만 금지**(예: `["infant","infant"]`는 오류) — 배열 순서는 결과에 영향을 주지 않는다 |
| `selectedPlaceIds` | string[] | O | 사용자가 선택한 관광지 ID, 1개 이상 3개 이하. `places.json`에 존재하는 ID만 허용하며, 존재하지 않으면 공통 오류(`INVALID_INPUT`) 응답 |
| `destination` | string | O | 여행 목적 지역 (표시·검증용) |
| `pace` | string | O | 일정 여유 정도: `normal` 또는 `relaxed`. `relaxed`는 이동·휴식 여유를 더 크게 반영 |
| `seed` | integer | X | 같은 seed로 요청하면 동일한 결과를 재현한다. "다른 일정 추천받기" 시 새 seed(또는 생략)로 재요청 |

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
3. 관광 가능 시간을 하루 09:00~21:00 단위로 나눠 `selectedPlaceIds`를 순서대로 배치한다.
4. 각 관광지는 `places.json`의 `openTime`~`closeTime` 안에서만 방문하고, `estimatedDurationMinutes`만큼 체류한다.
5. 관광지 사이·역/공항에서 첫 관광지까지는 데모 규칙으로 예상 이동시간을 계산해 별도 `transport` 항목으로 넣는다(실시간 지도 API 미사용).
6. 동행 조건·`pace`에 따라 이동 여유·휴식시간을 가감한다.
7. 시간이 부족하거나 운영시간과 맞지 않아 배치하지 못한 관광지는 조용히 빼지 않고 `warnings`에 사유를 남긴다.
8. 모든 항목은 겹치지 않게, 시간순으로 정렬해 반환한다.

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
        "type":"rest",
        "startTime":"2026-08-12T18:44:00",
        "endTime":"2026-08-12T19:19:00",
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
    "warnings": []
  }
}
```

### 타임라인 항목 타입 (`type`)

```
arrival
transport
attraction
rest
departure
```

`estimated`는 해당 항목의 시각이 예매정보 그대로의 정확한 값(`false`: `arrival`/`departure`/예매편 `transport`)인지,
백엔드가 데모 규칙으로 계산한 추정값(`true`: 관광지 사이 `transport`, `attraction`, `rest`)인지 구분한다.
화면에는 `estimated:true` 항목을 "예상 이동시간"처럼 추정값임을 알 수 있게 표시한다.

### `warnings`

시간·운영시간 제약으로 배치하지 못한 관광지, 동행 조건과 맞지 않아 제외한 관광지가 있으면
빈 배열이 아닌 사유 문자열 목록으로 반환한다(성공 응답이면서 `warnings`가 있을 수 있음).

### 담당

- **백엔드 로직:** 여진
- **동행 조건별 반영 기준:** 준영
- **결과 화면:** 서영

---

# 4. 여행 다이어리 생성

## POST `/api/diaries/generate`

생성된 여행 타임라인과 사용자가 입력한 사진·메모를 바탕으로 AI 여행 다이어리를 생성한다.

사진을 함께 전송하는 경우 `multipart/form-data`를 사용한다.

### 요청 필드

| 필드 | 자료형 | 필수 | 설명 |
| --- | --- | --- | --- |
| `timeline` | JSON string | O | 생성된 여행 타임라인 |
| `memo` | string | X | 여행 중 작성한 메모 |
| `writingStyle` | string | O | 다이어리 문체 |
| `length` | string | O | 다이어리 분량 |
| `images` | File[] | X | 여행 사진 |

### 요청 예시

```
timeline: 생성된 타임라인 JSON
memo: 부산에 도착해서 먹은 음식이 맛있었고 바다 야경이 예뻤다.
writingStyle: emotional
length: medium
images: [busan1.jpg, busan2.jpg]
```

### 문체 선택값

```
emotional
casual
informative
humorous
sns
```

### 분량 선택값

```
short
medium
long
```

### 처리 내용

1. 타임라인에서 날짜와 방문 장소를 추출한다.
2. 사진과 메모를 해당 일정에 연결한다.
3. 선택한 문체와 분량을 반영한다.
4. 날짜별 여행 일기와 SNS용 콘텐츠를 생성한다.

### 성공 응답

```
{
  "success":true,
  "data": {
    "diaryId":"diary-001",
    "title":"부산에서 보낸 여유로운 하루",
    "summary":"기차를 타고 부산으로 이동해 지역 음식과 야경을 즐긴 여행입니다.",
    "entries": [
      {
        "date":"2026-08-12",
        "title":"부산 여행의 시작",
        "content":"인천공항에 도착한 뒤 서울역을 거쳐 부산으로 이동했다. 긴 이동 후 숙소에서 잠시 쉬고 부산의 저녁을 천천히 즐겼다.",
        "imageCaption":"부산에서 시작된 첫 번째 저녁",
        "hashtags": ["#부산여행","#KTX여행","#가족여행"
        ]
      }
    ],
    "snsText":"기차를 타고 떠난 부산 여행. 여유롭게 쉬고 아름다운 야경까지 즐긴 하루!",
    "hashtags": ["#부산여행","#국내여행","#여행기록"
    ]
  }
}
```

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