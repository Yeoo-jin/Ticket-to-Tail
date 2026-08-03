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

구조화된 예매정보와 동행 조건을 바탕으로 이동시간과 휴식시간을 고려한 여행 타임라인을 생성한다.

### 요청

```
{
  "bookings": [
    {
      "type":"flight",
      "arrivalLocation":"인천공항",
      "arrivalTime":"2026-08-12T10:30:00"
    },
    {
      "type":"train",
      "departureLocation":"서울역",
      "arrivalLocation":"부산역",
      "departureTime":"2026-08-12T13:20:00",
      "arrivalTime":"2026-08-12T16:05:00"
    }
  ],
  "companionTypes": ["infant"],
  "selectionMode":"manual",
  "selectedPlaces": [
    {
      "placeId":"place-001",
      "name":"국립해양박물관",
      "estimatedDurationMinutes":90
    },
    {
      "placeId":"place-004",
      "name":"부산시민공원",
      "estimatedDurationMinutes":60
    }
  ]
}
```

### 요청 필드

| 필드 | 자료형 | 필수 | 설명 |
| --- | --- | --- | --- |
| `bookings` | object[] | O | 구조화된 항공·철도 예매정보 |
| `companionTypes` | string[] | O | 동행 조건 |
| `additionalRequest` | string | X | 사용자의 추가 요청사항 |
| `selectionMode` | string | O | 관광지 선택 방식: `manual` 또는 `auto` |
| `selectedPlaces` | object[] | 조건부 | 직접 선택 시 사용자가 선택한 관광지 목록 |

### 동행 조건 선택값

```
solo
friends_couple
infant
senior
mobility_impaired
pet
```

### 처리 내용

1. 항공편과 열차의 출발·도착 시간을 고정 일정으로 확인한다.
2. `manual`이면 사용자가 선택한 관광지를 사용한다.
3. `auto`이면 동행 조건과 이동 가능 시간을 바탕으로 관광지를 자동 선택한다.
4. 관광지 운영시간, 체류시간, 장소 간 이동시간을 확인한다.
5. 식사·휴식 일정을 포함해 시간순으로 배치한다.
6. 일정에 포함하지 못한 관광지가 있다면 제외 이유를 반환한다.

### 성공 응답

```
{
  "success":true,
  "data": {
    "timelineId":"timeline-001",
    "title":"유아와 함께하는 여유로운 부산 여행",
    "summary":"긴 이동을 줄이고 일정 사이 충분한 휴식시간을 반영한 여행 일정입니다.",
    "days": [
      {
        "date":"2026-08-12",
        "items": [
          {
            "id":"item-001",
            "startTime":"10:30",
            "endTime":"11:30",
            "category":"transport",
            "title":"인천공항 도착 및 입국",
            "location":"인천국제공항",
            "description":"입국 심사와 수하물 수령을 진행합니다.",
            "recommendationReason":"유아 동반을 고려해 충분한 준비시간을 확보했습니다."
          },
          {
            "id":"item-002",
            "startTime":"11:50",
            "endTime":"12:50",
            "category":"transport",
            "title":"공항철도로 서울역 이동",
            "location":"서울역",
            "description":"공항철도를 이용해 서울역으로 이동합니다.",
            "recommendationReason":"환승이 단순하고 짐과 유모차를 가지고 이동하기 편한 경로입니다."
          },
          {
            "id":"item-003",
            "startTime":"16:40",
            "endTime":"17:40",
            "category":"rest",
            "title":"숙소 체크인 및 휴식",
            "location":"부산 숙소",
            "description":"이동 후 숙소에서 휴식합니다.",
            "recommendationReason":"유아의 피로를 고려해 관광 전에 휴식 일정을 배치했습니다."
          }
        ]
      }
    ]
  }
}
```

### 타임라인 카테고리

```
transport
food
sightseeing
activity
rest
accommodation
```

### 담당

- **AI·백엔드 로직:** 여진
- **동행 조건별 추천 기준:** 준영
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