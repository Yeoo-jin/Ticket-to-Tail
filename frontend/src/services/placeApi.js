import { postJson } from './apiClient'

export function recommendPlaces({ destination, companionTypes, excludePlaceIds = [], keepPlaceIds = [] }) {
  return postJson('/api/places/recommend', {
    destination,
    companionTypes,
    excludePlaceIds,
    keepPlaceIds,
  })
}
