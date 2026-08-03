import ErrorMessage from '../../components/ErrorMessage'
import LoadingIndicator from '../../components/LoadingIndicator'
import PlaceCard from '../../components/PlaceCard'
import { MAX_SELECTABLE_PLACES } from '../../utils/placeSelection'

const PACE_OPTIONS = [
  { value: 'normal', label: '보통' },
  { value: 'relaxed', label: '여유롭게' },
]

function PlaceRecommendStep({
  places,
  selectedPlaceIds,
  onToggleSelect,
  selectionLimitMessage,
  onAutoSelect,
  onRefresh,
  pace,
  onChangePace,
  onGenerateTimeline,
  timelineLoading,
  timelineError,
  loading,
  error,
  onBack,
}) {
  const isEmptyResult = !loading && !error && places.length === 0

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900">4. 관광지 후보 확인 및 선택</h2>
      <p className="mt-1 text-xs text-gray-500">
        선택한 관광지 {selectedPlaceIds.length}/{MAX_SELECTABLE_PLACES} · 카드를 눌러 선택하거나 선택을 해제할 수
        있어요.
      </p>

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

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={onAutoSelect}
          disabled={loading || isEmptyResult}
          className="w-full rounded-lg border border-blue-300 py-2.5 text-sm text-blue-700 disabled:opacity-40"
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

      <div className="mt-5 rounded-lg border border-gray-200 p-3">
        <p className="text-sm font-semibold text-gray-900">일정 여유</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {PACE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChangePace(option.value)}
              className={`rounded-lg border px-3 py-2 text-sm ${
                pace === option.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'
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
          disabled={timelineLoading || selectedPlaceIds.length === 0}
          className="mt-3 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {timelineLoading ? '타임라인 생성 중...' : '타임라인 생성하기'}
        </button>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="mt-3 w-full rounded-lg border border-gray-300 py-2.5 text-sm text-gray-700"
      >
        이전 (동행 조건 다시 선택)
      </button>
    </section>
  )
}

export default PlaceRecommendStep
