export const MAX_SELECTABLE_PLACES = 3
export const SELECTION_LIMIT_MESSAGE = '관광지는 최대 3개까지 선택할 수 있습니다.'

// 카드를 눌렀을 때의 다음 선택 상태를 계산한다.
// 이미 선택된 카드는 언제든 해제할 수 있고, 최대 개수를 넘어서려는 시도만 막는다.
export function toggleSelection(selectedIds, placeId, maxCount = MAX_SELECTABLE_PLACES) {
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
export function resolveAutoSelection(autoSelectedPlaceIds, availablePlaceIds, maxCount = MAX_SELECTABLE_PLACES) {
  const availableSet = new Set(availablePlaceIds)
  return (autoSelectedPlaceIds || []).filter((id) => availableSet.has(id)).slice(0, maxCount)
}
