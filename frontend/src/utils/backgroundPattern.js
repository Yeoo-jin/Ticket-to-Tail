// 포토 다이어리 배경 패턴(단색/도트/체크) 관련 순수 유틸.
// 배경색(backgroundColor)은 그대로 유지하고, 그 위에 얹는 패턴 레이어의 스타일만 계산한다.
import { hexToRgba, normalizeHexColor } from './backgroundColor'

export const BACKGROUND_PATTERNS = ['solid', 'dot', 'check']

export const BACKGROUND_PATTERN_LABELS = {
  solid: '단색',
  dot: '도트',
  check: '체크',
}

// 기본 배경색(#F7F2E8, 크림색)과 무난하게 어울리는 따뜻한 갈색 계열 기본 패턴색.
export const DEFAULT_PATTERN_COLOR = '#9C8F7A'

export const DOT_SHAPES = ['circle', 'square']

export const DOT_SHAPE_LABELS = {
  circle: '동그라미',
  square: '정사각형',
}

// 도트 사이 간격(중심 간 거리)은 고정하고, 도트 "크기"만 사용자가 조절한다.
const DOT_SPACING = 90
export const MIN_DOT_SIZE = 3
export const MAX_DOT_SIZE = 18
export const DEFAULT_DOT_SIZE = 7

export const MIN_CHECK_SPACING = 24
export const MAX_CHECK_SPACING = 120
export const DEFAULT_CHECK_SPACING = 68

export function clampDotSize(value) {
  const number = Number(value)
  if (Number.isNaN(number)) return DEFAULT_DOT_SIZE
  return Math.min(MAX_DOT_SIZE, Math.max(MIN_DOT_SIZE, number))
}

export function clampCheckSpacing(value) {
  const number = Number(value)
  if (Number.isNaN(number)) return DEFAULT_CHECK_SPACING
  return Math.min(MAX_CHECK_SPACING, Math.max(MIN_CHECK_SPACING, number))
}

// 정사각형 도트 배경을 SVG 타일로 그린다. 타일이 속한 레이어 전체가 바깥(PanoramaDiary)에서
// 45도 회전되므로, 타일 안의 정사각형은 미리 반대 방향(-45도)으로 돌려 넣어 두 회전이 상쇄되게
// 한다. 그 결과 타일의 "배치(격자)"는 바깥 회전을 그대로 따라 대각선으로 늘어서지만, 각 도형은
// 항상 가로·세로로 곧게 선 정사각형으로 보인다(마름모로 보이지 않음).
function squareDotTileBackground(color, size, spacing) {
  const center = spacing / 2
  const offset = center - size / 2
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${spacing}" height="${spacing}">` +
    `<g transform="rotate(-45 ${center} ${center})">` +
    `<rect x="${offset}" y="${offset}" width="${size}" height="${size}" fill="${color}"/>` +
    `</g>` +
    `</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

// 패턴 레이어를 통째로 몇 도 회전해서 그릴지. 도트(동그라미·정사각형 모두)는 참고 이미지처럼
// 격자가 대각선으로 늘어서 보이도록 45도 회전하고, 체크는 가로·세로 줄무늬 그대로 회전 없이
// 사용한다. 정사각형 도트는 도형 자체가 다이아몬드로 보이지 않도록 타일 안에서 미리 반대로
// 돌려 둔다(squareDotTileBackground 참고).
export function backgroundPatternRotation(pattern) {
  return pattern === 'dot' ? 45 : 0
}

// 배경 보드 위에 얹는 패턴 레이어 자체의 CSS 스타일을 반환한다(회전은 별도 래퍼가 담당하므로
// 여기서는 backgroundImage/Size만 계산). solid면 추가 레이어가 없으므로 빈 객체를 반환해
// 기존 단색 배경과 동일하게 보인다.
//
// options.dotSize: 도트 크기(원 반지름 / 정사각형 한 변, px)
// options.dotShape: 'circle' | 'square'
// options.checkSpacing: 체크 줄 사이 간격(px)
export function backgroundPatternStyle(pattern, patternColor, options = {}) {
  const color = normalizeHexColor(patternColor) || DEFAULT_PATTERN_COLOR

  if (pattern === 'dot') {
    const size = clampDotSize(options.dotSize ?? DEFAULT_DOT_SIZE)

    if (options.dotShape === 'square') {
      return {
        backgroundImage: squareDotTileBackground(hexToRgba(color, 0.6), size, DOT_SPACING),
        backgroundSize: `${DOT_SPACING}px ${DOT_SPACING}px`,
      }
    }

    return {
      backgroundImage: `radial-gradient(${hexToRgba(color, 0.6)} ${size}px, transparent ${size + 0.5}px)`,
      backgroundSize: `${DOT_SPACING}px ${DOT_SPACING}px`,
    }
  }

  if (pattern === 'check') {
    const stripe = clampCheckSpacing(options.checkSpacing ?? DEFAULT_CHECK_SPACING)
    const half = stripe / 2
    const line = hexToRgba(color, 0.35)
    return {
      // 가로줄과 세로줄을 같은 요소의 배경색 위에 겹쳐 그리고 background-blend-mode로
      // 곱연산(multiply)해, 두 줄이 교차하는 칸만 더 짙어지는 체크(깅엄) 무늬를 만든다.
      backgroundImage: [
        `repeating-linear-gradient(0deg, ${line} 0px, ${line} ${half}px, transparent ${half}px, transparent ${stripe}px)`,
        `repeating-linear-gradient(90deg, ${line} 0px, ${line} ${half}px, transparent ${half}px, transparent ${stripe}px)`,
      ].join(', '),
      backgroundSize: `${stripe}px ${stripe}px`,
      backgroundBlendMode: 'multiply',
    }
  }

  return {}
}
