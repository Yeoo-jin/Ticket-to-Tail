import { useRef, useState } from 'react'
import { buildExportFilename, exportNodeToPng } from '../../utils/imageExport'
import { photoImageStyle } from '../../utils/photoStyle'
import StoryCardView from './StoryCardView'

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function Thumbnail({ card, photos, active, onClick }) {
  const firstIndex = card.photoIndexes && card.photoIndexes.length > 0 ? card.photoIndexes[0] : null
  const photo = firstIndex !== null ? photos[firstIndex] : null
  return (
    <button
      type="button"
      onClick={onClick}
      className={`aspect-[4/5] w-9 shrink-0 overflow-hidden rounded border ${
        active ? 'border-blue-500 ring-1 ring-blue-400' : 'border-gray-300 opacity-70'
      }`}
    >
      {photo ? (
        <img src={photo.previewUrl} alt="" className="h-full w-full object-cover" style={photoImageStyle(null)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gray-100 text-[9px] text-gray-400">
          {card.type === 'quote' ? '“' : card.type === 'ending' ? '끝' : card.type === 'cover' ? '표지' : '·'}
        </div>
      )}
    </button>
  )
}

// SNS 캐러셀(4:5 세로 카드) 보기. 카드는 모두 항상 마운트해두고 opacity로만
// 현재 카드를 전환한다 - "전체 카드 저장" 시 각 카드를 순서대로 활성화해 캡처하기 위함이다.
function SnsCarousel({ cards, photos, photoStyles, theme, destination, activeIndex, onChangeActiveIndex }) {
  const cardRefs = useRef([])
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState('')

  const total = cards.length
  const safeIndex = total > 0 ? Math.min(Math.max(activeIndex, 0), total - 1) : 0

  if (total === 0) return null

  function goTo(index) {
    onChangeActiveIndex(Math.min(Math.max(index, 0), total - 1))
  }

  async function handleExportCurrent() {
    if (exporting) return
    setExporting(true)
    setExportMessage('')
    try {
      await exportNodeToPng(cardRefs.current[safeIndex], buildExportFilename(destination, safeIndex))
      setExportMessage('현재 카드를 이미지로 저장했어요.')
    } catch (error) {
      setExportMessage(error.message)
    } finally {
      setExporting(false)
    }
  }

  async function handleExportAll() {
    if (exporting) return
    setExporting(true)
    setExportMessage('')
    const originalIndex = safeIndex
    const failures = []

    for (let index = 0; index < total; index += 1) {
      onChangeActiveIndex(index)
      // eslint-disable-next-line no-await-in-loop
      await wait(220)
      try {
        // eslint-disable-next-line no-await-in-loop
        await exportNodeToPng(cardRefs.current[index], buildExportFilename(destination, index))
      } catch (error) {
        failures.push(index + 1)
      }
      // eslint-disable-next-line no-await-in-loop
      await wait(200)
    }

    onChangeActiveIndex(originalIndex)
    setExporting(false)
    setExportMessage(
      failures.length > 0 ? `${failures.join(', ')}번 카드 저장에 실패했습니다.` : '모든 카드를 순서대로 저장했어요.'
    )
  }

  return (
    <div>
      <div className="relative">
        {cards.map((card, index) => (
          <div key={card.id} className={index === safeIndex ? '' : 'pointer-events-none absolute inset-0 opacity-0'}>
            <StoryCardView
              card={card}
              photos={photos}
              photoStyles={photoStyles}
              theme={theme}
              cardRef={(node) => {
                cardRefs.current[index] = node
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <button
          type="button"
          onClick={() => goTo(safeIndex - 1)}
          disabled={safeIndex === 0}
          className="rounded-full border border-gray-300 px-3 py-1 disabled:opacity-30"
        >
          이전
        </button>
        <span className="font-medium text-gray-700">
          {safeIndex + 1} / {total}
        </span>
        <button
          type="button"
          onClick={() => goTo(safeIndex + 1)}
          disabled={safeIndex === total - 1}
          className="rounded-full border border-gray-300 px-3 py-1 disabled:opacity-30"
        >
          다음
        </button>
      </div>

      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
        {cards.map((card, index) => (
          <Thumbnail key={card.id} card={card} photos={photos} active={index === safeIndex} onClick={() => goTo(index)} />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleExportCurrent}
          disabled={exporting}
          className="rounded-lg border border-blue-300 py-2 text-xs font-medium text-blue-700 disabled:opacity-40"
        >
          현재 카드 저장
        </button>
        <button
          type="button"
          onClick={handleExportAll}
          disabled={exporting}
          className="rounded-lg border border-blue-300 py-2 text-xs font-medium text-blue-700 disabled:opacity-40"
        >
          전체 카드 저장
        </button>
      </div>
      {exporting && <p className="mt-1 text-center text-[11px] text-gray-400">이미지를 저장하는 중...</p>}
      {!exporting && exportMessage && <p className="mt-1 text-center text-[11px] text-gray-500">{exportMessage}</p>}
    </div>
  )
}

export default SnsCarousel
