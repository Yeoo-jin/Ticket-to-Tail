import { postJson } from './apiClient'

// bookings만으로(동행 조건은 아직 안 골랐을 수 있음) 항공↔철도 환승 대기 시간에 넣을 수
// 있는 추천 후보를 미리 받아온다. { hubRegion, windowMinutes, candidates: Place[] }.
// 매칭되는 환승 구간이 없으면 candidates가 빈 배열로 온다.
export function fetchLayoverCandidates(bookings, companionTypes = []) {
  return postJson('/api/timelines/layover-candidates', { bookings, companionTypes })
}

// days: [{ date, placeIds, restaurantIds }] — 날짜별 선택 결과.
// customPlaces: { [placeId]: name } — 추천 후보 대신 직접 입력한 장소.
// accommodation: { name, address, lat, lng } — 입력하면 매일 마지막 일정 뒤 숙소로 이동하는 항목이 추가된다.
// layoverPlace: { name, address, lat, lng } — 입력하면 항공↔철도 환승 대기 시간에
// 이 장소를 우선해서 채운다(서울역·인천공항 데이터가 없어도 동작).
export function generateTimeline({
  bookings,
  companionTypes,
  days,
  destination,
  pace,
  seed,
  customPlaces = {},
  accommodation,
  layoverPlace,
}) {
  const body = { bookings, companionTypes, days, destination, pace, customPlaces }
  if (seed !== undefined && seed !== null) {
    body.seed = seed
  }
  if (accommodation) {
    body.accommodation = accommodation
  }
  if (layoverPlace) {
    body.layoverPlace = layoverPlace
  }
  return postJson('/api/timelines/generate', body)
}
