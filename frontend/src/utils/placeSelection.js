// 하루에 반드시 선택해야 하는 관광지 개수(요청사항: 관광지는 무조건 3개, 음식점과 슬롯을 나누지 않는다).
export const REQUIRED_DAILY_PLACE_COUNT = 3
export const SELECTION_LIMIT_MESSAGE = `관광지는 하루 ${REQUIRED_DAILY_PLACE_COUNT}개까지 선택할 수 있습니다.`

// 카드를 눌렀을 때의 다음 선택 상태를 계산한다.
// 이미 선택된 카드는 언제든 해제할 수 있고, 최대 개수를 넘어서려는 시도만 막는다.
export function toggleSelection(selectedIds, placeId, maxCount = REQUIRED_DAILY_PLACE_COUNT) {
  const isSelected = selectedIds.includes(placeId)

  if (isSelected) {
    return { selectedIds: selectedIds.filter((id) => id !== placeId), limitReached: false }
  }

  if (selectedIds.length >= maxCount) {
    return { selectedIds, limitReached: true }
  }

  return { selectedIds: [...selectedIds, placeId], limitReached: false }
}

// 백엔드가 계산해 응답에 담아준 autoSelectedPlaceIds를 그대로 적용한다.
// 프론트는 점수를 다시 계산하지 않고, 현재 화면에 실제로 있는 후보로만 한 번 더 제한한다.
export function resolveAutoSelection(autoSelectedPlaceIds, availablePlaceIds, maxCount = REQUIRED_DAILY_PLACE_COUNT) {
  const availableSet = new Set(availablePlaceIds)
  return (autoSelectedPlaceIds || []).filter((id) => availableSet.has(id)).slice(0, maxCount)
}

// 추천 후보 대신 직접 입력한 장소에 붙이는 임시 ID. places.json의 실제 placeId와
// 겹치지 않도록 "custom-" 접두사를 쓴다.
export function generateCustomPlaceId() {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

// 끼니(아침/점심/저녁)마다 음식점을 최대 1곳만 선택할 수 있다(라디오 방식) + "선택 안 함" 허용.
// current: { [mealType]: placeId }. 이미 그 끼니에 같은 곳이 선택돼 있으면 선택 해제("선택 안 함")로 토글한다.
export function toggleRestaurantSelection(current, mealType, placeId) {
  const next = { ...current }
  if (next[mealType] === placeId) {
    delete next[mealType]
  } else {
    next[mealType] = placeId
  }
  return next
}
