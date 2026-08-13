import CustomPlaceInput from '../../components/CustomPlaceInput'
import ErrorMessage from '../../components/ErrorMessage'
import LoadingIndicator from '../../components/LoadingIndicator'
import PlaceCard from '../../components/PlaceCard'
import WeatherHint from '../../components/WeatherHint'
import { REQUIRED_DAILY_PLACE_COUNT } from '../../utils/placeSelection'

const PACE_OPTIONS = [
  { value: 'normal', label: '보통' },
  { value: 'relaxed', label: '여유롭게' },
]

function PlaceRecommendStep({
  dayLabel,
  destination,
  places,
  selectedPlaceIds,
  onToggleSelect,
  selectionLimitMessage,
  onAutoSelect,
  onRefresh,
  loading,
  error,
  onBack,
  isLastDay,
  pace,
  onChangePace,
  onNext,
  onGenerateTimeline,
  timelineLoading,
  timelineError,
  customPlaces,
  onAddCustomPlace,
  onRemoveCustomPlace,
  accommodation,
  onSetAccommodation,
  onRemoveAccommodation,
}) {
  const isEmptyResult = !loading && !error && places.length === 0
  const canProceed = selectedPlaceIds.length === REQUIRED_DAILY_PLACE_COUNT
  const customSelectedIds = selectedPlaceIds.filter((id) => customPlaces[id])
  const canAddMore = selectedPlaceIds.length < REQUIRED_DAILY_PLACE_COUNT

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900">📍 {dayLabel} 관광지 선택</h2>
      <p className="mt-1 text-xs text-gray-500">
        선택한 관광지 {selectedPlaceIds.length}/{REQUIRED_DAILY_PLACE_COUNT} · 정확히{' '}
        {REQUIRED_DAILY_PLACE_COUNT}개를 선택해야 다음으로 진행할 수 있어요.
      </p>
      <WeatherHint destination={destination} />

      <ErrorMessage message={error} />
      {selectionLimitMessage && <ErrorMessage message={selectionLimitMessage} />}

      {loading ? (
        <LoadingIndicator label="관광지를 추천받는 중..." />
      ) : isEmptyResult ? (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-600">
          해당 지역의 추천 데이터가 없습니다. 목적지를 다시 확인해 주세요.
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {places.map((place) => (
            <PlaceCard
              key={place.placeId}
              place={place}
              selected={selectedPlaceIds.includes(place.placeId)}
              onToggle={onToggleSelect}
            />
          ))}
        </div>
      )}

      <div className="mt-4">
        <p className="text-sm font-semibold text-gray-900">직접 입력한 장소</p>
        {customSelectedIds.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {customSelectedIds.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#1a1a1a] bg-[#f3ece2] px-3 py-1 text-xs text-[#1a1a1a]"
              >
                {customPlaces[id]?.name}
                <button type="button" onClick={() => onRemoveCustomPlace(id)} aria-label="직접 입력한 장소 삭제">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {canAddMore ? (
          <CustomPlaceInput placeholder="관광지 이름으로 검색하세요" onAdd={onAddCustomPlace} />
        ) : (
          <p className="mt-2 text-xs text-gray-400">
            이미 {REQUIRED_DAILY_PLACE_COUNT}개를 선택해서 더 추가할 수 없어요.
          </p>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={onAutoSelect}
          disabled={loading || isEmptyResult}
          className="w-full rounded-lg border border-[#1a1a1a] py-2.5 text-sm text-[#1a1a1a] disabled:opacity-40"
        >
          추천 관광지 자동 선택
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="w-full rounded-lg border border-gray-300 py-2.5 text-sm text-gray-700 disabled:opacity-40"
        >
          다른 관광지 추천받기
        </button>
        <p className="text-center text-[11px] text-gray-400">
          선택한 관광지는 유지하고, 나머지 후보만 새로 추천합니다.
        </p>
      </div>

      {isLastDay ? (
        <div className="mt-5 rounded-lg border border-gray-200 p-3">
          <p className="text-sm font-semibold text-gray-900">숙소 (선택)</p>
          <p className="mt-1 text-xs text-gray-500">
            입력하면 매일 마지막 일정 뒤 숙소로 이동하는 일정이 자동으로 추가돼요.
          </p>
          {accommodation ? (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#1a1a1a] bg-[#f3ece2] px-3 py-1 text-xs text-[#1a1a1a]">
              {accommodation.name}
              <button type="button" onClick={onRemoveAccommodation} aria-label="숙소 삭제">
                ×
              </button>
            </span>
          ) : (
            <CustomPlaceInput placeholder="숙소 이름으로 검색하세요" onAdd={onSetAccommodation} />
          )}

          <p className="mt-4 text-sm font-semibold text-gray-900">일정 여유</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {PACE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onChangePace(option.value)}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  pace === option.value ? 'border-[#1a1a1a] bg-[#f3ece2] text-[#1a1a1a]' : 'border-gray-300 text-gray-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <ErrorMessage message={timelineError} />

          <button
            type="button"
            onClick={onGenerateTimeline}
            disabled={timelineLoading || !canProceed}
            className="mt-3 w-full rounded-lg bg-[#1a1a1a] py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {timelineLoading ? '타임라인 생성 중...' : '타임라인 생성하기'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onNext}
          disabled={loading || !canProceed}
          className="mt-5 w-full rounded-lg bg-[#1a1a1a] py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          다음 날짜로
        </button>
      )}

      <button
        type="button"
        onClick={onBack}
        className="mt-3 w-full rounded-lg border border-gray-300 py-2.5 text-sm text-gray-700"
      >
        이전 (음식점 다시 선택)
      </button>
    </section>
  )
}

export default PlaceRecommendStep
