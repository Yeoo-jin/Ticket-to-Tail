// iPhone 저장·공유 유틸(imageShare.js, panoramaExport.js의 파일명 규칙)을 검증하는
// 순수 JS 스크립트. 실제 렌더링(toBlob)은 브라우저 DOM이 필요해 이 스크립트에서 다루지
// 않고, DOM과 무관한 로직(공유 가능 여부 판단, 오류 분류, 파일명·MIME 타입, 다운로드 흐름)만
// 검증한다. 실행: node scripts/verify-image-share.mjs
import assert from 'node:assert/strict'
import { File } from 'node:buffer'

// Node 18에는 전역 File이 없어 createSegmentFile()이 참조하는 File을 최소 폴리필한다.
// (전역 Blob은 Node 18에 이미 존재한다.)
if (typeof globalThis.File === 'undefined') {
  globalThis.File = File
}

import {
  canShareFiles,
  canUseNativeShare,
  createSegmentFile,
  describeShareError,
  downloadBlob,
  shareFilesOnSupportedDevice,
} from '../src/utils/imageShare.js'
import { buildFullBoardFilename, buildPanoramaFilename } from '../src/utils/panoramaExport.js'

let passed = 0
function check(name, fn) {
  fn()
  passed += 1
  console.log(`PASS ${name}`)
}

function withGlobals(overrides, fn) {
  const originalWindow = globalThis.window
  const originalNavigator = globalThis.navigator
  const originalDocument = globalThis.document
  globalThis.window = overrides.window
  globalThis.navigator = overrides.navigator
  if ('document' in overrides) globalThis.document = overrides.document
  try {
    return fn()
  } finally {
    globalThis.window = originalWindow
    globalThis.navigator = originalNavigator
    if ('document' in overrides) globalThis.document = originalDocument
  }
}

// ---------------------------------------------------------------------------
// 공유 가능 환경 분기
// ---------------------------------------------------------------------------

check('보안 컨텍스트 + navigator.share가 있으면 네이티브 공유를 사용할 수 있다', () => {
  const result = withGlobals({ window: { isSecureContext: true }, navigator: { share: () => {} } }, () =>
    canUseNativeShare()
  )
  assert.equal(result, true)
})

check('secure context가 아니면 네이티브 공유를 사용할 수 없다(HTTP fallback 대상)', () => {
  const result = withGlobals({ window: { isSecureContext: false }, navigator: { share: () => {} } }, () =>
    canUseNativeShare()
  )
  assert.equal(result, false)
})

check('navigator.share 자체가 없으면 네이티브 공유를 사용할 수 없다', () => {
  const result = withGlobals({ window: { isSecureContext: true }, navigator: {} }, () => canUseNativeShare())
  assert.equal(result, false)
})

check('canShare가 없거나 false를 반환하면 canShareFiles는 false다(fallback 경로로 전환)', () => {
  const withoutCanShare = withGlobals({ window: { isSecureContext: true }, navigator: { share: () => {} } }, () =>
    canShareFiles([{ name: 'a.png' }])
  )
  assert.equal(withoutCanShare, false)

  const withFalseCanShare = withGlobals(
    { window: { isSecureContext: true }, navigator: { share: () => {}, canShare: () => false } },
    () => canShareFiles([{ name: 'a.png' }])
  )
  assert.equal(withFalseCanShare, false)
})

check('canShare가 true를 반환하고 파일이 있으면 canShareFiles는 true다', () => {
  const result = withGlobals(
    { window: { isSecureContext: true }, navigator: { share: () => {}, canShare: () => true } },
    () => canShareFiles([{ name: 'a.png' }])
  )
  assert.equal(result, true)
})

check('빈 파일 목록은 공유 대상이 없으므로 canShareFiles가 false다', () => {
  const result = withGlobals(
    { window: { isSecureContext: true }, navigator: { share: () => {}, canShare: () => true } },
    () => canShareFiles([])
  )
  assert.equal(result, false)
})

check('canShare 호출이 예외를 던져도(확인 실패) 안전하게 false로 처리한다', () => {
  const result = withGlobals(
    {
      window: { isSecureContext: true },
      navigator: {
        share: () => {},
        canShare: () => {
          throw new Error('알 수 없는 오류')
        },
      },
    },
    () => canShareFiles([{ name: 'a.png' }])
  )
  assert.equal(result, false)
})

// ---------------------------------------------------------------------------
// 오류 분류(한글 메시지) + 공유 취소 처리
// ---------------------------------------------------------------------------

check('AbortError(공유 취소)는 심각한 오류가 아니라 안내 문구로 처리된다', () => {
  const error = new Error('cancelled')
  error.name = 'AbortError'
  const described = describeShareError(error)
  assert.equal(described.cancelled, true)
  assert.equal(described.message, '공유가 취소되었습니다.')
})

check('보안 연결이 아니면 전용 안내 문구를 반환한다', () => {
  const described = withGlobals({ window: { isSecureContext: false }, navigator: {} }, () =>
    describeShareError(new Error('아무 오류'))
  )
  assert.equal(described.cancelled, false)
  assert.match(described.message, /보안 연결/)
})

check('그 외 오류는 일반 공유 실패 안내로 처리된다', () => {
  const described = withGlobals({ window: { isSecureContext: true }, navigator: {} }, () =>
    describeShareError(new Error('기타 오류'))
  )
  assert.equal(described.cancelled, false)
  assert.match(described.message, /공유에 실패/)
})

check('공유가 지원되지 않는 환경에서 shareFilesOnSupportedDevice를 호출하면 즉시 실패한다', async () => {
  await withGlobals({ window: { isSecureContext: false }, navigator: {} }, async () => {
    await assert.rejects(() => shareFilesOnSupportedDevice([{ name: 'a.png' }]), /지원하지 않습니다/)
  })
})

check('navigator.share가 AbortError로 거부되면 취소 상태로 감싸 다시 던진다', async () => {
  await withGlobals(
    {
      window: { isSecureContext: true },
      navigator: {
        share: () => {
          const error = new Error('cancelled')
          error.name = 'AbortError'
          return Promise.reject(error)
        },
        canShare: () => true,
      },
    },
    async () => {
      try {
        await shareFilesOnSupportedDevice([{ name: 'a.png' }])
        assert.fail('취소 시 예외가 발생해야 한다')
      } catch (error) {
        assert.equal(error.cancelled, true)
        assert.equal(error.message, '공유가 취소되었습니다.')
      }
    }
  )
})

// ---------------------------------------------------------------------------
// 파일명 규칙 + Blob MIME 타입
// ---------------------------------------------------------------------------

check('3분할 조각 파일명은 01/02/03이다', () => {
  assert.equal(buildPanoramaFilename('부산', 0), 'ticket-to-tail-부산-01.png')
  assert.equal(buildPanoramaFilename('부산', 1), 'ticket-to-tail-부산-02.png')
  assert.equal(buildPanoramaFilename('부산', 2), 'ticket-to-tail-부산-03.png')
})

check('4분할 조각 파일명은 01~04이다', () => {
  const names = [0, 1, 2, 3].map((index) => buildPanoramaFilename('부산', index))
  assert.deepEqual(names, [
    'ticket-to-tail-부산-01.png',
    'ticket-to-tail-부산-02.png',
    'ticket-to-tail-부산-03.png',
    'ticket-to-tail-부산-04.png',
  ])
})

check('전체 board 파일명은 -full 접미사를 사용한다', () => {
  assert.equal(buildFullBoardFilename('부산'), 'ticket-to-tail-부산-full.png')
})

check('createSegmentFile은 image/png 타입의 File을 만든다', () => {
  const blob = new Blob(['fake-png-bytes'], { type: 'image/png' })
  const file = createSegmentFile(blob, 'ticket-to-tail-부산-01.png')
  assert.equal(file.name, 'ticket-to-tail-부산-01.png')
  assert.equal(file.type, 'image/png')
  assert.equal(file.size, blob.size)
})

check("3분할·4분할 각각 조각 수만큼 File을 만들 수 있다(파일명이 모두 다름)", () => {
  for (const splitCount of [3, 4]) {
    const files = Array.from({ length: splitCount }, (_, index) => {
      const blob = new Blob([`segment-${index}`], { type: 'image/png' })
      return createSegmentFile(blob, buildPanoramaFilename('부산', index))
    })
    assert.equal(files.length, splitCount)
    const names = files.map((f) => f.name)
    assert.equal(new Set(names).size, splitCount, '파일명이 중복되면 안 된다')
    files.forEach((f) => assert.equal(f.type, 'image/png'))
  }
})

// ---------------------------------------------------------------------------
// 다운로드(Blob URL) 흐름과 Object URL 정리
// ---------------------------------------------------------------------------

check('downloadBlob은 a 태그를 클릭하고 Object URL을 나중에 해제한다', async () => {
  let clicked = false
  let createdUrl = null
  let revokedUrl = null

  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL
  URL.createObjectURL = (blob) => {
    createdUrl = originalCreateObjectURL.call(URL, blob)
    return createdUrl
  }
  URL.revokeObjectURL = (url) => {
    revokedUrl = url
    return originalRevokeObjectURL.call(URL, url)
  }

  const fakeAnchor = { click: () => { clicked = true } }
  globalThis.document = { createElement: () => fakeAnchor }

  try {
    const blob = new Blob(['x'], { type: 'image/png' })
    downloadBlob(blob, 'ticket-to-tail-부산-01.png')
    assert.equal(clicked, true)
    assert.equal(fakeAnchor.download, 'ticket-to-tail-부산-01.png')
    assert.ok(createdUrl)

    await new Promise((resolve) => setTimeout(resolve, 1100))
    assert.equal(revokedUrl, createdUrl, 'Object URL이 정리되어야 한다')
  } finally {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    delete globalThis.document
  }
})

console.log(`\n${passed} checks passed.`)
