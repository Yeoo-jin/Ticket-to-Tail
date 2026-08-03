// 포토 다이어리 포스터의 제목·메모에만 적용하는 폰트 선택지.
// 앱 전체 UI 폰트는 건드리지 않고, 포스터 텍스트 요소에만 style로 지정해 사용한다.
export const POSTER_FONTS = ['clean', 'handwriting', 'serif', 'rounded']
export const DEFAULT_POSTER_FONT = 'clean'

export const POSTER_FONT_LABELS = {
  clean: '깔끔하게',
  handwriting: '손글씨',
  serif: '감성 명조',
  rounded: '둥글게',
}

// 한글을 지원하는 오픈소스 폰트(@fontsource) + 시스템 fallback 순서.
// 폰트 로딩이 실패해도 Noto Sans KR/Malgun Gothic/Apple SD Gothic Neo로 자연스럽게 대체된다.
export const POSTER_FONT_STACKS = {
  clean: "'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
  handwriting: "'Gaegu', 'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
  serif: "'Noto Serif KR', 'Malgun Gothic', 'Apple SD Gothic Neo', serif",
  rounded: "'Gowun Dodum', 'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
}

export function resolvePosterFont(font) {
  return POSTER_FONTS.includes(font) ? font : DEFAULT_POSTER_FONT
}

export function posterFontStack(font) {
  return POSTER_FONT_STACKS[resolvePosterFont(font)]
}
