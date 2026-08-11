// bookings 배열에서 관광을 시작할 수 있는 기준 시각(가장 늦은 도착 시각)을 구한다.
// backend/app/services/timeline_service.py의 _compute_touring_window()와 같은 기준(가장 늦은 도착)을 쓴다.
// ISO 8601 문자열(YYYY-MM-DDTHH:mm:ss)은 사전식 비교 순서가 시간 순서와 같아 문자열 비교로 충분하다.
export function deriveLatestArrivalTime(bookings) {
  if (!Array.isArray(bookings) || bookings.length === 0) return ''

  const arrivalTimes = bookings.map((booking) => booking.arrivalTime).filter(Boolean)
  if (arrivalTimes.length === 0) return ''

  return arrivalTimes.reduce((latest, current) => (current > latest ? current : latest))
}
