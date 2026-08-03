// 포토 다이어리 배경색(자유 컬러 피커) 관련 순수 유틸.
// Hue 슬라이더 대신 실제 컬러판(input type="color")과 HEX 직접 입력을 사용하므로,
// 사용자가 고른 색을 파스텔로 강제 변환하지 않고 그대로 반영한다.
export const DEFAULT_BACKGROUND_COLOR = '#F7F2E8'

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/

export function isValidHexColor(value) {
  return typeof value === 'string' && HEX_PATTERN.test(value)
}

// "#f7f2e8" / "f7f2e8" 등 사용자가 입력할 수 있는 변형을 표준 "#RRGGBB" 대문자 형태로 정규화한다.
// 유효하지 않으면 null을 반환한다(호출 측에서 반영하지 않고 오류 안내만 표시해야 함).
export function normalizeHexColor(value) {
  if (!value) return null
  const trimmed = value.trim()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  return isValidHexColor(withHash) ? withHash.toUpperCase() : null
}

function hexToRgb(hex) {
  const value = hex.replace('#', '')
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  }
}

// WCAG 상대 휘도 근사치. 0(검정)~1(흰색).
export function relativeLuminance(hex) {
  const normalized = normalizeHexColor(hex) || DEFAULT_BACKGROUND_COLOR
  const { r, g, b } = hexToRgb(normalized)
  const channel = (c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

// 배경 명도에 따라 밝은 배경엔 짙은 회색, 어두운 배경엔 밝은 흰 계열 글자색을 고른다.
export function autoTextColor(hex) {
  return relativeLuminance(hex) > 0.5 ? '#3f3a33' : '#f7f2e8'
}
