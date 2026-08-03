export const TIMELINE_TYPE_LABEL = {
  arrival: '도착',
  transport: '이동',
  attraction: '관광',
  rest: '휴식',
  departure: '출발',
}

const WEEKDAY_LABEL = ['일', '월', '화', '수', '목', '금', '토']

// startTime/endTime은 "YYYY-MM-DDTHH:MM:SS" 형식의 로컬 시각 문자열이다.
export function formatTime(isoString) {
  return isoString.slice(11, 16)
}

export function dateKey(isoString) {
  return isoString.slice(0, 10)
}

export function formatDateHeader(isoString) {
  const [year, month, day] = isoString.slice(0, 10).split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return `${month}월 ${day}일 (${WEEKDAY_LABEL[date.getDay()]})`
}
