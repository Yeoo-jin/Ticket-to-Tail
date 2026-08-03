// 다이어리 결과 화면 테마. 테마 전환은 AI를 다시 호출하지 않고 같은 storyCards를
// 다른 CSS로 렌더링하는 방식으로만 처리한다.
export const DIARY_THEMES = ['film', 'scrapbook', 'magazine']
export const DEFAULT_DIARY_THEME = 'film'

export const DIARY_THEME_LABELS = {
  film: '필름',
  scrapbook: '스크랩북',
  magazine: '매거진',
}

export const DIARY_THEME_DESCRIPTIONS = {
  film: '필름 카메라 · 날짜 스탬프 느낌',
  scrapbook: '종이 · 테이프 · 스티커 콜라주 느낌',
  magazine: '깔끔한 여행 매거진 느낌',
}

export function diaryThemeLabel(value) {
  return DIARY_THEME_LABELS[value] || value
}

export function isValidDiaryTheme(value) {
  return DIARY_THEMES.includes(value)
}

export function resolveDiaryTheme(value) {
  return isValidDiaryTheme(value) ? value : DEFAULT_DIARY_THEME
}

// 테마별 카드 꾸밈 클래스 모음. StoryCardView가 이 값들을 조합해 렌더링한다.
export const THEME_CONFIG = {
  film: {
    pageBg: 'bg-neutral-950',
    cardBg: 'bg-neutral-900',
    cardBorder: 'border border-neutral-700',
    cardShadow: 'shadow-[0_10px_28px_rgba(0,0,0,0.55)]',
    photoFrame: 'dt-film-sprockets',
    photoRound: 'rounded-none',
    headlineFont: 'font-mono tracking-tight text-white',
    bodyFont: 'font-mono text-neutral-200',
    captionFont: 'font-mono text-neutral-300',
    badge: 'font-mono bg-amber-400 text-neutral-900 px-2 py-0.5 text-[10px] tracking-widest',
    accent: 'font-mono border border-amber-300 text-amber-300 px-1.5 py-0.5 text-[10px]',
    textOnlyBg: 'bg-neutral-900 text-neutral-100',
    scrim: 'bg-gradient-to-t from-black/85 via-black/25 to-transparent',
  },
  scrapbook: {
    pageBg: 'dt-scrapbook-page',
    cardBg: 'bg-[#fffaf0]',
    cardBorder: 'border border-[#e4d3ad]',
    cardShadow: 'shadow-[0_10px_18px_rgba(120,90,40,0.28)]',
    photoFrame: 'dt-polaroid',
    photoRound: 'rounded-sm',
    headlineFont: 'font-serif italic text-[#4a3826]',
    bodyFont: 'font-serif text-[#5b4636]',
    captionFont: 'font-serif italic text-[#7a5c3e]',
    badge: 'bg-rose-100 text-rose-700 px-2 py-0.5 text-[10px] rounded-full rotate-[-1deg]',
    accent: 'bg-yellow-100 text-yellow-800 px-1.5 py-0.5 text-[10px] rounded rotate-[-2deg] inline-block',
    textOnlyBg: 'bg-[#fffaf0] text-[#4a3826]',
    scrim: 'bg-gradient-to-t from-black/60 via-black/10 to-transparent',
  },
  magazine: {
    pageBg: 'bg-white',
    cardBg: 'bg-white',
    cardBorder: 'border border-gray-100',
    cardShadow: 'shadow-sm',
    photoFrame: '',
    photoRound: 'rounded-md',
    headlineFont: 'font-serif tracking-tight text-gray-900',
    bodyFont: 'font-sans text-gray-600',
    captionFont: 'font-sans text-gray-500',
    badge: 'uppercase tracking-[0.2em] text-[9px] text-gray-400 border border-gray-300 px-2 py-0.5',
    accent: 'uppercase tracking-widest text-[9px] text-gray-500 border-b border-gray-300 pb-0.5',
    textOnlyBg: 'bg-white text-gray-800',
    scrim: 'bg-gradient-to-t from-black/70 via-black/15 to-transparent',
  },
}
