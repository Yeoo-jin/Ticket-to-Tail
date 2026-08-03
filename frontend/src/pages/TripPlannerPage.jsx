import { useEffect, useRef, useState } from 'react'
import { parseBookingText } from '../services/bookingApi'
import { generateDiary } from '../services/diaryApi'
import { recommendPlaces } from '../services/placeApi'
import { generateTimeline } from '../services/timelineApi'
import { toggleCompanionSelection } from '../utils/companionTypes'
import { deriveDestinationGuess } from '../utils/deriveDestination'
import { DEFAULT_BACKGROUND_COLOR } from '../utils/backgroundColor'
import { buildDefaultBackgroundCaptions } from '../utils/memoDistribution'
import { DEFAULT_SPLIT_COUNT } from '../utils/panoramaLayouts'
import { canGenerateDiary, removePhotoAt, resolveNewPhotos } from '../utils/photoUpload'
import { setPhotoStyleField } from '../utils/photoStyle'
import { SELECTION_LIMIT_MESSAGE, resolveAutoSelection, toggleSelection } from '../utils/placeSelection'
import { DEFAULT_POSTER_FONT } from '../utils/posterFonts'
import BookingInputStep from './steps/BookingInputStep'
import BookingResultStep from './steps/BookingResultStep'
import CompanionSelectStep from './steps/CompanionSelectStep'
import DiaryInputStep from './steps/DiaryInputStep'
import DiaryResultStep from './steps/DiaryResultStep'
import PlaceRecommendStep from './steps/PlaceRecommendStep'
import TimelineResultStep from './steps/TimelineResultStep'

const STEP = {
  BOOKING_INPUT: 1,
  BOOKING_RESULT: 2,
  COMPANION_SELECT: 3,
  PLACE_RECOMMEND: 4,
  TIMELINE_RESULT: 5,
  DIARY_INPUT: 6,
  DIARY_RESULT: 7,
}
const TOTAL_STEPS = 7

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

  // photos: [{ file, previewUrl, memo }]
  const [photos, setPhotos] = useState([])
  const [photoError, setPhotoError] = useState('')
  const [diaryMemo, setDiaryMemo] = useState('')
  const [diaryTone, setDiaryTone] = useState('emotional')
  const [diaryData, setDiaryData] = useState(null)
  const [diaryLoading, setDiaryLoading] = useState(false)
  const [diaryError, setDiaryError] = useState('')

  // 결과 화면 표시·꾸미기 상태는 "처음부터 다시 시작"에서만 초기화한다.
  const [diaryViewMode, setDiaryViewMode] = useState('carousel')
  const [splitCount, setSplitCount] = useState(DEFAULT_SPLIT_COUNT)
  const [panoramaViewMode, setPanoramaViewMode] = useState('connected')
  const [activeViewportIndex, setActiveViewportIndex] = useState(0)
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_BACKGROUND_COLOR)
  const [font, setFont] = useState(DEFAULT_POSTER_FONT)
  const [polaroidCaptionSize, setPolaroidCaptionSize] = useState(24)
  const [backgroundTextSize, setBackgroundTextSize] = useState(40)
  // photoCaptions: 사진별 아래 글귀(index 정렬). null이면 아직 초기화 전(첫 생성 시 photoMemo로 채움).
  const [photoCaptions, setPhotoCaptions] = useState(null)
  // backgroundCaptions: 배경 위 독립 글귀 3개. null이면 아직 초기화 전(첫 생성 시 기본값으로 채움).
  const [backgroundCaptions, setBackgroundCaptions] = useState(null)
  const [photoStyles, setPhotoStyles] = useState({})

  // 사진 미리보기 URL은 컴포넌트가 완전히 사라질 때 한 번에 정리한다 (최신 photos를 ref로 추적).
  const photosRef = useRef(photos)
  useEffect(() => {
    photosRef.current = photos
  }, [photos])
  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
    }
  }, [])

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

  function handleAddPhotos(fileList) {
    const { accepted, errors } = resolveNewPhotos(photos.length, fileList)
    if (accepted.length > 0) {
      const newEntries = accepted.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        memo: '',
      }))
      setPhotos((prev) => [...prev, ...newEntries])
    }
    setPhotoError(errors.length > 0 ? errors[0] : '')
  }

  function handleRemovePhoto(index) {
    setPhotos((prev) => {
      const target = prev[index]
      if (target) URL.revokeObjectURL(target.previewUrl)
      return removePhotoAt(prev, index)
    })
    setPhotoError('')
  }

  function handleChangePhotoMemo(index, value) {
    setPhotos((prev) => prev.map((photo, i) => (i === index ? { ...photo, memo: value } : photo)))
  }

  function handleChangePhotoStyle(index, field, value) {
    setPhotoStyles((prev) => setPhotoStyleField(prev, index, field, value))
  }

  function handleChangePhotoCaption(index, value) {
    setPhotoCaptions((prev) => {
      const next = [...(prev || [])]
      next[index] = value
      return next
    })
  }

  function handleChangeBackgroundCaption(presetId, patch) {
    setBackgroundCaptions((prev) =>
      (prev || []).map((caption) => (caption.presetId === presetId ? { ...caption, ...patch } : caption))
    )
  }

  async function requestDiary() {
    setDiaryLoading(true)
    setDiaryError('')
    try {
      const data = await generateDiary({
        destination,
        tone: diaryTone,
        memo: diaryMemo,
        companionTypes,
        timeline: timelineData,
        selectedPlaceIds,
        photoMemos: photos.map((photo) => photo.memo),
        photos,
      })
      setDiaryData(data)
      // 사진별 글귀: 이미 사용자가 수정한 값은 그대로 두고(인덱스로 정렬), 새로 추가된
      // 사진에만 해당 photoMemo를 기본값으로 채운다. "같은 정보로 다시 생성"에서도 유지된다.
      setPhotoCaptions((prev) =>
        photos.map((photo, index) => (prev && prev[index] !== undefined ? prev[index] : photo.memo))
      )
      // 배경 글귀: 최초 생성 시 한 번만 기본값(diaryMemo 문장 → destination → 날짜)을 만들고,
      // 이후에는 사용자가 수정한 값을 그대로 유지한다.
      setBackgroundCaptions((prev) => {
        if (prev) return prev
        const dateLabel = timelineData?.timeline?.[0]?.startTime?.slice(0, 10) || ''
        return buildDefaultBackgroundCaptions({ diaryMemo, destination, dateLabel })
      })
      return true
    } catch (error) {
      setDiaryError(error.message)
      return false
    } finally {
      setDiaryLoading(false)
    }
  }

  async function handleGenerateDiary() {
    const ok = await requestDiary()
    if (ok) setStep(STEP.DIARY_RESULT)
  }

  async function handleRegenerateDiary() {
    // 사진·메모·문체·타임라인을 그대로 유지한 채 같은 조건으로 다시 생성한다.
    await requestDiary()
  }

  function handleStartOver() {
    photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))

    setStep(STEP.BOOKING_INPUT)
    setBookingText('')
    setBookingResult(null)
    setBookingError('')
    setDestination('')
    setCompanionTypes([])
    setPlaces([])
    setAutoSelectedPlaceIds([])
    setSelectedPlaceIds([])
    setSelectionLimitMessage('')
    setPlacesError('')
    setPace('normal')
    setTimelineData(null)
    setTimelineError('')
    setPhotos([])
    setPhotoError('')
    setDiaryMemo('')
    setDiaryTone('emotional')
    setDiaryData(null)
    setDiaryError('')
    setDiaryViewMode('carousel')
    setSplitCount(DEFAULT_SPLIT_COUNT)
    setPanoramaViewMode('connected')
    setActiveViewportIndex(0)
    setBackgroundColor(DEFAULT_BACKGROUND_COLOR)
    setFont(DEFAULT_POSTER_FONT)
    setPolaroidCaptionSize(24)
    setBackgroundTextSize(40)
    setPhotoCaptions(null)
    setBackgroundCaptions(null)
    setPhotoStyles({})
  }

  return (
    <div className="min-h-app bg-gray-50 px-4 py-6">
      <div className="mx-auto w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <header className="mb-4">
          <h1 className="text-lg font-bold text-gray-900">Ticket to Tale</h1>
          <p className="text-xs text-gray-400">
            단계 {step} / {TOTAL_STEPS}
          </p>
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
            onGoToDiary={() => setStep(STEP.DIARY_INPUT)}
            loading={timelineLoading}
            error={timelineError}
          />
        )}

        {step === STEP.DIARY_INPUT && (
          <DiaryInputStep
            destination={destination}
            timelineData={timelineData}
            photos={photos}
            photoError={photoError}
            onAddPhotos={handleAddPhotos}
            onRemovePhoto={handleRemovePhoto}
            onChangePhotoMemo={handleChangePhotoMemo}
            memo={diaryMemo}
            onChangeMemo={setDiaryMemo}
            tone={diaryTone}
            onChangeTone={setDiaryTone}
            onSubmit={handleGenerateDiary}
            canSubmit={canGenerateDiary({ memo: diaryMemo, photoCount: photos.length })}
            loading={diaryLoading}
            error={diaryError}
            onBack={() => setStep(STEP.TIMELINE_RESULT)}
          />
        )}

        {step === STEP.DIARY_RESULT && (
          <DiaryResultStep
            diaryData={diaryData}
            photos={photos}
            destination={destination}
            viewMode={diaryViewMode}
            onChangeViewMode={setDiaryViewMode}
            splitCount={splitCount}
            onChangeSplitCount={setSplitCount}
            panoramaViewMode={panoramaViewMode}
            onChangePanoramaViewMode={setPanoramaViewMode}
            activeViewportIndex={activeViewportIndex}
            onChangeActiveViewportIndex={setActiveViewportIndex}
            backgroundColor={backgroundColor}
            onChangeBackgroundColor={setBackgroundColor}
            font={font}
            onChangeFont={setFont}
            polaroidCaptionSize={polaroidCaptionSize}
            onChangePolaroidCaptionSize={setPolaroidCaptionSize}
            backgroundTextSize={backgroundTextSize}
            onChangeBackgroundTextSize={setBackgroundTextSize}
            photoCaptions={photoCaptions || []}
            onChangePhotoCaption={handleChangePhotoCaption}
            backgroundCaptions={backgroundCaptions || []}
            onChangeBackgroundCaption={handleChangeBackgroundCaption}
            photoStyles={photoStyles}
            onChangePhotoStyle={handleChangePhotoStyle}
            onRegenerate={handleRegenerateDiary}
            onEditInput={() => setStep(STEP.DIARY_INPUT)}
            onStartOver={handleStartOver}
            loading={diaryLoading}
            error={diaryError}
          />
        )}
      </div>
    </div>
  )
}

export default TripPlannerPage
