// html-to-image로 캐러셀 카드를 PNG로 저장한다. 브라우저 보안/이미지 로딩 문제로
// 저장이 실패할 수 있으므로 항상 예외를 잡아 한글 오류 메시지로 변환한다.
import { toPng } from 'html-to-image'

const EXPORT_TARGET_WIDTH = 1080

export function buildExportFilename(destination, cardIndex) {
  const safeDestination = (destination || '여행').replace(/[^\w가-힣]/g, '').slice(0, 20) || '여행'
  return `ticket-to-tail-${safeDestination}-${cardIndex + 1}.png`
}

// 카드 DOM은 항상 4:5 비율을 유지하므로, 실제 렌더링 너비 기준 배율을 계산해
// 내보내기 결과가 항상 1080×1350에 가깝게 나오도록 한다.
export async function exportNodeToPng(node, filename) {
  if (!node) {
    throw new Error('저장할 카드를 찾을 수 없습니다.')
  }
  const width = node.offsetWidth || EXPORT_TARGET_WIDTH
  const pixelRatio = EXPORT_TARGET_WIDTH / width

  try {
    const dataUrl = await toPng(node, { pixelRatio, cacheBust: true, backgroundColor: undefined })
    const link = document.createElement('a')
    link.download = filename
    link.href = dataUrl
    link.click()
  } catch (error) {
    throw new Error('이미지 저장에 실패했습니다. 브라우저 보안 설정이나 사진 로딩 상태를 확인해주세요.')
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 카드를 순서대로 하나씩 PNG로 저장한다. 각 저장 사이 짧은 지연을 두어
// 브라우저의 연속 다운로드 차단이나 렌더링 타이밍 문제를 줄인다.
export async function exportSequentially(nodes, filenameFor, { onProgress, gapMs = 250 } = {}) {
  const results = []
  for (let index = 0; index < nodes.length; index += 1) {
    try {
      await exportNodeToPng(nodes[index], filenameFor(index))
      results.push({ index, ok: true })
    } catch (error) {
      results.push({ index, ok: false, message: error.message })
    }
    if (onProgress) onProgress(index + 1, nodes.length)
    if (index < nodes.length - 1) {
      await delay(gapMs)
    }
  }
  return results
}
