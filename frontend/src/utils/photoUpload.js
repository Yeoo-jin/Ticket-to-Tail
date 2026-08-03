// 여행 사진 업로드 정책 (backend/app/services/photo_validation.py와 동일한 기준).
export const MAX_PHOTOS = 5
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const PHOTO_ERROR = {
  TOO_MANY: `사진은 최대 ${MAX_PHOTOS}장까지 업로드할 수 있습니다.`,
  INVALID_TYPE: '지원하지 않는 파일 형식입니다. JPG, PNG, WEBP 파일만 업로드할 수 있습니다.',
  TOO_LARGE: '사진 1장당 최대 5MB까지 업로드할 수 있습니다.',
}

// 새로 선택한 파일들을 현재 사진 개수(currentCount) 기준으로 검증한다.
// File 객체 대신 {type, size}만 있으면 되므로 순수 함수로 Node에서도 테스트하기 쉽다.
export function resolveNewPhotos(currentCount, incomingFiles) {
  const accepted = []
  const errors = []
  let count = currentCount

  for (const file of incomingFiles) {
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      errors.push(PHOTO_ERROR.INVALID_TYPE)
      continue
    }
    if (file.size > MAX_PHOTO_BYTES) {
      errors.push(PHOTO_ERROR.TOO_LARGE)
      continue
    }
    if (count >= MAX_PHOTOS) {
      errors.push(PHOTO_ERROR.TOO_MANY)
      break
    }
    accepted.push(file)
    count += 1
  }

  return { accepted, errors: [...new Set(errors)] }
}

export function removePhotoAt(photos, index) {
  return photos.filter((_, i) => i !== index)
}

export function canGenerateDiary({ memo, photoCount }) {
  return Boolean((memo && memo.trim()) || photoCount > 0)
}
