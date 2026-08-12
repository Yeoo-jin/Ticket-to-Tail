import CustomPlaceInput from '../../components/CustomPlaceInput'
import ErrorMessage from '../../components/ErrorMessage'
import LoadingIndicator from '../../components/LoadingIndicator'
import PlaceCard from '../../components/PlaceCard'

const MEAL_LABELS = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
}
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner']

function RestaurantRecommendStep({
  dayLabel,
  restaurantsForDay,
  selectedRestaurantIds,
  onToggleSelect,
  loading,
  error,
  onNext,
  onBack,
  customPlaces,
  onAddCustomRestaurant,
}) {
  const mealTypes = MEAL_ORDER.filter((mealType) => restaurantsForDay && mealType in restaurantsForDay)
  const isEmptyResult = !loading && !error && mealTypes.length === 0

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900">🍴 {dayLabel} 음식점 선택</h2>
      <p className="mt-1 text-xs text-gray-500">끼니마다 한 곳만 고를 수 있어요. 안 골라도 괜찮아요(선택 안 함).</p>

      <ErrorMessage message={error} />

      {loading ? (
        <LoadingIndicator label="음식점을 추천받는 중..." />
      ) : isEmptyResult ? (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-600">
          이 날짜에는 추천할 음식점이 없습니다. 선택하지 않고 다음으로 진행할 수 있어요.
        </div>
      ) : (
        mealTypes.map((mealType) => {
          const places = restaurantsForDay[mealType] || []
          const selectedId = selectedRestaurantIds?.[mealType]
          const selectedCustomName = selectedId ? customPlaces?.[selectedId]?.name : null

          return (
            <div key={mealType} className="mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">{MEAL_LABELS[mealType]}</p>
                <button
                  type="button"
                  onClick={() => onToggleSelect(mealType, null)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    !selectedId ? 'border-[#1a1a1a] bg-[#f3ece2] text-[#1a1a1a]' : 'border-gray-300 text-gray-500'
                  }`}
                >
                  선택 안 함
                </button>
              </div>

              {places.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {places.map((place) => (
                    <PlaceCard
                      key={place.placeId}
                      place={place}
                      selected={selectedId === place.placeId}
                      onToggle={(placeId) => onToggleSelect(mealType, placeId)}
                    />
                  ))}
                </div>
              )}

              {selectedCustomName && (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#1a1a1a] bg-[#f3ece2] px-3 py-1 text-xs text-[#1a1a1a]">
                  {selectedCustomName}
                  <button type="button" onClick={() => onToggleSelect(mealType, null)} aria-label="직접 입력한 식당 삭제">
                    ×
                  </button>
                </span>
              )}

              <CustomPlaceInput
                placeholder={`${MEAL_LABELS[mealType]} 식당 이름으로 검색하세요`}
                onAdd={(place) => onAddCustomRestaurant(mealType, place)}
              />
            </div>
          )
        })
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
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="w-full rounded-lg border border-gray-300 py-2.5 text-sm text-gray-700"
          >
            이전
          </button>
        )}
      </div>
    </section>
  )
}

export default RestaurantRecommendStep
