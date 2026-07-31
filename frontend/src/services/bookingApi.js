import { postJson } from './apiClient'

export function parseBookingText(bookingText) {
  return postJson('/api/bookings/parse', { bookingText })
}
