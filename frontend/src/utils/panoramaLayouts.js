// 폴라로이드 여행 캐러셀의 "master board" 좌표계.
// 보드는 항상 높이 1350, 너비는 사용자가 고른 분할 수(3 또는 4) × 1080이며,
// 여기 정의된 좌표는 이 보드 기준 절대 좌표(px)다.
export const SEGMENT_WIDTH = 1080
export const BOARD_HEIGHT = 1350

export const SPLIT_COUNTS = [3, 4]
export const DEFAULT_SPLIT_COUNT = 3

export const MAX_PANORAMA_PHOTOS = 5

export function resolveSplitCount(splitCount) {
  return SPLIT_COUNTS.includes(splitCount) ? splitCount : DEFAULT_SPLIT_COUNT
}

export function getBoardWidth(splitCount) {
  return SEGMENT_WIDTH * resolveSplitCount(splitCount)
}

// 게시물 사이 경계 x좌표들. 3분할이면 [1080, 2160], 4분할이면 [1080, 2160, 3240].
export function getBoundaries(splitCount) {
  const count = resolveSplitCount(splitCount)
  return Array.from({ length: count - 1 }, (_, i) => (i + 1) * SEGMENT_WIDTH)
}

const MARGIN = 70
const CONTENT_TOP = 170
const CONTENT_BOTTOM = 1220
const CONTENT_HEIGHT = CONTENT_BOTTOM - CONTENT_TOP

const PHOTO_ASPECT_RATIO = 4 / 5 // width / height
// 아래 여백에 최대 글자 크기(36px) 기준 2줄 메모가 들어가도 잘리지 않도록 여유 있게 잡는다.
const FRAME_PAD = 44 // 위·좌·우 여백
const FRAME_BOTTOM_PAD_RATIO = 2.5 // 아래 여백은 위쪽 여백의 약 2.5배(메모 2줄 포함)

// large/medium 두 단계만 사용한다. (640-520)/640 = 18.75% ≤ 25%(요구사항).
const LARGE_WIDTH = 640
const MEDIUM_WIDTH = 520

function buildFrameSize(frameWidth) {
  const photoWidth = frameWidth - FRAME_PAD * 2
  const photoHeight = photoWidth / PHOTO_ASPECT_RATIO
  const bottomPad = FRAME_PAD * FRAME_BOTTOM_PAD_RATIO
  const frameHeight = photoHeight + FRAME_PAD + bottomPad
  return { frameWidth, frameHeight, photoWidth, photoHeight }
}

const LARGE_SIZE = buildFrameSize(LARGE_WIDTH)
const MEDIUM_SIZE = buildFrameSize(MEDIUM_WIDTH)

// 사진 개수별 크기 구성(L=large, M=medium). 슬롯 수 = 사진 수이므로 중복 배정이 없다.
const COMPOSITION_BY_COUNT = {
  0: [],
  1: ['L'],
  2: ['L', 'M'],
  3: ['L', 'M', 'M'],
  4: ['L', 'L', 'M', 'M'],
  5: ['L', 'L', 'M', 'M', 'M'],
}

// -4~4도 사이에서 사진마다 조금씩 다른 회전을, y는 작은 편차를 결정론적으로 배정한다.
const ROTATION_TABLE = [-3, 2, -4, 3, -2]
const Y_JITTER_TABLE = [-30, 25, -35, 20, -15]

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function tapeFor(index) {
  // 테이프는 board 전체에서 최대 2개만 사용한다.
  if (index === 0) return 'top'
  if (index === 2) return 'corner'
  return 'none'
}

// medium 슬롯을 경계에 우선 배정하고, 남는 슬롯(large 전부 + 넘치는 medium)은
// board 전체에 걸쳐 균등 분산한다. 이렇게 하면 사진 수가 충분할 때는 실제 사진이
// 경계를 걸치고, board 너비(분할 수)가 바뀌면 x좌표 전체가 다시 분산된다.
function computeCenters(sizes, boardWidth, boundaries) {
  const centers = {}
  const mediumIndexes = sizes.map((s, i) => ({ s, i })).filter((o) => o.s === 'M').map((o) => o.i)

  mediumIndexes.forEach((slotIndex, order) => {
    if (order < boundaries.length) {
      centers[slotIndex] = boundaries[order]
    }
  })

  const unassigned = sizes.map((_, i) => i).filter((i) => !(i in centers))
  unassigned.forEach((slotIndex, order) => {
    const dims = sizes[slotIndex] === 'L' ? LARGE_SIZE : MEDIUM_SIZE
    const spanStart = MARGIN + dims.frameWidth / 2
    const spanEnd = boardWidth - MARGIN - dims.frameWidth / 2
    const t = unassigned.length === 1 ? 0.5 : order / (unassigned.length - 1)
    centers[slotIndex] = spanStart + (spanEnd - spanStart) * t
  })

  return centers
}

// splitCount·photoCount에 대해 각 사진의 board 절대 좌표(x/y/w/h/rotation/tape)를 계산한다.
export function getPanoramaLayout({ splitCount, photoCount }) {
  const resolvedSplit = resolveSplitCount(splitCount)
  const boardWidth = getBoardWidth(resolvedSplit)
  const boundaries = getBoundaries(resolvedSplit)
  const clampedCount = clamp(photoCount, 0, MAX_PANORAMA_PHOTOS)
  const sizes = COMPOSITION_BY_COUNT[clampedCount] || []

  const centers = computeCenters(sizes, boardWidth, boundaries)
  const baselineY = CONTENT_TOP + (CONTENT_HEIGHT - LARGE_SIZE.frameHeight) / 2

  const photoSlots = sizes.map((size, index) => {
    const dims = size === 'L' ? LARGE_SIZE : MEDIUM_SIZE
    const x = clamp(centers[index] - dims.frameWidth / 2, MARGIN, boardWidth - MARGIN - dims.frameWidth)
    const y = clamp(baselineY + (Y_JITTER_TABLE[index] || 0), CONTENT_TOP, CONTENT_BOTTOM - dims.frameHeight)
    return {
      photoIndex: index,
      size,
      x: Math.round(x),
      y: Math.round(y),
      w: dims.frameWidth,
      h: dims.frameHeight,
      photoW: dims.photoWidth,
      photoH: dims.photoHeight,
      framePad: FRAME_PAD,
      rotation: ROTATION_TABLE[index % ROTATION_TABLE.length],
      tape: tapeFor(index),
    }
  })

  return { splitCount: resolvedSplit, boardWidth, boundaries, photoSlots }
}

// 배경 위 독립 글귀 3개의 고정 위치 프리셋. 'bridge'는 항상 첫 번째 경계(x=1080)
// 위에 오도록 만들어, 사진 수와 무관하게 최소 1개의 요소는 항상 경계를 걸치게 한다.
export const BACKGROUND_CAPTION_PRESETS = [
  { id: 'top-left', label: '왼쪽 위', y: 60, textAlign: 'left', maxWidth: 520 },
  { id: 'bridge', label: '경계 위(다리)', y: 1255, textAlign: 'center', maxWidth: 460 },
  { id: 'bottom-right', label: '오른쪽 아래', y: 1255, textAlign: 'right', maxWidth: 520 },
]

// 각 글귀 요소는 `width: maxWidth`가 고정된 박스이고, 실제 화면 위치는
// `left: x` + `transform: translateX(0/-50%/-100%)`(정렬에 따라 결정)로 정해진다.
// x가 프리셋에만 의존하고 정렬(textAlign)과 무관하면, top-left/bottom-right처럼
// 캔버스 가장자리에 붙은 프리셋은 정렬을 바꿀 때 박스가 캔버스 밖으로 밀려나
// (예: top-left에서 '오른쪽' 선택 시 x=70에서 왼쪽으로 maxWidth만큼 이동)
// 위치 변경이 반영되지 않는 것처럼 보인다. 그래서 x 자체를 정렬에 따라
// "박스가 항상 같은 모서리 영역 안에 머무르도록" 다시 계산한다.
export function getBackgroundCaptionX(presetId, boardWidth, textAlign) {
  const preset = BACKGROUND_CAPTION_PRESETS.find((p) => p.id === presetId)
  const maxWidth = preset ? preset.maxWidth : 0

  if (presetId === 'top-left') {
    // 박스는 항상 [MARGIN, MARGIN+maxWidth] 영역(왼쪽 위 모서리)에 머무른다.
    if (textAlign === 'right') return MARGIN + maxWidth
    if (textAlign === 'center') return MARGIN + maxWidth / 2
    return MARGIN
  }
  if (presetId === 'bottom-right') {
    // 박스는 항상 [boardWidth-MARGIN-maxWidth, boardWidth-MARGIN] 영역(오른쪽 아래 모서리)에 머무른다.
    if (textAlign === 'left') return boardWidth - MARGIN - maxWidth
    if (textAlign === 'center') return boardWidth - MARGIN - maxWidth / 2
    return boardWidth - MARGIN
  }
  // 'bridge' - 항상 첫 번째 경계(1080) 주변에 머무른다.
  if (textAlign === 'left') return SEGMENT_WIDTH - maxWidth / 2
  if (textAlign === 'right') return SEGMENT_WIDTH + maxWidth / 2
  return SEGMENT_WIDTH
}

// 슬롯의 board 절대 좌표 rect가 어느 세그먼트(들)와 겹치는지 확인한다.
// 뷰포트 n은 [n*SEGMENT_WIDTH, (n+1)*SEGMENT_WIDTH) 구간을 담당한다.
export function segmentsOverlappingRect(x, width, splitCount) {
  const resolvedSplit = resolveSplitCount(splitCount)
  const segments = []
  for (let index = 0; index < resolvedSplit; index += 1) {
    const start = index * SEGMENT_WIDTH
    const end = start + SEGMENT_WIDTH
    if (x < end && x + width > start) {
      segments.push(index)
    }
  }
  return segments
}

export { CONTENT_BOTTOM, CONTENT_TOP, MARGIN }
