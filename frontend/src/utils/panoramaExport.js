// 폴라로이드 캐러셀의 게시물(뷰포트) PNG 저장. 기존 imageExport.js의
// exportNodeToPng(같은 master board를 1080 기준 pixelRatio로 저장하는 로직)를 그대로 재사용하고,
// 파일명 규칙(01/02/03)과 "이미지 디코딩 대기 후 캡처" 부분만 이 파일에서 추가한다.
import { exportNodeToPng } from './imageExport.js'

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function buildPanoramaFilename(destination, viewportIndex) {
  const safeDestination = (destination || '여행').replace(/[^\w가-힣]/g, '').slice(0, 20) || '여행'
  const order = String(viewportIndex + 1).padStart(2, '0')
  return `ticket-to-tail-${safeDestination}-${order}.png`
}

// 사진(<img>) 디코딩이 끝난 뒤 캡처해야 잘리거나 빈 채로 저장되는 것을 막을 수 있다.
async function waitForImagesToDecode(node) {
  if (!node) return
  const images = Array.from(node.querySelectorAll('img'))
  await Promise.all(images.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())))
}

export async function exportPanoramaViewport(node, destination, viewportIndex) {
  await waitForImagesToDecode(node)
  await exportNodeToPng(node, buildPanoramaFilename(destination, viewportIndex))
}

// 3개 뷰포트를 순서대로 각각 PNG로 저장한다. 뷰포트는 항상 마운트된 숨김 노드를 사용하므로
// (검은 구분선·버튼 없이 게시물 영역만 포함) 별도로 화면을 전환할 필요가 없다.
export async function exportAllPanoramaViewports(nodes, destination, { onProgress, gapMs = 200 } = {}) {
  const results = []
  for (let index = 0; index < nodes.length; index += 1) {
    try {
      await exportPanoramaViewport(nodes[index], destination, index)
      results.push({ index, ok: true })
    } catch (error) {
      results.push({ index, ok: false, message: error.message })
    }
    if (onProgress) onProgress(index + 1, nodes.length)
    if (index < nodes.length - 1) {
      await wait(gapMs)
    }
  }
  return results
}
