import ErrorMessage from '../../components/ErrorMessage'
import LoadingIndicator from '../../components/LoadingIndicator'
import PlaceCard from '../../components/PlaceCard'

function PlaceRecommendStep({
  places,
  selectedPlaceIds,
  onToggleSelect,
  onSelectAll,
  onRefresh,
  loading,
  error,
  onBack,
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900">4. 관광지 후보 확인 및 선택</h2>
      <p className="mt-1 text-xs text-gray-500">
        선택한 관광지 {selectedPlaceIds.length}개 · 카드를 눌러 선택하거나 선택을 해제할 수 있어요.
      </p>

      <ErrorMessage message={error} />

      {loading ? (
        <LoadingIndicator label="관광지를 추천받는 중..." />
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
          onClick={onSelectAll}
          disabled={loading || places.length === 0}
          className="w-full rounded-lg border border-blue-300 py-2.5 text-sm text-blue-700 disabled:opacity-40"
        >
          AI 추천대로 전체 선택
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
          선택한 관광지는 그대로 유지되고, 선택하지 않은 카드만 새로운 후보로 교체됩니다.
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
