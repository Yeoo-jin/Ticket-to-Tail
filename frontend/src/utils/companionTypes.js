// docs/api-spec.md의 companionTypes enum과 동일한 값을 사용한다.
export const COMPANION_TYPES = [
  { value: 'solo', label: '혼자' },
  { value: 'friends', label: '친구' },
  { value: 'couple', label: '연인' },
  { value: 'infant', label: '유아 동반' },
  { value: 'senior', label: '고령자 동반' },
  { value: 'mobility_impaired', label: '교통약자 동반' },
  { value: 'pet', label: '반려동물 동반' },
]

export function companionTypeLabel(value) {
  return COMPANION_TYPES.find((type) => type.value === value)?.label || value
}
