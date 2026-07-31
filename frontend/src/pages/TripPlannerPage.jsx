import { useState } from 'react'
import { parseBookingText } from '../services/bookingApi'
import { recommendPlaces } from '../services/placeApi'
import { deriveDestinationGuess } from '../utils/deriveDestination'
import BookingInputStep from './steps/BookingInputStep'
import BookingResultStep from './steps/BookingResultStep'
import CompanionSelectStep from './steps/CompanionSelectStep'
import PlaceRecommendStep from './steps/PlaceRecommendStep'

const STEP = {
  BOOKING_INPUT: 1,
  BOOKING_RESULT: 2,
  COMPANION_SELECT: 3,
  PLACE_RECOMMEND: 4,
}

function TripPlannerPage() {
  const [step, setStep] = useState(STEP.BOOKING_INPUT)

  const [bookingText, setBookingText] = useState('')
  const [bookingResult, setBookingResult] = useState(null)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState('')

  const [destination, setDestination] = useState('')
  const [companionTypes, setCompanionTypes] = useState([])

  const [places, setPlaces] = useState([])
  const [shownPlaceIds, setShownPlaceIds] = useState([])
  const [selectedPlaceIds, setSelectedPlaceIds] = useState([])
  const [placesLoading, setPlacesLoading] = useState(false)
  const [placesError, setPlacesError] = useState('')

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
    setCompanionTypes((prev) =>
      prev.includes(value) ? prev.filter((type) => type !== value) : [...prev, value],
    )
  }

  async function fetchPlaces({ excludePlaceIds = [], keepPlaceIds = [] }) {
    setPlacesLoading(true)
    setPlacesError('')
    try {
      const data = await recommendPlaces({ destination, companionTypes, excludePlaceIds, keepPlaceIds })
      setPlaces(data.places)
      setShownPlaceIds((prev) => [...new Set([...prev, ...data.places.map((place) => place.placeId)])])
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
    setShownPlaceIds([])
    const ok = await fetchPlaces({})
    if (ok) setStep(STEP.PLACE_RECOMMEND)
  }

  function handleToggleSelect(placeId) {
    setSelectedPlaceIds((prev) =>
      prev.includes(placeId) ? prev.filter((id) => id !== placeId) : [...prev, placeId],
    )
  }

  function handleSelectAll() {
    setSelectedPlaceIds(places.map((place) => place.placeId))
  }

  async function handleRefreshPlaces() {
    await fetchPlaces({ excludePlaceIds: shownPlaceIds, keepPlaceIds: selectedPlaceIds })
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <header className="mb-4">
          <h1 className="text-lg font-bold text-gray-900">Ticket to Tale</h1>
          <p className="text-xs text-gray-400">단계 {step} / 4</p>
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
            onSelectAll={handleSelectAll}
            onRefresh={handleRefreshPlaces}
            loading={placesLoading}
            error={placesError}
            onBack={() => setStep(STEP.COMPANION_SELECT)}
          />
        )}
      </div>
    </div>
  )
}

export default TripPlannerPage
