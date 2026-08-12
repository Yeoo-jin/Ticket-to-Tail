import { postJson } from './apiClient'

// days: [{ date, placeIds, restaurantIds }] — 날짜별 선택 결과.
// customPlaces: { [placeId]: name } — 추천 후보 대신 직접 입력한 장소.
export function generateTimeline({ bookings, companionTypes, days, destination, pace, seed, customPlaces = {} }) {
  const body = { bookings, companionTypes, days, destination, pace, customPlaces }
  if (seed !== undefined && seed !== null) {
    body.seed = seed
  }
  return postJson('/api/timelines/generate', body)
}
