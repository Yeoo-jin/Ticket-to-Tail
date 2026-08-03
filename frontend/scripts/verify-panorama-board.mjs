// master board(3240×1350 또는 4320×1350) 좌표, 3/4분할 viewport 잘림, 경계 걸침,
// 배경 글귀 기본값, HEX 색상 처리를 검사하는 순수 JS 검증 스크립트.
// 실행: node scripts/verify-panorama-board.mjs
import assert from 'node:assert/strict'
import {
  DEFAULT_BACKGROUND_COLOR,
  autoTextColor,
  isValidHexColor,
  normalizeHexColor,
  relativeLuminance,
} from '../src/utils/backgroundColor.js'
import { buildDefaultBackgroundCaptions } from '../src/utils/memoDistribution.js'
import { buildFullBoardFilename, buildPanoramaFilename } from '../src/utils/panoramaExport.js'
import {
  BACKGROUND_CAPTION_PRESETS,
  BOARD_HEIGHT,
  MAX_PANORAMA_PHOTOS,
  SEGMENT_WIDTH,
  SPLIT_COUNTS,
  getBackgroundCaptionX,
  getBoardWidth,
  getBoundaries,
  getPanoramaLayout,
  resolveSplitCount,
  segmentsOverlappingRect,
} from '../src/utils/panoramaLayouts.js'

let passed = 0
function check(name, fn) {
  fn()
  passed += 1
  console.log(`PASS ${name}`)
}

// ---------------------------------------------------------------------------
// master board 크기: 3분할 3240×1350, 4분할 4320×1350
// ---------------------------------------------------------------------------

check('보드 높이는 항상 1350으로 고정된다', () => {
  assert.equal(BOARD_HEIGHT, 1350)
})

check('3분할 board는 3240, 4분할 board는 4320이다', () => {
  assert.equal(getBoardWidth(3), 3240)
  assert.equal(getBoardWidth(4), 4320)
  assert.equal(getBoardWidth(3), SEGMENT_WIDTH * 3)
  assert.equal(getBoardWidth(4), SEGMENT_WIDTH * 4)
})

check('경계 좌표는 3분할 [1080,2160], 4분할 [1080,2160,3240]이다', () => {
  assert.deepEqual(getBoundaries(3), [1080, 2160])
  assert.deepEqual(getBoundaries(4), [1080, 2160, 3240])
})

check('알 수 없는 splitCount는 기본값(3)으로 대체된다', () => {
  assert.equal(resolveSplitCount(5), 3)
  assert.equal(resolveSplitCount(undefined), 3)
})

for (const splitCount of SPLIT_COUNTS) {
  check(`${splitCount}분할: viewport 구간(각 1080×1350)이 빈틈·겹침 없이 board 전체를 덮는다`, () => {
    const boardWidth = getBoardWidth(splitCount)
    const ranges = Array.from({ length: splitCount }, (_, i) => [i * SEGMENT_WIDTH, (i + 1) * SEGMENT_WIDTH])
    assert.equal(ranges[0][0], 0)
    assert.equal(ranges[ranges.length - 1][1], boardWidth)
    for (let i = 1; i < ranges.length; i += 1) {
      assert.equal(ranges[i][0], ranges[i - 1][1])
    }
    // 각 viewport 자체는 항상 정확히 1080×1350(SEGMENT_WIDTH×BOARD_HEIGHT)이다.
    ranges.forEach(([start, end]) => assert.equal(end - start, SEGMENT_WIDTH))
  })
}

// ---------------------------------------------------------------------------
// 사진 배치: 사진 수별 large/medium 구성, 중복 없음, 25% 이내, 회전, 테이프, 경계 안쪽
// ---------------------------------------------------------------------------

for (const splitCount of SPLIT_COUNTS) {
  for (let photoCount = 0; photoCount <= MAX_PANORAMA_PHOTOS; photoCount += 1) {
    check(`[${splitCount}분할] 사진 ${photoCount}장: 슬롯 수가 사진 수와 같고 중복 배정이 없다`, () => {
      const layout = getPanoramaLayout({ splitCount, photoCount })
      assert.equal(layout.photoSlots.length, photoCount)
      const indexes = layout.photoSlots.map((s) => s.photoIndex)
      assert.equal(new Set(indexes).size, indexes.length)
      indexes.forEach((idx) => assert.ok(idx >= 0 && idx < photoCount))
    })

    check(`[${splitCount}분할] 사진 ${photoCount}장: 모든 프레임이 board 범위 안에 있다`, () => {
      const layout = getPanoramaLayout({ splitCount, photoCount })
      for (const slot of layout.photoSlots) {
        assert.ok(slot.x >= 0)
        assert.ok(slot.y >= 0)
        assert.ok(slot.x + slot.w <= layout.boardWidth, `photoIndex ${slot.photoIndex} x+w가 board를 벗어남`)
        assert.ok(slot.y + slot.h <= BOARD_HEIGHT, `photoIndex ${slot.photoIndex} y+h가 board를 벗어남`)
      }
    })

    check(`[${splitCount}분할] 사진 ${photoCount}장: large/medium 두 단계만 쓰고 너비 차이가 25% 이내다`, () => {
      const layout = getPanoramaLayout({ splitCount, photoCount })
      const sizeKinds = new Set(layout.photoSlots.map((s) => s.size))
      for (const kind of sizeKinds) assert.ok(kind === 'L' || kind === 'M')

      if (layout.photoSlots.length > 0) {
        const widths = layout.photoSlots.map((s) => s.w)
        const max = Math.max(...widths)
        const min = Math.min(...widths)
        assert.ok((max - min) / max <= 0.25, `너비 차이가 25%를 초과함 (min=${min}, max=${max})`)
      }
    })

    check(`[${splitCount}분할] 사진 ${photoCount}장: 회전은 -4~4도, 테이프는 최대 2개다`, () => {
      const layout = getPanoramaLayout({ splitCount, photoCount })
      layout.photoSlots.forEach((slot) => assert.ok(slot.rotation >= -4 && slot.rotation <= 4))
      const tapeCount = layout.photoSlots.filter((s) => s.tape && s.tape !== 'none').length
      assert.ok(tapeCount <= 2)
    })
  }
}

check('사진 5장을 넘겨도 최대 5장까지만 사용한다', () => {
  const layout = getPanoramaLayout({ splitCount: 3, photoCount: 9 })
  assert.equal(layout.photoSlots.length, MAX_PANORAMA_PHOTOS)
})

// ---------------------------------------------------------------------------
// 경계 걸침: 사진이 충분하면 medium 슬롯이 실제 경계를 걸치고, 사진이 부족해도
// 배경 'bridge' 글귀가 항상 첫 번째 경계(1080)를 걸쳐 최소 1개는 항상 이어진다.
// ---------------------------------------------------------------------------

check('사진 2장(3분할): medium 슬롯이 1080 경계를 걸친다', () => {
  const layout = getPanoramaLayout({ splitCount: 3, photoCount: 2 })
  const medium = layout.photoSlots.find((s) => s.size === 'M')
  const segments = segmentsOverlappingRect(medium.x, medium.w, 3)
  assert.deepEqual(segments, [0, 1])
})

check('사진 3장(3분할): 두 medium 슬롯이 각각 1080/2160 경계를 걸친다', () => {
  const layout = getPanoramaLayout({ splitCount: 3, photoCount: 3 })
  const mediums = layout.photoSlots.filter((s) => s.size === 'M')
  assert.deepEqual(segmentsOverlappingRect(mediums[0].x, mediums[0].w, 3), [0, 1])
  assert.deepEqual(segmentsOverlappingRect(mediums[1].x, mediums[1].w, 3), [1, 2])
})

check('사진 4장(4분할): medium 슬롯들이 1080/2160 경계를 걸친다', () => {
  const layout = getPanoramaLayout({ splitCount: 4, photoCount: 4 })
  const mediums = layout.photoSlots.filter((s) => s.size === 'M')
  assert.deepEqual(segmentsOverlappingRect(mediums[0].x, mediums[0].w, 4), [0, 1])
  assert.deepEqual(segmentsOverlappingRect(mediums[1].x, mediums[1].w, 4), [1, 2])
})

check("배경 글귀 'bridge' 프리셋은 항상 첫 번째 경계(x=1080) 위에 위치한다", () => {
  assert.equal(getBackgroundCaptionX('bridge', getBoardWidth(3)), 1080)
  assert.equal(getBackgroundCaptionX('bridge', getBoardWidth(4)), 1080)
  const bridgePreset = BACKGROUND_CAPTION_PRESETS.find((p) => p.id === 'bridge')
  assert.equal(bridgePreset.textAlign, 'center')
  // 중앙 정렬 + maxWidth로 실제 렌더 시 1080-230 ~ 1080+230 구간을 차지해 경계를 걸친다.
  assert.ok(bridgePreset.maxWidth > 0)
})

check('사진이 1장뿐이라도(medium 없음) 배경 bridge 글귀가 항상 경계를 걸치도록 보장한다', () => {
  const layout = getPanoramaLayout({ splitCount: 3, photoCount: 1 })
  const hasMedium = layout.photoSlots.some((s) => s.size === 'M')
  assert.equal(hasMedium, false) // 사진만으로는 경계를 걸치지 않는 경우
  // 그래도 bridge 프리셋 자체는 항상 1080에 고정되어 있어 최소 1개 요소는 항상 경계를 걸친다.
  assert.equal(getBackgroundCaptionX('bridge', layout.boardWidth), 1080)
})

check('large 슬롯은 하나의 게시물 안에만 속한다(의도치 않은 걸침 없음)', () => {
  const layout = getPanoramaLayout({ splitCount: 3, photoCount: 4 })
  const larges = layout.photoSlots.filter((s) => s.size === 'L')
  larges.forEach((large) => {
    const segments = segmentsOverlappingRect(large.x, large.w, 3)
    assert.equal(segments.length, 1)
  })
})

// ---------------------------------------------------------------------------
// 배경 글귀 기본값: diaryMemo 문장 → destination → 날짜 우선순위, AI 문구 미사용
// ---------------------------------------------------------------------------

check('배경 글귀 기본값은 diaryMemo 문장을 bridge에, 나머지를 순서대로 채운다', () => {
  const captions = buildDefaultBackgroundCaptions({
    diaryMemo: '해운대에서 노을을 봤다. 자갈치에서 회를 먹었다.',
    destination: '부산',
    dateLabel: '2026-08-13',
  })
  const byId = Object.fromEntries(captions.map((c) => [c.presetId, c]))
  assert.equal(byId.bridge.text, '해운대에서 노을을 봤다.')
  assert.equal(byId['top-left'].text, '자갈치에서 회를 먹었다.')
  assert.equal(byId['bottom-right'].text, '부산')
  assert.equal(byId.bridge.visible, true)
})

check('diaryMemo가 없으면 destination/날짜만으로 채우고 빈 슬롯은 숨김 처리한다', () => {
  const captions = buildDefaultBackgroundCaptions({ diaryMemo: '', destination: '부산', dateLabel: '' })
  const byId = Object.fromEntries(captions.map((c) => [c.presetId, c]))
  assert.equal(byId.bridge.text, '부산')
  assert.equal(byId['top-left'].text, '')
  assert.equal(byId['top-left'].visible, false)
})

check('모든 값이 없으면 배경 글귀 3개 모두 빈 값이고 숨김 처리된다', () => {
  const captions = buildDefaultBackgroundCaptions({ diaryMemo: '', destination: '', dateLabel: '' })
  captions.forEach((c) => {
    assert.equal(c.text, '')
    assert.equal(c.visible, false)
  })
})

// ---------------------------------------------------------------------------
// 자유 배경색(HEX) 처리
// ---------------------------------------------------------------------------

check('올바른 #RRGGBB만 유효한 HEX로 인정한다', () => {
  assert.equal(isValidHexColor('#F7F2E8'), true)
  assert.equal(isValidHexColor('#fff'), false)
  assert.equal(isValidHexColor('F7F2E8'), false)
  assert.equal(isValidHexColor('#GGGGGG'), false)
})

check('normalizeHexColor는 # 없는 입력도 표준 대문자 #RRGGBB로 바꾸고, 잘못된 입력은 null이다', () => {
  assert.equal(normalizeHexColor('f7f2e8'), '#F7F2E8')
  assert.equal(normalizeHexColor('#f7f2e8'), '#F7F2E8')
  assert.equal(normalizeHexColor('not-a-color'), null)
  assert.equal(normalizeHexColor(''), null)
})

check('기본 배경색은 #F7F2E8이다', () => {
  assert.equal(DEFAULT_BACKGROUND_COLOR, '#F7F2E8')
})

check('밝은 배경에는 짙은 글자색, 어두운 배경에는 밝은 글자색을 고른다', () => {
  assert.ok(relativeLuminance('#FFFFFF') > relativeLuminance('#000000'))
  assert.equal(autoTextColor('#FFFFFF'), '#3f3a33')
  assert.equal(autoTextColor('#000000'), '#f7f2e8')
  assert.equal(autoTextColor(DEFAULT_BACKGROUND_COLOR), '#3f3a33') // 밝은 아이보리 → 짙은 글자
})

// ---------------------------------------------------------------------------
// PNG 파일명 규칙
// ---------------------------------------------------------------------------

check('조각 파일명은 01/02/03/04 두 자리 순번을 사용한다', () => {
  assert.equal(buildPanoramaFilename('부산', 0), 'ticket-to-tail-부산-01.png')
  assert.equal(buildPanoramaFilename('부산', 3), 'ticket-to-tail-부산-04.png')
})

check('전체 board 파일명은 -full 접미사를 사용한다', () => {
  assert.equal(buildFullBoardFilename('부산'), 'ticket-to-tail-부산-full.png')
})

console.log(`\n${passed} checks passed.`)
