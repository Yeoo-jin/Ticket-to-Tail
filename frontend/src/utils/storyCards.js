// storyCards 관련 순수 유틸. 백엔드가 이미 photoIndexes 범위를 검증해 보내지만,
// 응답이 예상과 다를 가능성에 대비해 프론트에서도 한 번 더 방어적으로 걸러낸다.
export const STORY_CARD_TYPES = ['cover', 'single_photo', 'collage', 'quote', 'ending']
export const STORY_CARD_LAYOUT_VARIANTS = ['full-bleed', 'framed', 'split-2', 'asymmetric', 'text-only']

export function sanitizeStoryCards(storyCards, photoCount) {
  if (!Array.isArray(storyCards)) return []
  return storyCards.map((card, index) => ({
    id: card.id || `card-${index + 1}`,
    type: STORY_CARD_TYPES.includes(card.type) ? card.type : 'quote',
    photoIndexes: Array.isArray(card.photoIndexes)
      ? card.photoIndexes.filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < photoCount)
      : [],
    headline: card.headline || '',
    body: card.body || '',
    caption: card.caption || '',
    locationLabel: card.locationLabel || null,
    dateLabel: card.dateLabel || null,
    accentWords: Array.isArray(card.accentWords) ? card.accentWords.slice(0, 4) : [],
    layoutVariant: STORY_CARD_LAYOUT_VARIANTS.includes(card.layoutVariant) ? card.layoutVariant : 'text-only',
  }))
}

export function isMultiPhotoCard(card) {
  return Boolean(card && Array.isArray(card.photoIndexes) && card.photoIndexes.length > 1)
}

export function clampActiveCardIndex(index, cardCount) {
  if (cardCount <= 0) return 0
  if (!Number.isInteger(index)) return 0
  return Math.min(Math.max(index, 0), cardCount - 1)
}
