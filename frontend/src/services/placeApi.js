import { postJson } from './apiClient'

export function recommendPlaces({ destination, companionTypes, excludePlaceIds = [], keepPlaceIds = [], arrivalTime }) {
  return postJson('/api/places/recommend', {
    destination,
    companionTypes,
    excludePlaceIds,
    keepPlaceIds,
    // 있을 때만 실어 보낸다 - 있으면 백엔드가 응답에 restaurants(음식점 추천)를 함께 계산해 준다.
    ...(arrivalTime ? { arrivalTime } : {}),
  })
}
