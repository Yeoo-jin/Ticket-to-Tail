// 포토 다이어리 보드에 표시할 문구를 "사용자가 직접 쓴 메모"에서만 가져오는 순수 유틸.
// AI가 만든 headline/accentWords는 보드 문구로 사용하지 않는다.
// 폴라로이드 아래 글귀는 photoMemo만 사용하고(diaryMemo로 자동 대체하지 않음), diaryMemo는
// 대신 buildDefaultBackgroundCaptions를 통해 배경 글귀의 기본값으로만 쓰인다.
import { BACKGROUND_CAPTION_PRESETS } from './panoramaLayouts.js'

// 마침표/느낌표/물음표/줄바꿈 기준으로 문장을 나눈다. 빈 문장은 버린다.
export function splitIntoSentences(text) {
  if (!text) return []
  return text
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

// 긴 문구를 단어 경계에서 잘라 말줄임표를 붙인다. 사용자의 문장 의미 자체는 바꾸지 않고
// 표시 길이만 제한한다.
export function truncateAtWordBoundary(text, maxChars) {
  if (!text) return ''
  if (text.length <= maxChars) return text
  const slice = text.slice(0, maxChars)
  const lastSpace = slice.lastIndexOf(' ')
  const cut = lastSpace > maxChars * 0.4 ? slice.slice(0, lastSpace) : slice
  return `${cut.trim()}…`
}

// 배경 위 독립 글귀 3개의 초기값을 만든다.
// 우선순위: 1. diaryMemo를 문장 단위로 나눈 것 2. destination 3. 날짜 라벨.
// 가장 먼저 나온 후보(대개 diaryMemo 첫 문장)를 항상 경계를 걸치는 'bridge' 위치에 배정해,
// 사진 수와 무관하게 최소 1개의 요소가 항상 게시물 경계를 걸치도록 한다.
export function buildDefaultBackgroundCaptions({ diaryMemo = '', destination = '', dateLabel = '' }) {
  const candidates = [...splitIntoSentences(diaryMemo), destination, dateLabel].filter(
    (text) => text && text.trim()
  )
  const textByPresetId = {
    bridge: candidates[0] || '',
    'top-left': candidates[1] || '',
    'bottom-right': candidates[2] || '',
  }
  return BACKGROUND_CAPTION_PRESETS.map((preset) => ({
    presetId: preset.id,
    text: textByPresetId[preset.id] || '',
    textAlign: preset.textAlign,
    visible: Boolean(textByPresetId[preset.id]),
  }))
}
