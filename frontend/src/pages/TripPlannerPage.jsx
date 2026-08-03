import { useState } from 'react'
import { parseBookingText } from '../services/bookingApi'
import { recommendPlaces } from '../services/placeApi'
import { generateTimeline } from '../services/timelineApi'
import { toggleCompanionSelection } from '../utils/companionTypes'
import { deriveDestinationGuess } from '../utils/deriveDestination'
import { SELECTION_LIMIT_MESSAGE, resolveAutoSelection, toggleSelection } from '../utils/placeSelection'
import BookingInputStep from './steps/BookingInputStep'
import BookingResultStep from './steps/BookingResultStep'
import CompanionSelectStep from './steps/CompanionSelectStep'
import PlaceRecommendStep from './steps/PlaceRecommendStep'
import TimelineResultStep from './steps/TimelineResultStep'

const STEP = {
  BOOKING_INPUT: 1,
  BOOKING_RESULT: 2,
  COMPANION_SELECT: 3,
  PLACE_RECOMMEND: 4,
  TIMELINE_RESULT: 5,
}
const TOTAL_STEPS = 5

function TripPlannerPage() {
  const [step, setStep] = useState(STEP.BOOKING_INPUT)

  const [bookingText, setBookingText] = useState('')
  const [bookingResult, setBookingResult] = useState(null)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState('')

  const [destination, setDestination] = useState('')
  const [companionTypes, setCompanionTypes] = useState([])

  const [places, setPlaces] = useState([])
  const [autoSelectedPlaceIds, setAutoSelectedPlaceIds] = useState([])
  const [selectedPlaceIds, setSelectedPlaceIds] = useState([])
  const [selectionLimitMessage, setSelectionLimitMessage] = useState('')
  const [placesLoading, setPlacesLoading] = useState(false)
  const [placesError, setPlacesError] = useState('')

  const [pace, setPace] = useState('normal')
  const [timelineData, setTimelineData] = useState(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState('')

  async function handleParseBooking() {
    setBookingLoading(true)
    setBookingError('')
    try {
      const data = await parseBookingText(bookingText)
      setBookingResult(data)
      setDestination(deriveDestinationGuess(data.bookings))
      setStep(STEP.BOOKING_RESULT)
    } catch (error) {
      setBookingError(error.message)
    } finally {
      setBookingLoading(false)
    }
  }

  function toggleCompanionType(value) {
    setCompanionTypes((prev) => toggleCompanionSelection(prev, value))
  }

  async function fetchPlaces({ excludePlaceIds = [], keepPlaceIds = [] }) {
    setPlacesLoading(true)
    setPlacesError('')
    try {
      const data = await recommendPlaces({ destination, companionTypes, excludePlaceIds, keepPlaceIds })
      setPlaces(data.places)
      setAutoSelectedPlaceIds(data.autoSelectedPlaceIds)
      return true
    } catch (error) {
      setPlacesError(error.message)
      return false
    } finally {
      setPlacesLoading(false)
    }
  }

  async function handleRequestPlaces() {
    setSelectedPlaceIds([])
    setSelectionLimitMessage('')
    const ok = await fetchPlaces({})
    if (ok) setStep(STEP.PLACE_RECOMMEND)
  }

  function handleToggleSelect(placeId) {
    const { selectedIds, limitReached } = toggleSelection(selectedPlaceIds, placeId)
    setSelectedPlaceIds(selectedIds)
    setSelectionLimitMessage(limitReached ? SELECTION_LIMIT_MESSAGE : '')
  }

  function handleAutoSelect() {
    const availableIds = places.map((place) => place.placeId)
    setSelectedPlaceIds(resolveAutoSelection(autoSelectedPlaceIds, availableIds))
    setSelectionLimitMessage('')
  }

  async function handleRefreshPlaces() {
    // 선택한 관광지(keepPlaceIds)는 그대로 유지하고, 선택하지 않은 현재 후보(excludePlaceIds)만 교체한다.
    const keepPlaceIds = selectedPlaceIds
    const excludePlaceIds = places
      .filter((place) => !selectedPlaceIds.includes(place.placeId))
      .map((place) => place.placeId)
    setSelectionLimitMessage('')
    await fetchPlaces({ excludePlaceIds, keepPlaceIds })
  }

  async function requestTimeline() {
    setTimelineLoading(true)
    setTimelineError('')
    try {
      const data = await generateTimeline({
        bookings: bookingResult.bookings,
        companionTypes,
        selectedPlaceIds,
        destination,
        pace,
      })
      setTimelineData(data)
      return true
    } catch (error) {
      setTimelineError(error.message)
      return false
    } finally {
      setTimelineLoading(false)
    }
  }

  async function handleGenerateTimeline() {
    const ok = await requestTimeline()
    if (ok) setStep(STEP.TIMELINE_RESULT)
  }

  async function handleRegenerateTimeline() {
    // selectedPlaceIds는 그대로 두고, 방문 순서·휴식 배치만 다시 계산되도록 동일 조건으로 재요청한다.
    await requestTimeline()
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <header className="mb-4">
          <h1 className="text-lg font-bold text-gray-900">Ticket to Tale</h1>
          <p className="text-xs text-gray-400">단계 {step} / {TOTAL_STEPS}</p>
        </header>

        {step === STEP.BOOKING_INPUT && (
          <BookingInputStep
            bookingText={bookingText}
            onChangeText={setBookingText}
            onSubmit={handleParseBooking}
            loading={bookingLoading}
            error={bookingError}
          />
        )}

        {step === STEP.BOOKING_RESULT && bookingResult && (
          <BookingResultStep
            bookingResult={bookingResult}
            onBack={() => setStep(STEP.BOOKING_INPUT)}
            onNext={() => setStep(STEP.COMPANION_SELECT)}
          />
        )}

        {step === STEP.COMPANION_SELECT && (
          <CompanionSelectStep
            destination={destination}
            onChangeDestination={setDestination}
            selectedCompanionTypes={companionTypes}
            onToggleCompanionType={toggleCompanionType}
            onSubmit={handleRequestPlaces}
            loading={placesLoading}
            error={placesError}
            onBack={() => setStep(STEP.BOOKING_RESULT)}
          />
        )}

        {step === STEP.PLACE_RECOMMEND && (
          <PlaceRecommendStep
            places={places}
            selectedPlaceIds={selectedPlaceIds}
            onToggleSelect={handleToggleSelect}
            selectionLimitMessage={selectionLimitMessage}
            onAutoSelect={handleAutoSelect}
            onRefresh={handleRefreshPlaces}
            pace={pace}
            onChangePace={setPace}
            onGenerateTimeline={handleGenerateTimeline}
            timelineLoading={timelineLoading}
            timelineError={timelineError}
            loading={placesLoading}
            error={placesError}
            onBack={() => setStep(STEP.COMPANION_SELECT)}
          />
        )}

        {step === STEP.TIMELINE_RESULT && (
          <TimelineResultStep
            timelineData={timelineData}
            onRegenerate={handleRegenerateTimeline}
            onReselectPlaces={() => setStep(STEP.PLACE_RECOMMEND)}
            loading={timelineLoading}
            error={timelineError}
          />
        )}
      </div>
    </div>
  )
}

export default TripPlannerPage
