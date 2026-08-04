// 사진 스타일/내보내기 파일명 관련 순수 유틸을 별도 테스트 러너 없이 Node로 직접 검증한다.
// (블로그 보기 제거로 storyCards/diaryTheme 관련 검증은 verify-panorama-board.mjs로 통합·정리됨)
// 실행: node scripts/verify-diary-story.mjs
import assert from 'node:assert/strict'
import { buildExportFilename } from '../src/utils/imageExport.js'
import {
  DEFAULT_PHOTO_STYLE,
  clampZoom,
  getPhotoStyle,
  photoObjectPosition,
  setPhotoStyleField,
} from '../src/utils/photoStyle.js'

let passed = 0
function check(name, fn) {
  fn()
  passed += 1
  console.log(`PASS ${name}`)
}

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
