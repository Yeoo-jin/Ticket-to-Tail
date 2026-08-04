// PNG Blob/File 생성, 다운로드, iPhone 네이티브 공유(navigator.share)에 필요한 범용 유틸.
// 기존 html-to-image(toBlob)를 재사용하고 새로운 이미지 생성 라이브러리는 추가하지 않는다.
// 사용자 에이전트 문자열로 iPhone을 단정하지 않고, 실제 기능 지원 여부만으로 분기한다.
import { toBlob } from 'html-to-image'

async function waitForImagesToDecode(node) {
  if (!node) return
  const images = Array.from(node.querySelectorAll('img'))
  await Promise.all(images.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())))
}

async function waitForFontsReady() {
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready
    } catch {
      // 폰트 로딩 확인에 실패해도 저장 자체는 계속 진행한다.
    }
  }
}

// 배경색·폰트·글자 크기·필터 등 최근 상태 변경이 실제 화면에 반영된 뒤 캡처하도록
// 짧게 한 프레임을 더 기다린다.
function waitForNextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

// 노드를 PNG Blob으로 렌더링한다. 저장 직전 이미지 decode·폰트 로딩·프레임 대기를 모두 거친다.
export async function renderSegmentToBlob(node, { pixelRatio = 1 } = {}) {
  if (!node) {
    throw new Error('저장할 이미지를 찾을 수 없습니다.')
  }
  await Promise.all([waitForImagesToDecode(node), waitForFontsReady()])
  await waitForNextFrame()

  let blob
  try {
    // cacheBust는 쓰지 않는다: html-to-image가 켜져 있으면 이미지 URL에 "?타임스탬프"를
    // 붙여서 다시 fetch하는데, 사진은 로컬 blob: URL이라 쿼리스트링이 붙으면 더 이상
    // 유효한 URL이 아니게 되어(브라우저가 blob 레지스트리에서 찾지 못함) fetch가 실패하고
    // 사진이 빈 이미지로 나오거나 저장 자체가 멈춘다. 이 앱의 리소스(로컬 blob 사진,
    // 번들된 폰트 파일)는 URL이 바뀌지 않는 한 내용도 바뀌지 않으므로 캐시 무효화가 애초에 필요 없다.
    //
    // Safari(특히 iOS)는 html-to-image(및 dom-to-image 계열 라이브러리 전반)의 "첫 캡처"에서
    // <img> 사진만 빠진 채로 렌더링하고, 같은 노드를 곧바로 다시 캡처하면 정상적으로 나오는
    // 문제가 널리 보고되어 있다(텍스트·배경·스티커는 정상, 사진만 빈 칸으로 나오는 것과 일치).
    // 그래서 한 번 "예열용"으로 먼저 캡처해 버리고, 실제로 쓰는 건 그다음 캡처 결과다.
    await toBlob(node, { pixelRatio }).catch(() => {})
    blob = await toBlob(node, { pixelRatio })
  } catch {
    throw new Error('이미지 생성에 실패했습니다. 사진이 너무 크거나 메모리가 부족할 수 있습니다.')
  }
  if (!blob) {
    throw new Error('이미지 생성에 실패했습니다. 브라우저 보안 설정이나 사진 로딩 상태를 확인해주세요.')
  }
  return blob
}

export function createSegmentFile(blob, filename) {
  return new File([blob], filename, { type: 'image/png' })
}

// count개 조각을 순서대로 각각 Blob→File로 만든다. 동시에 여러 캡처를 시도하면 렌더링이
// 꼬일 수 있어 순차 처리한다. 노드는 getNode(index)로 그때그때 하나씩만 마운트해서 받고,
// 캡처가 끝나면 releaseNode()로 바로 언마운트한다(여러 조각을 동시에 DOM에 띄워두지 않기 위함).
export async function createAllSegmentFiles(count, filenameFor, getNode, releaseNode, { pixelRatio = 1, onProgress } = {}) {
  const files = []
  for (let index = 0; index < count; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    const node = await getNode(index)
    // eslint-disable-next-line no-await-in-loop
    const blob = await renderSegmentToBlob(node, { pixelRatio })
    files.push(createSegmentFile(blob, filenameFor(index)))
    releaseNode()
    if (onProgress) onProgress(index + 1, count)
  }
  return files
}

// 데스크톱 등에서 쓰는 기존 다운로드 방식(a.download). Blob URL은 사용 후 반드시 해제한다.
export function downloadBlob(blob, filename) {
  let url
  try {
    url = URL.createObjectURL(blob)
  } catch {
    throw new Error('다운로드에 실패했습니다.')
  }
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
  } finally {
    // 클릭이 비동기로 다운로드를 시작하므로 아주 짧게 지연한 뒤 해제한다.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

// 보안 컨텍스트(HTTPS 또는 localhost)이고 navigator.share가 있는지만으로 판단한다.
export function canUseNativeShare() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext === true &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function'
  )
}

// 실제로 이 파일 목록을 공유할 수 있는지까지 확인한다(예: 여러 장 동시 공유 미지원 기기).
export function canShareFiles(files) {
  if (!canUseNativeShare() || typeof navigator.canShare !== 'function') return false
  if (!files || files.length === 0) return false
  try {
    return navigator.canShare({ files })
  } catch {
    return false
  }
}

// 오류 종류를 한글 메시지로 구분한다. 공유 취소(AbortError)는 오류로 취급하지 않는다.
export function describeShareError(error) {
  if (error && error.name === 'AbortError') {
    return { cancelled: true, message: '공유가 취소되었습니다.' }
  }
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return { cancelled: false, message: '보안 연결(HTTPS)이 아니어서 공유 기능을 사용할 수 없습니다.' }
  }
  if (error && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
    return { cancelled: false, message: 'Safari 공유 기능을 사용할 수 없습니다.' }
  }
  return { cancelled: false, message: '파일 공유에 실패했습니다. 다시 시도해주세요.' }
}

// 이미 준비된 File을 사용자 제스처(클릭 핸들러) 안에서 바로 공유한다.
// 파일 생성처럼 시간이 걸리는 작업을 이 함수 호출 직전에 두면 제스처가 사라져
// navigator.share가 실패할 수 있으므로, 호출 시점에는 파일이 이미 준비돼 있어야 한다.
export async function shareFilesOnSupportedDevice(files, { title } = {}) {
  if (!canShareFiles(files)) {
    throw new Error('이 환경에서는 파일 공유를 지원하지 않습니다.')
  }
  try {
    await navigator.share({ files, title })
    return true
  } catch (error) {
    const described = describeShareError(error)
    const shareError = new Error(described.message)
    shareError.cancelled = described.cancelled
    throw shareError
  }
}
