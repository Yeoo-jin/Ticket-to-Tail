import ErrorMessage from '../../components/ErrorMessage'
import LoadingIndicator from '../../components/LoadingIndicator'
import PlaceCard from '../../components/PlaceCard'
import { MAX_SELECTABLE_PLACES } from '../../utils/placeSelection'

function PlaceRecommendStep({
  places,
  selectedPlaceIds,
  onToggleSelect,
  selectionLimitMessage,
  onAutoSelect,
  onRefresh,
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
