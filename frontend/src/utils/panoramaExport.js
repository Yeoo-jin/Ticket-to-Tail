// 폴라로이드 캐러셀의 게시물(뷰포트) PNG 저장.
// 게시물별/전체 순차 저장은 imageShare.js의 Blob 기반 유틸(다운로드·iPhone 공유 공용)을 쓰고,
// 여기서는 파일명 규칙만 연결한다("전체 조각 저장"도 결국 다운로드이므로 Blob 경로 하나로 통일됨).
// "전체 board"(가변 너비 3240/4320) 저장만 기존 data URL + a.download 방식을 그대로 유지한다.
import { toPng } from 'html-to-image'
import { createAllSegmentFiles, createSegmentFile, renderSegmentToBlob } from './imageShare.js'

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

export async function exportFullBoard(node, destination) {
  if (!node) {
    throw new Error('저장할 포토 다이어리를 찾을 수 없습니다.')
  }
  await Promise.all([waitForImagesToDecode(node), waitForFontsReady()])
  try {
    // cacheBust를 쓰지 않는 이유는 renderSegmentToBlob(imageShare.js) 주석 참고:
    // 로컬 blob: 사진 URL에 쿼리스트링이 붙으면 fetch가 실패해 저장이 깨진다.
    const dataUrl = await toPng(node, { pixelRatio: 1 })
    const link = document.createElement('a')
    link.download = buildFullBoardFilename(destination)
    link.href = dataUrl
    link.click()
  } catch (error) {
    throw new Error('이미지 저장에 실패했습니다. 브라우저 보안 설정이나 사진 로딩 상태를 확인해주세요.')
  }
}

// --- 아래는 다운로드(Blob URL + a.download)와 iPhone 공유(File) 양쪽에서 공용으로 쓰는
// 뷰포트 Blob/File 생성 함수. 뷰포트는 항상 정확히 1080×1350이므로
// pixelRatio=1로 캡처하면 그대로 원본 크기가 된다. ---

export async function renderPanoramaSegmentToBlob(node) {
  return renderSegmentToBlob(node, { pixelRatio: 1 })
}

export async function createPanoramaSegmentFile(node, destination, viewportIndex) {
  const blob = await renderPanoramaSegmentToBlob(node)
  return createSegmentFile(blob, buildPanoramaFilename(destination, viewportIndex))
}

export async function createAllPanoramaSegmentFiles(nodes, destination) {
  return createAllSegmentFiles(nodes, (index) => buildPanoramaFilename(destination, index), { pixelRatio: 1 })
}
