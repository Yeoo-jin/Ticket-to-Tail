import ErrorMessage from '../../components/ErrorMessage'
import LoadingIndicator from '../../components/LoadingIndicator'
import PlaceCard from '../../components/PlaceCard'
import { MAX_SELECTABLE_PLACES } from '../../utils/placeSelection'

const MEAL_LABELS = {
  lunch: '점심',
  dinner: '저녁',
}

function RestaurantRecommendStep({
  restaurants,
  selectedRestaurantIds,
  onToggleSelect,
  selectionLimitMessage,
  maxSelectable,
  loading,
  error,
  onNext,
  onBack,
}) {
  const mealBuckets = Object.entries(restaurants || {}).filter(([, places]) => places?.length > 0)
  const isEmptyResult = !loading && !error && mealBuckets.length === 0

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900">🍴 음식점 후보 확인 및 선택</h2>
      <p className="mt-1 text-xs text-gray-500">
        선택한 음식점 {selectedRestaurantIds.length}/{maxSelectable} · 관광지 선택과 개수를 나눠 씁니다(총{' '}
        {MAX_SELECTABLE_PLACES}개까지).
      </p>

      <ErrorMessage message={error} />
      {selectionLimitMessage && <ErrorMessage message={selectionLimitMessage} />}

      {loading ? (
        <LoadingIndicator label="음식점을 추천받는 중..." />
      ) : isEmptyResult ? (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-600">
          추천할 음식점 정보가 없습니다. 선택하지 않고 다음으로 진행할 수 있어요.
        </div>
      ) : (
        mealBuckets.map(([mealType, places]) => (
          <div key={mealType} className="mt-3">
            <p className="text-sm font-semibold text-gray-900">{MEAL_LABELS[mealType] || mealType}</p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {places.map((place) => (
                <PlaceCard
                  key={place.placeId}
                  place={place}
                  selected={selectedRestaurantIds.includes(place.placeId)}
                  onToggle={onToggleSelect}
                />
              ))}
            </div>
          </div>
        ))
      )}

      <div className="mt-5 space-y-2">
        <button
          type="button"
          onClick={onNext}
          disabled={loading}
          className="w-full rounded-lg bg-[#1a1a1a] py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          다음 (관광지 선택하기)
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full rounded-lg border border-gray-300 py-2.5 text-sm text-gray-700"
        >
          이전 (동행 조건 다시 선택)
        </button>
      </div>
    </section>
  )
}

export default RestaurantRecommendStep
