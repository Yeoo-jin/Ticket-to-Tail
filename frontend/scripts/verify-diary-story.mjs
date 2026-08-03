// storyCards/테마/사진 스타일/내보내기 파일명 관련 순수 유틸을 별도 테스트 러너 없이
// Node로 직접 검증한다. 실행: node scripts/verify-diary-story.mjs
import assert from 'node:assert/strict'
import { DEFAULT_DIARY_THEME, DIARY_THEMES, isValidDiaryTheme, resolveDiaryTheme } from '../src/utils/diaryTheme.js'
import { buildExportFilename } from '../src/utils/imageExport.js'
import {
  DEFAULT_PHOTO_STYLE,
  clampZoom,
  getPhotoStyle,
  photoObjectPosition,
  setPhotoStyleField,
} from '../src/utils/photoStyle.js'
import { clampActiveCardIndex, isMultiPhotoCard, sanitizeStoryCards } from '../src/utils/storyCards.js'

let passed = 0
function check(name, fn) {
  fn()
  passed += 1
  console.log(`PASS ${name}`)
}

// --- diaryTheme ---
check('기본 테마는 film이다', () => {
  assert.equal(DEFAULT_DIARY_THEME, 'film')
  assert.ok(DIARY_THEMES.includes('film'))
})

check('알 수 없는 테마는 기본값으로 대체된다', () => {
  assert.equal(isValidDiaryTheme('vaporwave'), false)
  assert.equal(resolveDiaryTheme('vaporwave'), DEFAULT_DIARY_THEME)
  assert.equal(resolveDiaryTheme('scrapbook'), 'scrapbook')
})

// --- storyCards ---
check('photoIndexes가 사진 범위를 벗어나면 걸러진다', () => {
  const cards = [
    { id: 'a', type: 'single_photo', photoIndexes: [0, 5, -1, 2], headline: 'h', body: 'b', layoutVariant: 'framed' },
  ]
  const sanitized = sanitizeStoryCards(cards, 3)
  assert.deepEqual(sanitized[0].photoIndexes, [0, 2])
})

check('잘못된 type/layoutVariant는 안전한 기본값으로 대체된다', () => {
  const cards = [{ id: 'a', type: 'bogus', photoIndexes: [], headline: 'h', body: 'b', layoutVariant: 'bogus' }]
  const sanitized = sanitizeStoryCards(cards, 0)
  assert.equal(sanitized[0].type, 'quote')
  assert.equal(sanitized[0].layoutVariant, 'text-only')
})

check('accentWords는 최대 4개로 제한된다', () => {
  const cards = [
    {
      id: 'a',
      type: 'cover',
      photoIndexes: [],
      headline: 'h',
      body: 'b',
      layoutVariant: 'full-bleed',
      accentWords: ['a', 'b', 'c', 'd', 'e'],
    },
  ]
  const sanitized = sanitizeStoryCards(cards, 0)
  assert.equal(sanitized[0].accentWords.length, 4)
})

check('storyCards가 배열이 아니면 빈 배열을 반환한다', () => {
  assert.deepEqual(sanitizeStoryCards(null, 3), [])
  assert.deepEqual(sanitizeStoryCards(undefined, 3), [])
})

check('사진이 2장 이상인 카드만 collage로 간주한다', () => {
  assert.equal(isMultiPhotoCard({ photoIndexes: [0, 1] }), true)
  assert.equal(isMultiPhotoCard({ photoIndexes: [0] }), false)
  assert.equal(isMultiPhotoCard({ photoIndexes: [] }), false)
})

check('activeCardIndex는 카드 개수 범위로 clamp된다', () => {
  assert.equal(clampActiveCardIndex(10, 3), 2)
  assert.equal(clampActiveCardIndex(-1, 3), 0)
  assert.equal(clampActiveCardIndex(1, 0), 0)
})

// --- photoStyle ---
check('사진 스타일이 없으면 기본 스타일을 반환한다', () => {
  assert.deepEqual(getPhotoStyle({}, 0), DEFAULT_PHOTO_STYLE)
})

check('특정 사진의 스타일만 변경된다', () => {
  const updated = setPhotoStyleField({}, 1, 'filter', 'warm')
  assert.equal(updated[1].filter, 'warm')
  assert.equal(getPhotoStyle(updated, 0).filter, 'original')
})

check('확대 비율은 1~1.6 범위로 clamp된다', () => {
  assert.equal(clampZoom(0.5), 1)
  assert.equal(clampZoom(3), 1.6)
  assert.equal(clampZoom('1.2'), 1.2)
  assert.equal(clampZoom('abc'), 1)
})

check('표시 위치는 CSS object-position 값으로 매핑된다', () => {
  assert.equal(photoObjectPosition('top'), 'center top')
  assert.equal(photoObjectPosition('bottom'), 'center bottom')
  assert.equal(photoObjectPosition('center'), 'center center')
})

// --- imageExport ---
check('내보내기 파일명은 ticket-to-tail-{destination}-{cardIndex}.png 형식이다', () => {
  assert.equal(buildExportFilename('부산', 0), 'ticket-to-tail-부산-1.png')
  assert.equal(buildExportFilename('Seoul Trip', 2), 'ticket-to-tail-SeoulTrip-3.png')
})

check('목적지가 없어도 안전한 기본 파일명을 만든다', () => {
  assert.equal(buildExportFilename('', 0), 'ticket-to-tail-여행-1.png')
  assert.equal(buildExportFilename('!!!', 0), 'ticket-to-tail-여행-1.png')
})

console.log(`\n${passed} checks passed.`)
