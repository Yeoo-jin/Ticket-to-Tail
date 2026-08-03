// 폴라로이드 캐러셀의 게시물(뷰포트) PNG 저장. 기존 imageExport.js의
// exportNodeToPng(같은 master board를 1080 기준 pixelRatio로 저장하는 로직)를 그대로 재사용하고,
// 파일명 규칙(01/02/03)과 "이미지·폰트 로딩 대기 후 캡처" 부분만 이 파일에서 추가한다.
// 뷰포트는 분할 수와 무관하게 항상 1080 너비이므로 exportNodeToPng 재사용이 정확하지만,
// "전체 board" 저장은 너비가 3240/4320으로 가변이라 별도로 pixelRatio=1 캡처를 사용한다.
import { toPng } from 'html-to-image'
import { exportNodeToPng } from './imageExport.js'

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function buildPanoramaFilename(destination, viewportIndex) {
  const safeDestination = (destination || '여행').replace(/[^\w가-힣]/g, '').slice(0, 20) || '여행'
  const order = String(viewportIndex + 1).padStart(2, '0')
  return `ticket-to-tail-${safeDestination}-${order}.png`
}

export function buildFullBoardFilename(destination) {
  const safeDestination = (destination || '여행').replace(/[^\w가-힣]/g, '').slice(0, 20) || '여행'
  return `ticket-to-tail-${safeDestination}-full.png`
}

// 사진(<img>) 디코딩이 끝난 뒤 캡처해야 잘리거나 빈 채로 저장되는 것을 막을 수 있다.
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

export async function exportPanoramaViewport(node, destination, viewportIndex) {
  await Promise.all([waitForImagesToDecode(node), waitForFontsReady()])
  await exportNodeToPng(node, buildPanoramaFilename(destination, viewportIndex))
}

export async function exportFullBoard(node, destination) {
  if (!node) {
    throw new Error('저장할 포토 다이어리를 찾을 수 없습니다.')
  }
  await Promise.all([waitForImagesToDecode(node), waitForFontsReady()])
  try {
    const dataUrl = await toPng(node, { pixelRatio: 1, cacheBust: true })
    const link = document.createElement('a')
    link.download = buildFullBoardFilename(destination)
    link.href = dataUrl
    link.click()
  } catch (error) {
    throw new Error('이미지 저장에 실패했습니다. 브라우저 보안 설정이나 사진 로딩 상태를 확인해주세요.')
  }
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
