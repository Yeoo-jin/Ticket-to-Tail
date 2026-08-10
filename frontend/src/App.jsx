import { useState } from 'react'
import CoverPage from './pages/CoverPage'
import HubPage from './pages/HubPage'
import MyPage from './pages/MyPage'
import TripPlannerPage from './pages/TripPlannerPage'
import {
  generateTripId,
  loadCurrentTrip,
  loadTripHistory,
  saveCurrentTrip,
  saveTripHistory,
  upsertTrip,
} from './utils/tripHistory'

const SCREEN = {
  COVER: 'cover',
  HUB: 'hub',
  PLANNER: 'planner',
  MYPAGE: 'mypage',
}

function App() {
  const [currentTrip, setCurrentTrip] = useState(loadCurrentTrip)
  const [tripHistory, setTripHistory] = useState(loadTripHistory)
  const [screen, setScreen] = useState(currentTrip ? SCREEN.HUB : SCREEN.COVER)
  const [plannerEntryMode, setPlannerEntryMode] = useState('timeline')

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
