// 사진 꾸미기(간단 스타일)에 사용하는 순수 유틸. 원본 파일은 절대 수정하지 않고
// CSS filter/overlay로 표시 시에만 스타일을 적용한다.
export const PHOTO_FILTERS = ['original', 'warm', 'cool', 'film', 'monochrome']

export const PHOTO_FILTER_LABELS = {
  original: '원본',
  warm: '따뜻하게',
  cool: '시원하게',
  film: '필름',
  monochrome: '흑백',
}

export const PHOTO_FILTER_CSS = {
  original: 'none',
  warm: 'saturate(1.25) sepia(0.18) brightness(1.05)',
  cool: 'saturate(1.05) hue-rotate(-8deg) brightness(1.02) contrast(1.02)',
  film: 'contrast(1.08) saturate(0.9) brightness(0.98) sepia(0.12)',
  monochrome: 'grayscale(1) contrast(1.05)',
}

export const PHOTO_POSITIONS = ['top', 'center', 'bottom']

export const PHOTO_POSITION_LABELS = {
  top: '위',
  center: '가운데',
  bottom: '아래',
}

export const MIN_PHOTO_ZOOM = 1
export const MAX_PHOTO_ZOOM = 1.6

export const DEFAULT_PHOTO_STYLE = { filter: 'original', zoom: 1, position: 'center' }

export function getPhotoStyle(photoStyles, index) {
  return (photoStyles && photoStyles[index]) || DEFAULT_PHOTO_STYLE
}

export function setPhotoStyleField(photoStyles, index, field, value) {
  const current = getPhotoStyle(photoStyles, index)
  return { ...photoStyles, [index]: { ...current, [field]: value } }
}

export function photoObjectPosition(position) {
  if (position === 'top') return 'center top'
  if (position === 'bottom') return 'center bottom'
  return 'center center'
}

export function clampZoom(zoom) {
  const value = Number(zoom)
  if (Number.isNaN(value)) return MIN_PHOTO_ZOOM
  return Math.min(MAX_PHOTO_ZOOM, Math.max(MIN_PHOTO_ZOOM, value))
}

export function photoImageStyle(style) {
  const resolved = style || DEFAULT_PHOTO_STYLE
  return {
    filter: PHOTO_FILTER_CSS[resolved.filter] || PHOTO_FILTER_CSS.original,
    objectPosition: photoObjectPosition(resolved.position),
    transform: `scale(${clampZoom(resolved.zoom)})`,
  }
}
