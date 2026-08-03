import { postJson } from './apiClient'

export function generateTimeline({ bookings, companionTypes, selectedPlaceIds, destination, pace, seed }) {
  const body = { bookings, companionTypes, selectedPlaceIds, destination, pace }
  if (seed !== undefined && seed !== null) {
    body.seed = seed
  }
  return postJson('/api/timelines/generate', body)
}
