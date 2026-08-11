// 실제 이미지가 없을 때 카드에 표시할 카테고리별 아이콘 (플레이스홀더).
const CATEGORY_ICONS = {
  박물관: '🏛️',
  해변: '🏖️',
  문화마을: '🎨',
  전통시장: '🐟',
  공원: '🌳',
  자연경관: '⛰️',
  전망대: '🗼',
  수족관: '🐠',
  산책로: '🚶',
  미술관: '🖼️',
  카페: '☕',
  음식점: '🍽️',
}

export function categoryIcon(category) {
  return CATEGORY_ICONS[category] || '📍'
}
