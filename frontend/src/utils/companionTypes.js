// docs/api-spec.md의 companionTypes enum과 동일한 값을 사용한다. (최종 6개)
export const COMPANION_TYPES = [
  { value: 'solo', label: '혼자' },
  { value: 'friends_couple', label: '친구·연인' },
  { value: 'infant', label: '유아 동반' },
  { value: 'senior', label: '고령자 동반' },
  { value: 'mobility_impaired', label: '교통약자 동반' },
  { value: 'pet', label: '반려동물 동반' },
]

export function companionTypeLabel(value) {
  return COMPANION_TYPES.find((type) => type.value === value)?.label || value
}

export function companionTypeLabels(values) {
  return (values || []).map(companionTypeLabel)
}

const SOLO = 'solo'

// solo는 "동행인 없음"을 뜻하므로 다른 조건과 동시에 선택될 수 없다.
// solo를 고르면 나머지를 모두 해제하고, 다른 조건을 고르면 solo를 해제한다.
export function toggleCompanionSelection(current, value) {
  const isSelected = current.includes(value)

  if (isSelected) {
    return current.filter((type) => type !== value)
  }

  if (value === SOLO) {
    return [SOLO]
  }

  return [...current.filter((type) => type !== SOLO), value]
}
