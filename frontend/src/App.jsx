import { useEffect, useState } from 'react'
import CoverPage from './pages/CoverPage'
import HubPage from './pages/HubPage'
import MyPage from './pages/MyPage'
import SharedDiaryPage from './pages/SharedDiaryPage'
import SharedTimelinePage from './pages/SharedTimelinePage'
import TripPlannerPage from './pages/TripPlannerPage'
import {
  generateTripId,
  loadCurrentTrip,
  loadScreenState,
  loadTripHistory,
  saveCurrentTrip,
  saveScreenState,
  saveTripHistory,
  upsertTrip,
} from './utils/tripHistory'

const SCREEN = {
  COVER: 'cover',
  HUB: 'hub',
  PLANNER: 'planner',
  MYPAGE: 'mypage',
}

// 라우팅은 카카오톡 등으로 공유된 타임라인·다이어리 결과를 로그인 없이 열람하는
// 이 두 경로에만 쓴다. 그 외 화면은 지금처럼 내부 state로만 전환한다(별도 URL 없음).
function parseShareRoute() {
  const match = window.location.pathname.match(/^\/share\/(timeline|diary)\/([^/]+)\/?$/)
  if (!match) return null
  return { type: match[1], shareId: match[2] }
}

function App() {
  const [currentTrip, setCurrentTrip] = useState(loadCurrentTrip)
  const [tripHistory, setTripHistory] = useState(loadTripHistory)
  const [screen, setScreen] = useState(() => {
    if (!currentTrip) return SCREEN.COVER
    const saved = loadScreenState()
    return saved && Object.values(SCREEN).includes(saved.screen) ? saved.screen : SCREEN.HUB
  })
  const [plannerEntryMode, setPlannerEntryMode] = useState(() => loadScreenState()?.plannerEntryMode ?? 'timeline')

  // 다이어리/타임라인 생성 중 탭이 리로드돼도 허브로 초기화되지 않고 하던 화면으로 돌아오도록
  // 화면 상태를 계속 저장한다(진행 중이던 입력 데이터 자체는 TripPlannerPage가 별도로 저장).
  useEffect(() => {
    saveScreenState({ screen, plannerEntryMode })
  }, [screen, plannerEntryMode])

  const shareRoute = parseShareRoute()

  const activeTrip = tripHistory.find((trip) => trip.id === currentTrip?.id)
  const timelineDone = activeTrip?.timelineDone ?? false
  const diaryDone = activeTrip?.diaryDone ?? false

  function handleCoverSubmit(title) {
    const trip = { id: generateTripId(), title, timelineDone: false, diaryDone: false }
    const nextHistory = upsertTrip(tripHistory, trip)
    setTripHistory(nextHistory)
    saveTripHistory(nextHistory)

    const nextCurrent = { id: trip.id, title }
    setCurrentTrip(nextCurrent)
    saveCurrentTrip(nextCurrent)
    setScreen(SCREEN.HUB)
  }

  function markCurrentTripDone(field) {
    if (!currentTrip) return
    const nextHistory = upsertTrip(tripHistory, { id: currentTrip.id, title: currentTrip.title, [field]: true })
    setTripHistory(nextHistory)
    saveTripHistory(nextHistory)
  }

  function openPlanner(mode) {
    setPlannerEntryMode(mode)
    setScreen(SCREEN.PLANNER)
  }

  if (shareRoute?.type === 'timeline') {
    return <SharedTimelinePage shareId={shareRoute.shareId} />
  }
  if (shareRoute?.type === 'diary') {
    return <SharedDiaryPage shareId={shareRoute.shareId} />
  }

  if (screen === SCREEN.COVER) {
    return <CoverPage onSubmit={handleCoverSubmit} />
  }

  if (screen === SCREEN.MYPAGE) {
    return <MyPage trips={tripHistory} onBack={() => setScreen(SCREEN.HUB)} />
  }

  if (screen === SCREEN.PLANNER) {
    return (
      <TripPlannerPage
        entryMode={plannerEntryMode}
        onBack={() => setScreen(SCREEN.HUB)}
        onTimelineComplete={() => markCurrentTripDone('timelineDone')}
        onDiaryComplete={() => markCurrentTripDone('diaryDone')}
      />
    )
  }

  return (
    <HubPage
      title={currentTrip?.title ?? ''}
      timelineDone={timelineDone}
      diaryDone={diaryDone}
      onGenerateTimeline={() => openPlanner('timeline')}
      onGenerateDiary={() => openPlanner('diary')}
      onOpenMyPage={() => setScreen(SCREEN.MYPAGE)}
    />
  )
}

export default App
