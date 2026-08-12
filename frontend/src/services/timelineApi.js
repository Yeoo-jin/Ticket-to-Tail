import { postJson } from './apiClient'

// days: [{ date, placeIds, restaurantIds }] — 날짜별 선택 결과.
// customPlaces: { [placeId]: name } — 추천 후보 대신 직접 입력한 장소.
// accommodation: { name, address, lat, lng } — 입력하면 매일 마지막 일정 뒤 숙소로 이동하는 항목이 추가된다.
export function generateTimeline({
  bookings,
  companionTypes,
  days,
  destination,
  pace,
  seed,
  customPlaces = {},
  accommodation,
}) {
  const body = { bookings, companionTypes, days, destination, pace, customPlaces }
  if (seed !== undefined && seed !== null) {
    body.seed = seed
  }
  if (accommodation) {
    body.accommodation = accommodation
  }
  return postJson('/api/timelines/generate', body)
}
