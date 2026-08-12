import { postJson } from './apiClient'

// destination: 여행 목적지, companionTypes: 동행 조건, bookings: 예매정보(여행 날짜 계산용).
// targetDate가 있으면 그 날짜 하나만 다시 계산한다("다른 후보 추천받기" 새로고침용).
export function recommendPlaces({
  destination,
  companionTypes,
  bookings,
  excludePlaceIds = [],
  keepPlaceIds = [],
  targetDate,
}) {
  return postJson('/api/places/recommend', {
    destination,
    companionTypes,
    bookings,
    excludePlaceIds,
    keepPlaceIds,
    ...(targetDate ? { targetDate } : {}),
  })
}
