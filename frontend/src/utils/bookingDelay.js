// 지연 시간(분)을 예매 시각에 반영해, 타임라인을 다시 계산할 때 쓸 새 bookings 배열을
// 만든다. 편명·열차번호가 없는 예매도 있을 수 있어(AI가 못 뽑은 경우) transitNumber가
// 아니라 배열 안에서의 위치(index)로 어떤 예매인지 매칭한다.

function addMinutesToIsoString(isoString, minutes) {
  if (!isoString) return isoString
  const date = new Date(isoString)
  date.setMinutes(date.getMinutes() + minutes)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}:${pad(date.getSeconds())}`
}

// delayMinutesByIndex: { [bookingIndex]: delayMinutes } — 지연 입력이 있는 예매만 담는다.
export function applyDelaysToBookings(bookings, delayMinutesByIndex) {
  return bookings.map((booking, index) => {
    const delayMinutes = delayMinutesByIndex[index]
    if (!delayMinutes) return booking
    return {
      ...booking,
      departureTime: addMinutesToIsoString(booking.departureTime, delayMinutes),
      arrivalTime: addMinutesToIsoString(booking.arrivalTime, delayMinutes),
    }
  })
}

const TYPE_LABEL = { flight: '항공편', train: '열차' }

function formatShort(isoString) {
  if (!isoString) return ''
  const [datePart, timePart] = isoString.split('T')
  const [, month, day] = datePart.split('-')
  return `${Number(month)}/${Number(day)} ${timePart.slice(0, 5)}`
}

// 여러 예매(서울→부산 KTX, 부산→서울 KTX, 인천공항 항공편 등)가 섞여 있어도 어떤
// 구간에 지연을 입력하는 건지 한눈에 알 수 있게 라벨을 만든다.
// 예: "열차 KTX101 · 서울역 → 부산역 · 8/13 05:13 출발"
export function formatBookingLabel(booking) {
  const parts = [TYPE_LABEL[booking.type] || booking.type]
  if (booking.transitNumber) parts.push(booking.transitNumber)

  const route = [booking.departureLocation, booking.arrivalLocation].filter(Boolean).join(' → ')
  if (route) parts.push(route)

  if (booking.departureTime) {
    parts.push(`${formatShort(booking.departureTime)} 출발`)
  } else if (booking.arrivalTime) {
    parts.push(`${formatShort(booking.arrivalTime)} 도착`)
  }

  return parts.join(' · ')
}
