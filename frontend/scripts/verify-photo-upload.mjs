// 순수 유틸 함수(photoUpload.js) 핵심 로직을 별도 테스트 러너 없이 Node로 직접 검증한다.
// 실행: node scripts/verify-photo-upload.mjs
import assert from 'node:assert/strict'
import {
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  PHOTO_ERROR,
  canGenerateDiary,
  removePhotoAt,
  resolveNewPhotos,
} from '../src/utils/photoUpload.js'

function jpeg(size = 1024) {
  return { type: 'image/jpeg', size }
}

let passed = 0
function check(name, fn) {
  fn()
  passed += 1
  console.log(`PASS ${name}`)
}

// 최대 5장 제한 로직
check('처음 5장은 모두 허용된다', () => {
  const files = Array.from({ length: 5 }, () => jpeg())
  const { accepted, errors } = resolveNewPhotos(0, files)
  assert.equal(accepted.length, 5)
  assert.deepEqual(errors, [])
})

check('이미 5장이 있으면 추가로 넣을 수 없다', () => {
  const { accepted, errors } = resolveNewPhotos(MAX_PHOTOS, [jpeg()])
  assert.equal(accepted.length, 0)
  assert.deepEqual(errors, [PHOTO_ERROR.TOO_MANY])
})

check('3장 보유 중 4장을 더 넣으면 2장만 허용되고 초과 안내가 뜬다', () => {
  const { accepted, errors } = resolveNewPhotos(3, [jpeg(), jpeg(), jpeg(), jpeg()])
  assert.equal(accepted.length, 2)
  assert.ok(errors.includes(PHOTO_ERROR.TOO_MANY))
})

// 잘못된 파일 형식 안내
check('허용되지 않은 형식은 거부되고 안내 메시지가 표시된다', () => {
  const { accepted, errors } = resolveNewPhotos(0, [{ type: 'image/gif', size: 1024 }])
  assert.equal(accepted.length, 0)
  assert.deepEqual(errors, [PHOTO_ERROR.INVALID_TYPE])
})

check('5MB를 초과하는 파일은 거부된다', () => {
  const { accepted, errors } = resolveNewPhotos(0, [{ type: 'image/png', size: MAX_PHOTO_BYTES + 1 }])
  assert.equal(accepted.length, 0)
  assert.deepEqual(errors, [PHOTO_ERROR.TOO_LARGE])
})

// 사진 삭제
check('removePhotoAt은 해당 인덱스만 제거한다', () => {
  const photos = ['a', 'b', 'c']
  assert.deepEqual(removePhotoAt(photos, 1), ['a', 'c'])
})

// 사진·메모 모두 없을 때 생성 방지
check('메모와 사진이 모두 없으면 생성할 수 없다', () => {
  assert.equal(canGenerateDiary({ memo: '', photoCount: 0 }), false)
  assert.equal(canGenerateDiary({ memo: '   ', photoCount: 0 }), false)
})

check('메모만 있어도 생성할 수 있다', () => {
  assert.equal(canGenerateDiary({ memo: '좋았다', photoCount: 0 }), true)
})

check('사진만 있어도 생성할 수 있다', () => {
  assert.equal(canGenerateDiary({ memo: '', photoCount: 1 }), true)
})

console.log(`\n${passed} checks passed.`)
