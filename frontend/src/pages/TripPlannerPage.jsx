import { useEffect, useRef, useState } from 'react'
import { parseBookingText } from '../services/bookingApi'
import { generateDiary } from '../services/diaryApi'
import { recommendPlaces } from '../services/placeApi'
import { generateTimeline } from '../services/timelineApi'
import { toggleCompanionSelection } from '../utils/companionTypes'
import { deriveDestinationGuess } from '../utils/deriveDestination'
import { DEFAULT_BACKGROUND_COLOR } from '../utils/backgroundColor'
import { DEFAULT_CHECK_SPACING, DEFAULT_DOT_SIZE, DEFAULT_PATTERN_COLOR } from '../utils/backgroundPattern'
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

// 진행 상태를 sessionStorage에 저장해, 브라우저(특히 iPhone Safari)가 탭을 새로고침해도
// 처음(1단계)으로 돌아가지 않고 하던 화면으로 복원되게 한다. 업로드한 사진(File)은
// sessionStorage에 저장할 수 없어(직렬화 불가) 복원 대상에서 제외한다 — 사진이 필요한
// 화면(6·7단계)으로 복원되더라도 사진 슬롯만 비어 보일 뿐 화면 자체가 깨지지는 않는다.
const STORAGE_KEY = 'ticketToTale:tripPlannerState:v1'

function loadPersistedState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function TripPlannerPage({ entryMode = 'timeline', onBack, onTimelineComplete, onDiaryComplete }) {
  const [persisted] = useState(loadPersistedState)

  const [step, setStep] = useState(persisted?.step ?? STEP.BOOKING_INPUT)

  const [bookingText, setBookingText] = useState(persisted?.bookingText ?? '')
  const [bookingResult, setBookingResult] = useState(persisted?.bookingResult ?? null)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState('')

  const [destination, setDestination] = useState(persisted?.destination ?? '')
  const [companionTypes, setCompanionTypes] = useState(persisted?.companionTypes ?? [])

  const [places, setPlaces] = useState(persisted?.places ?? [])
  const [autoSelectedPlaceIds, setAutoSelectedPlaceIds] = useState(persisted?.autoSelectedPlaceIds ?? [])
  const [selectedPlaceIds, setSelectedPlaceIds] = useState(persisted?.selectedPlaceIds ?? [])
  const [selectionLimitMessage, setSelectionLimitMessage] = useState('')
  const [placesLoading, setPlacesLoading] = useState(false)
  const [placesError, setPlacesError] = useState('')

  const [pace, setPace] = useState(persisted?.pace ?? 'normal')
  const [timelineData, setTimelineData] = useState(persisted?.timelineData ?? null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState('')

  // photos: [{ file, previewUrl, memo }] — 새로고침 후에는 복원되지 않는다(위 설명 참고).
  const [photos, setPhotos] = useState([])
  const [photoError, setPhotoError] = useState('')
  const [diaryMemo, setDiaryMemo] = useState(persisted?.diaryMemo ?? '')
  const [diaryTone, setDiaryTone] = useState(persisted?.diaryTone ?? 'emotional')
  const [diaryData, setDiaryData] = useState(persisted?.diaryData ?? null)
  const [diaryLoading, setDiaryLoading] = useState(false)
  const [diaryError, setDiaryError] = useState('')

  // 결과 화면 표시·꾸미기 상태는 "처음부터 다시 시작"에서만 초기화한다.
  const [splitCount, setSplitCount] = useState(persisted?.splitCount ?? DEFAULT_SPLIT_COUNT)
  const [panoramaViewMode, setPanoramaViewMode] = useState(persisted?.panoramaViewMode ?? 'connected')
  const [activeViewportIndex, setActiveViewportIndex] = useState(persisted?.activeViewportIndex ?? 0)
  const [backgroundColor, setBackgroundColor] = useState(persisted?.backgroundColor ?? DEFAULT_BACKGROUND_COLOR)
  const [backgroundPattern, setBackgroundPattern] = useState(persisted?.backgroundPattern ?? 'solid')
  const [patternColor, setPatternColor] = useState(persisted?.patternColor ?? DEFAULT_PATTERN_COLOR)
  const [dotSize, setDotSize] = useState(persisted?.dotSize ?? DEFAULT_DOT_SIZE)
  const [dotShape, setDotShape] = useState(persisted?.dotShape ?? 'circle')
  const [checkSpacing, setCheckSpacing] = useState(persisted?.checkSpacing ?? DEFAULT_CHECK_SPACING)
  const [font, setFont] = useState(persisted?.font ?? DEFAULT_POSTER_FONT)
  const [polaroidCaptionSize, setPolaroidCaptionSize] = useState(persisted?.polaroidCaptionSize ?? 24)
  const [backgroundTextSize, setBackgroundTextSize] = useState(persisted?.backgroundTextSize ?? 40)
  // photoCaptions: 사진별 아래 글귀(index 정렬). null이면 아직 초기화 전(첫 생성 시 photoMemo로 채움).
  const [photoCaptions, setPhotoCaptions] = useState(persisted?.photoCaptions ?? null)
  // backgroundCaptions: 배경 위 독립 글귀 3개. null이면 아직 초기화 전(첫 생성 시 기본값으로 채움).
  const [backgroundCaptions, setBackgroundCaptions] = useState(persisted?.backgroundCaptions ?? null)
  const [photoStyles, setPhotoStyles] = useState(persisted?.photoStyles ?? {})

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

  // 진행 상태를 sessionStorage에 계속 저장한다(로딩 중 상태·오류 메시지·사진은 제외 —
  // 로딩 중 상태로 복원되면 영원히 도는 스피너만 보이고, 오류는 새로고침 후엔 의미가 없다).
  useEffect(() => {
    const snapshot = {
      step,
      bookingText,
      bookingResult,
      destination,
      companionTypes,
      places,
      autoSelectedPlaceIds,
      selectedPlaceIds,
      pace,
      timelineData,
      diaryMemo,
      diaryTone,
      diaryData,
      splitCount,
      panoramaViewMode,
      activeViewportIndex,
      backgroundColor,
      backgroundPattern,
      patternColor,
      dotSize,
      dotShape,
      checkSpacing,
      font,
      polaroidCaptionSize,
      backgroundTextSize,
      photoCaptions,
      backgroundCaptions,
      photoStyles,
    }
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    } catch {
      // sessionStorage를 쓸 수 없어도(용량 초과 등) 앱 동작 자체에는 영향이 없어야 하므로 무시한다.
    }
  }, [
    step,
    bookingText,
    bookingResult,
    destination,
    companionTypes,
    places,
    autoSelectedPlaceIds,
    selectedPlaceIds,
    pace,
    timelineData,
    diaryMemo,
    diaryTone,
    diaryData,
    splitCount,
    panoramaViewMode,
    activeViewportIndex,
    backgroundColor,
    backgroundPattern,
    patternColor,
    dotSize,
    dotShape,
    checkSpacing,
    font,
    polaroidCaptionSize,
    backgroundTextSize,
    photoCaptions,
    backgroundCaptions,
    photoStyles,
  ])

  // 개발 환경에서만: 페이지가 왜 다시 로드됐는지(HMR 재연결, 탭 백그라운드 전환 등) 추적하기
  // 위한 진단 로그. 프로덕션 빌드에는 포함되지 않는다.
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined

    function handlePageShow(event) {
      const navEntry = performance.getEntriesByType?.('navigation')?.[0]
      console.log('[dev] pageshow', { persisted: event.persisted, navigationType: navEntry?.type })
    }
    function handlePageHide(event) {
      console.log('[dev] pagehide', { persisted: event.persisted })
    }
    function handleBeforeUnload() {
      console.log('[dev] beforeunload')
    }

    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  // 허브 화면에서 "다이어리 생성"을 눌러 들어온 경우, 타임라인이 이미 있으면
  // 예매정보 입력부터가 아니라 사진 업로드(다이어리 입력) 단계로 바로 이동한다.
  useEffect(() => {
    if (entryMode === 'diary' && timelineData && step !== STEP.DIARY_RESULT) {
      setStep(STEP.DIARY_INPUT)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (ok) {
      setStep(STEP.TIMELINE_RESULT)
      onTimelineComplete?.()
    }
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
    if (ok) {
      setStep(STEP.DIARY_RESULT)
      onDiaryComplete?.()
    }
  }

  async function handleRegenerateDiary() {
    // 사진·메모·문체·타임라인을 그대로 유지한 채 같은 조건으로 다시 생성한다.
    await requestDiary()
  }

  function handleStartOver() {
    photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // 무시 — 다음 저장 effect가 어차피 초기화된 상태로 다시 덮어쓴다.
    }

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
    setSplitCount(DEFAULT_SPLIT_COUNT)
    setPanoramaViewMode('connected')
    setActiveViewportIndex(0)
    setBackgroundColor(DEFAULT_BACKGROUND_COLOR)
    setBackgroundPattern('solid')
    setPatternColor(DEFAULT_PATTERN_COLOR)
    setDotSize(DEFAULT_DOT_SIZE)
    setDotShape('circle')
    setCheckSpacing(DEFAULT_CHECK_SPACING)
    setFont(DEFAULT_POSTER_FONT)
    setPolaroidCaptionSize(24)
    setBackgroundTextSize(40)
    setPhotoCaptions(null)
    setBackgroundCaptions(null)
    setPhotoStyles({})
  }

  const isDiaryPhase = step >= STEP.DIARY_INPUT
  const phaseLabel = isDiaryPhase ? '다이어리 만들기' : '타임라인 만들기'
  const phaseTotal = isDiaryPhase ? 2 : STEP.TIMELINE_RESULT
  const phaseCurrent = isDiaryPhase ? step - STEP.TIMELINE_RESULT : step

  return (
    <div className="notebook-page min-h-app px-4 py-6">
      <div className="notebook-spine-holes" />
      <div className="mx-auto w-full max-w-md pl-6">
        <header className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#2c2420]">Ticket to Tale</h1>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="tape-label text-[11px]">{phaseLabel}</span>
              <span className="flex items-center gap-1">
                {Array.from({ length: phaseTotal }).map((_, index) => (
                  <span key={index} className={`progress-dot ${index < phaseCurrent ? 'active' : ''}`} />
                ))}
              </span>
            </div>
          </div>
          {onBack && (
            <button type="button" onClick={onBack} className="mypage-back-tab px-3 py-1.5 text-xs">
              ← 허브로
            </button>
          )}
        </header>

        <div className="note-card-taped p-4 sm:p-6">
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
            splitCount={splitCount}
            onChangeSplitCount={setSplitCount}
            panoramaViewMode={panoramaViewMode}
            onChangePanoramaViewMode={setPanoramaViewMode}
            activeViewportIndex={activeViewportIndex}
            onChangeActiveViewportIndex={setActiveViewportIndex}
            backgroundColor={backgroundColor}
            onChangeBackgroundColor={setBackgroundColor}
            backgroundPattern={backgroundPattern}
            onChangeBackgroundPattern={setBackgroundPattern}
            patternColor={patternColor}
            onChangePatternColor={setPatternColor}
            dotSize={dotSize}
            onChangeDotSize={setDotSize}
            dotShape={dotShape}
            onChangeDotShape={setDotShape}
            checkSpacing={checkSpacing}
            onChangeCheckSpacing={setCheckSpacing}
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
    </div>
  )
}

export default TripPlannerPage
