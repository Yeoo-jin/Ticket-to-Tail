// 마이페이지에 보여줄 "여행 기록" 목록. 로그인이 없으므로 이번 브라우저 세션 동안만 유지된다.
// 사진은 세션 저장소에 넣을 수 없어(직렬화 불가) 여기에는 제목·진행 상태 같은 텍스트 정보만 담는다.
const HISTORY_KEY = 'ticketToTale:tripHistory:v1'
const CURRENT_KEY = 'ticketToTale:currentTrip:v1'
const SCREEN_KEY = 'ticketToTale:screenState:v1'

export function generateTripId() {
  return `trip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// 마이페이지가 항상 빈 화면으로 보이지 않도록 채워두는 예시 데이터(데모용).
// sessionStorage에 아직 아무 기록도 없을 때만(첫 방문) 보여주고, 사용자가 실제로 여행을
// 만들면(upsertTrip 이후 saveTripHistory가 호출되면) 그때부터는 실제 기록으로 대체된다.
const DEMO_TRIPS = [{ id: 'trip-demo-busan', title: '부산 가족 여행', timelineDone: true, diaryDone: true }]

export function loadTripHistory() {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY)
    if (raw === null) return DEMO_TRIPS
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveTripHistory(list) {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(list))
  } catch {
    // 저장소를 쓸 수 없어도 앱 동작에는 영향이 없어야 하므로 무시한다.
  }
}

// id가 이미 목록에 있으면 해당 필드만 덮어써 병합하고, 없으면 새 항목으로 추가한다.
export function upsertTrip(list, patch) {
  const existingIndex = list.findIndex((trip) => trip.id === patch.id)
  const base =
    existingIndex >= 0
      ? list[existingIndex]
      : { id: patch.id, title: '', timelineDone: false, diaryDone: false }
  const merged = { ...base, ...patch, updatedAt: new Date().toISOString() }

  if (existingIndex >= 0) {
    const next = [...list]
    next[existingIndex] = merged
    return next
  }
  return [...list, merged]
}

export function loadCurrentTrip() {
  try {
    const raw = sessionStorage.getItem(CURRENT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveCurrentTrip(current) {
  try {
    sessionStorage.setItem(CURRENT_KEY, JSON.stringify(current))
  } catch {
    // 무시 — 다음 저장 시점에 다시 시도된다.
  }
}

// 다이어리/타임라인 생성 중 탭이 리로드돼도(iOS Safari 백그라운드 탭 정리 등) 허브 화면으로
// 되돌아가지 않고 원래 보던 화면(플래너 등)으로 복원되도록 현재 화면 상태를 저장한다.
export function loadScreenState() {
  try {
    const raw = sessionStorage.getItem(SCREEN_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveScreenState(state) {
  try {
    sessionStorage.setItem(SCREEN_KEY, JSON.stringify(state))
  } catch {
    // 무시 — 다음 저장 시점에 다시 시도된다.
  }
}
