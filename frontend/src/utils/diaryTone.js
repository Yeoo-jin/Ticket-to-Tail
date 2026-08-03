// backend/app/prompts/diary_prompt.py TONE_DESCRIPTIONS와 동일한 4개 문체.
export const DIARY_TONES = [
  { value: 'emotional', label: '감성적인', description: '감정과 여운을 담아 서정적으로' },
  { value: 'plain', label: '담백한', description: '꾸밈없이 사실 위주로 간결하게' },
  { value: 'cheerful', label: '유쾌한', description: '밝고 경쾌한 어조로' },
  { value: 'concise', label: '간결한', description: '짧고 명료하게 핵심만' },
]

export function diaryToneLabel(value) {
  return DIARY_TONES.find((tone) => tone.value === value)?.label || value
}
