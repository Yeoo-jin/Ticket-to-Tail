// master board(3240×1350) 좌표와 3개 viewport(1080×1350)로의 분할이 올바른지,
// 사진 수별 슬롯 배정이 중복 없이 이루어지는지 검사하는 순수 JS 검증 스크립트.
// 실행: node scripts/verify-panorama-board.mjs
import assert from 'node:assert/strict'
import { buildPanoramaFilename } from '../src/utils/panoramaExport.js'
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  MAX_PANORAMA_PHOTOS,
  PANORAMA_PRESETS,
  SEGMENT_WIDTH,
  SLOT_PLAN_BY_PHOTO_COUNT,
  VIEWPORT_COUNT,
  getPanoramaLayout,
  segmentsOverlappingRect,
} from '../src/utils/panoramaLayouts.js'

let passed = 0
function check(name, fn) {
  fn()
  passed += 1
  console.log(`PASS ${name}`)
}

check('board는 뷰포트 3개 × 1080만큼 정확히 3240 너비를 가진다', () => {
  assert.equal(BOARD_WIDTH, SEGMENT_WIDTH * VIEWPORT_COUNT)
  assert.equal(BOARD_WIDTH, 3240)
  assert.equal(BOARD_HEIGHT, 1350)
  assert.equal(SEGMENT_WIDTH, 1080)
})

check('3개 viewport 구간은 빈틈이나 겹침 없이 board 전체를 덮는다', () => {
  const ranges = Array.from({ length: VIEWPORT_COUNT }, (_, i) => [i * SEGMENT_WIDTH, (i + 1) * SEGMENT_WIDTH])
  assert.equal(ranges[0][0], 0)
  assert.equal(ranges[ranges.length - 1][1], BOARD_WIDTH)
  for (let i = 1; i < ranges.length; i += 1) {
    assert.equal(ranges[i][0], ranges[i - 1][1]) // 이전 구간의 끝 == 다음 구간의 시작
  }
})

for (const preset of PANORAMA_PRESETS) {
  for (let photoCount = 0; photoCount <= MAX_PANORAMA_PHOTOS; photoCount += 1) {
    check(`[${preset}] 사진 ${photoCount}장: 슬롯 수가 사진 수와 같고 사진 인덱스가 중복되지 않는다`, () => {
      const layout = getPanoramaLayout({ preset, photoCount })
      assert.equal(layout.photoSlots.length, photoCount)

      const usedIndexes = layout.photoSlots.map((slot) => slot.photoIndex)
      const uniqueIndexes = new Set(usedIndexes)
      assert.equal(uniqueIndexes.size, usedIndexes.length, '같은 사진이 두 번 이상 배정되면 안 된다')
      for (const index of usedIndexes) {
        assert.ok(index >= 0 && index < photoCount, `photoIndex(${index})는 0~${photoCount - 1} 범위여야 한다`)
      }
    })

    check(`[${preset}] 사진 ${photoCount}장: 모든 슬롯 rect가 board 범위 안에 있다`, () => {
      const layout = getPanoramaLayout({ preset, photoCount })
      for (const slot of layout.photoSlots) {
        assert.ok(slot.x >= 0, `${slot.slot}.x >= 0`)
        assert.ok(slot.y >= 0, `${slot.slot}.y >= 0`)
        assert.ok(slot.x + slot.w <= BOARD_WIDTH, `${slot.slot}는 board 너비를 벗어나면 안 된다`)
        assert.ok(slot.y + slot.h <= BOARD_HEIGHT, `${slot.slot}는 board 높이를 벗어나면 안 된다`)
      }
    })
  }
}

check('사진 개수별 슬롯 구성이 기획한 큰/작은 폴라로이드 개수와 일치한다', () => {
  assert.deepEqual(SLOT_PLAN_BY_PHOTO_COUNT[1], ['big1'])
  assert.deepEqual(SLOT_PLAN_BY_PHOTO_COUNT[2], ['big1', 'straddle'])
  assert.deepEqual(SLOT_PLAN_BY_PHOTO_COUNT[3], ['big1', 'straddle', 'small3'])
  assert.deepEqual(SLOT_PLAN_BY_PHOTO_COUNT[4], ['big1', 'big2', 'straddle', 'small3'])
  assert.deepEqual(SLOT_PLAN_BY_PHOTO_COUNT[5], ['big1', 'big2', 'straddle', 'small2b', 'small3'])

  const bigCount = (list) => list.filter((s) => s === 'big1' || s === 'big2').length
  const smallCount = (list) => list.length - bigCount(list)
  assert.equal(bigCount(SLOT_PLAN_BY_PHOTO_COUNT[1]), 1)
  assert.equal(bigCount(SLOT_PLAN_BY_PHOTO_COUNT[2]), 1)
  assert.equal(smallCount(SLOT_PLAN_BY_PHOTO_COUNT[2]), 1)
  assert.equal(bigCount(SLOT_PLAN_BY_PHOTO_COUNT[3]), 1)
  assert.equal(smallCount(SLOT_PLAN_BY_PHOTO_COUNT[3]), 2)
  assert.equal(bigCount(SLOT_PLAN_BY_PHOTO_COUNT[4]), 2)
  assert.equal(smallCount(SLOT_PLAN_BY_PHOTO_COUNT[4]), 2)
  assert.equal(bigCount(SLOT_PLAN_BY_PHOTO_COUNT[5]), 2)
  assert.equal(smallCount(SLOT_PLAN_BY_PHOTO_COUNT[5]), 3)
})

check('straddle 슬롯은 1·2번째 게시물 경계(1080)를 걸친다', () => {
  const { geometry } = getPanoramaLayout({ preset: 'polaroid_classic', photoCount: 2 })
  const segments = segmentsOverlappingRect(geometry.straddle.x, geometry.straddle.w)
  assert.deepEqual(segments, [0, 1])
})

check('small3 슬롯은 2·3번째 게시물 경계(2160)를 걸친다', () => {
  const { geometry } = getPanoramaLayout({ preset: 'polaroid_classic', photoCount: 3 })
  const segments = segmentsOverlappingRect(geometry.small3.x, geometry.small3.w)
  assert.deepEqual(segments, [1, 2])
})

check('big1/big2/small2b는 하나의 게시물 안에만 속한다(의도치 않은 걸침 없음)', () => {
  const { geometry } = getPanoramaLayout({ preset: 'polaroid_classic', photoCount: 5 })
  assert.deepEqual(segmentsOverlappingRect(geometry.big1.x, geometry.big1.w), [0])
  assert.deepEqual(segmentsOverlappingRect(geometry.big2.x, geometry.big2.w), [1])
  assert.deepEqual(segmentsOverlappingRect(geometry.small2b.x, geometry.small2b.w), [1])
})

check('세 프리셋은 같은 좌표(x/y/w/h)를 공유하고 회전·테이프만 다르다', () => {
  const classic = getPanoramaLayout({ preset: 'polaroid_classic', photoCount: 5 }).geometry
  const playful = getPanoramaLayout({ preset: 'polaroid_playful', photoCount: 5 }).geometry
  const minimal = getPanoramaLayout({ preset: 'polaroid_minimal', photoCount: 5 }).geometry

  for (const key of ['big1', 'big2', 'straddle', 'small2b', 'small3']) {
    assert.equal(classic[key].x, playful[key].x)
    assert.equal(classic[key].x, minimal[key].x)
    assert.equal(classic[key].y, playful[key].y)
    assert.equal(classic[key].w, playful[key].w)
    assert.equal(classic[key].h, playful[key].h)
  }

  // 프리셋 사이에서 실제로 달라지는 값(회전·테이프)은 최소 하나는 달라야 한다.
  assert.notEqual(classic.big1.rotation, minimal.big1.rotation)
  assert.notEqual(classic.straddle.tape, minimal.straddle.tape)
})

check('알 수 없는 preset은 기본 프리셋으로 대체된다', () => {
  const layout = getPanoramaLayout({ preset: 'not-a-real-preset', photoCount: 3 })
  assert.equal(layout.preset, 'polaroid_classic')
})

check('사진 5장을 넘겨도 최대 5장까지만 사용한다', () => {
  const layout = getPanoramaLayout({ preset: 'polaroid_classic', photoCount: 9 })
  assert.equal(layout.photoSlots.length, MAX_PANORAMA_PHOTOS)
})

check('내보내기 파일명은 01/02/03 두 자리 순번을 사용한다', () => {
  assert.equal(buildPanoramaFilename('부산', 0), 'ticket-to-tail-부산-01.png')
  assert.equal(buildPanoramaFilename('부산', 1), 'ticket-to-tail-부산-02.png')
  assert.equal(buildPanoramaFilename('부산', 2), 'ticket-to-tail-부산-03.png')
})

console.log(`\n${passed} checks passed.`)
