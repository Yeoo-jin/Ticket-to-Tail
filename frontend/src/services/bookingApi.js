import { postFormData, postJson } from './apiClient'

// /api/bookings/parse는 사진 첨부 가능성이 있어 항상 multipart/form-data로 보낸다
// (텍스트만 보낼 때도 동일하게 FormData를 씀 - 백엔드가 두 입력을 한 엔드포인트에서 받음).
export function parseBookingText(bookingText) {
  const formData = new FormData()
  formData.append('bookingText', bookingText)
  return postFormData('/api/bookings/parse', formData)
}

// photos: <input type="file" multiple>에서 받은 File 배열. 항공권 캡처 + KTX 캡처처럼
// 서로 다른 예매 내역을 여러 장으로 나눠 올려도 한 번에 다 추출된다.
export function parseBookingPhotos(photos) {
  const formData = new FormData()
  photos.forEach((photo) => formData.append('photos', photo, photo.name))
  return postFormData('/api/bookings/parse', formData)
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
