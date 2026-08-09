import { postJson } from './apiClient'

export function parseBookingText(bookingText) {
  return postJson('/api/bookings/parse', { bookingText })
}

export function checkTransitStatus(booking) {
  return postJson('/api/bookings/status', {
    type: booking.type,
    transitNumber: booking.transitNumber,
    departureLocation: booking.departureLocation,
    arrivalLocation: booking.arrivalLocation,
    departureTime: booking.departureTime,
    arrivalTime: booking.arrivalTime,
  })
}
