// 폴라로이드 여행 캐러셀의 "master board" 좌표계와 레이아웃 프리셋.
// 보드는 항상 3240×1350(가로 1080짜리 게시물 3장이 이어진 크기)이며,
// 여기 정의된 좌표는 이 보드 기준 절대 좌표(px)다.
export const BOARD_WIDTH = 3240
export const BOARD_HEIGHT = 1350
export const SEGMENT_WIDTH = 1080
export const VIEWPORT_COUNT = 3

export const PANORAMA_PRESETS = ['polaroid_classic', 'polaroid_playful', 'polaroid_minimal']
export const DEFAULT_PANORAMA_PRESET = 'polaroid_classic'

export const PANORAMA_PRESET_LABELS = {
  polaroid_classic: '클래식',
  polaroid_playful: '플레이풀',
  polaroid_minimal: '미니멀',
}

export const MAX_PANORAMA_PHOTOS = 5

// 사진 개수별로 어떤 슬롯에 몇 번째 사진(0부터)을 배치할지 결정한다.
// 슬롯 개수가 곧 사용하는 사진 개수이므로 같은 사진이 두 번 배정되지 않는다.
// big1/big2: 큰 대표 폴라로이드, straddle/small3: 1·2번째 경계와 2·3번째 경계를 걸치는 작은 폴라로이드,
// small2b: 5장일 때만 쓰는 2번째 게시물 안의 추가 작은 폴라로이드.
export const SLOT_PLAN_BY_PHOTO_COUNT = {
  0: [],
  1: ['big1'],
  2: ['big1', 'straddle'],
  3: ['big1', 'straddle', 'small3'],
  4: ['big1', 'big2', 'straddle', 'small3'],
  5: ['big1', 'big2', 'straddle', 'small2b', 'small3'],
}

// 캡션을 붙일 수 있는 슬롯의 우선순위(최대 2개까지만 사용).
export const CAPTION_SLOT_PRIORITY = ['big2', 'small3', 'straddle']

// 기준(classic) 좌표. 다른 프리셋은 이 좌표를 그대로 재사용하고 회전 각도·테이프
// 스타일만 다르게 적용한다 - 위치가 프리셋마다 달라 경계선을 벗어나는 사고를 막기 위함이다.
const BASE_GEOMETRY = {
  big1: { x: 110, y: 140, w: 760, h: 950, rotation: -2, tape: 'top' },
  big2: { x: 1340, y: 150, w: 700, h: 880, rotation: 1.5, tape: 'top' },
  // 1080 경계(1번·2번 게시물 사이)를 걸치도록 의도적으로 960~1190에 배치.
  straddle: { x: 960, y: 520, w: 230, h: 290, rotation: 5, tape: 'corner' },
  small2b: { x: 1850, y: 1060, w: 210, h: 260, rotation: -3, tape: 'corner' },
  // 2160 경계(2번·3번 게시물 사이)를 걸치도록 의도적으로 2080~2310에 배치.
  small3: { x: 2080, y: 430, w: 230, h: 290, rotation: -4, tape: 'top' },
  locationLabel: { x: 70, y: 55, w: 340 },
  titleLine: { x: 1150, y: 60, w: 760 },
  ending: { x: 2350, y: 1120, w: 560 },
  sticker1: { x: 900, y: 260, emoji: '✈️' },
  sticker2: { x: 2900, y: 260, emoji: '🌿' },
}

function scaleRotation(geometry, rotationScale) {
  const scaled = {}
  for (const [key, value] of Object.entries(geometry)) {
    scaled[key] = 'rotation' in value
      ? { ...value, rotation: Math.round(value.rotation * rotationScale * 10) / 10 }
      : { ...value }
  }
  return scaled
}

function withTape(geometry, tapeVariant) {
  const result = {}
  for (const [key, value] of Object.entries(geometry)) {
    result[key] = 'tape' in value ? { ...value, tape: tapeVariant } : { ...value }
  }
  return result
}

// 세 프리셋 모두 동일한 좌표(BASE_GEOMETRY)를 공유해 3장 연결 구조와 경계 겹침이
// 항상 성립하도록 하고, 회전 각도·테이프 스타일·스티커 개수만 다르게 준다.
export const PRESET_GEOMETRY = {
  polaroid_classic: BASE_GEOMETRY,
  polaroid_playful: withTape(scaleRotation(BASE_GEOMETRY, 1.6), 'washi'),
  polaroid_minimal: withTape(scaleRotation(BASE_GEOMETRY, 0.2), 'none'),
}

export const PRESET_STYLE = {
  polaroid_classic: { stickerCount: 1 },
  polaroid_playful: { stickerCount: 2 },
  polaroid_minimal: { stickerCount: 0 },
}

export function resolvePanoramaPreset(preset) {
  return PANORAMA_PRESETS.includes(preset) ? preset : DEFAULT_PANORAMA_PRESET
}

// preset·photoCount에 대해 어떤 사진이 어떤 슬롯(좌표)에 들어가는지 계산한다.
// photoCount는 0~5로 clamp되며, 5장을 넘는 사진은 사용하지 않는다(MAX_PANORAMA_PHOTOS).
export function getPanoramaLayout({ preset, photoCount }) {
  const resolvedPreset = resolvePanoramaPreset(preset)
  const geometry = PRESET_GEOMETRY[resolvedPreset]
  const clampedCount = Math.max(0, Math.min(photoCount, MAX_PANORAMA_PHOTOS))
  const slotNames = SLOT_PLAN_BY_PHOTO_COUNT[clampedCount] || []

  const photoSlots = slotNames.map((slot, photoIndex) => ({
    slot,
    photoIndex,
    ...geometry[slot],
  }))

  return {
    preset: resolvedPreset,
    geometry,
    style: PRESET_STYLE[resolvedPreset],
    photoSlots,
  }
}

// 슬롯의 board 절대 좌표 rect가 세그먼트 인덱스(0/1/2)의 뷰포트와 겹치는지 확인한다.
// 뷰포트 n은 [n*SEGMENT_WIDTH, (n+1)*SEGMENT_WIDTH) 구간을 담당한다.
export function segmentsOverlappingRect(x, width) {
  const segments = []
  for (let index = 0; index < VIEWPORT_COUNT; index += 1) {
    const start = index * SEGMENT_WIDTH
    const end = start + SEGMENT_WIDTH
    if (x < end && x + width > start) {
      segments.push(index)
    }
  }
  return segments
}
