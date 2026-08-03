import { useMemo, useRef, useState } from 'react'
import { getPhotoStyle } from '../../utils/photoStyle'
import {
  CAPTION_SLOT_PRIORITY,
  MAX_PANORAMA_PHOTOS,
  PANORAMA_PRESETS,
  PANORAMA_PRESET_LABELS,
  VIEWPORT_COUNT,
  getPanoramaLayout,
} from '../../utils/panoramaLayouts'
import { exportAllPanoramaViewports, exportPanoramaViewport } from '../../utils/panoramaExport'
import PanoramaPreview from './PanoramaPreview'
import PanoramaViewport from './PanoramaViewport'
import PolaroidPhoto from './PolaroidPhoto'

function truncate(text, max) {
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function pickLocationLabel(storyCards, destination) {
  const found = storyCards.find((card) => card.locationLabel)
  return (found && found.locationLabel) || destination
}

function pickEndingText(storyCards, summary) {
  const ending = storyCards.find((card) => card.type === 'ending')
  const text = ending ? ending.body || ending.headline : summary
  return text || summary
}

// 캡션은 보드 전체에서 최대 2개만 사용한다(요구사항 6). big2 → small3 → straddle 순으로
// 실제 존재하는 슬롯에 캡션이 있는 사진을 배정한다.
function buildCaptionsBySlot(photoSlots, photoCaptions) {
  const captionByIndex = new Map(photoCaptions.map((c) => [c.photoIndex, c.caption]))
  const slotToPhotoIndex = new Map(photoSlots.map((s) => [s.slot, s.photoIndex]))
  const result = {}
  let count = 0
  for (const slot of CAPTION_SLOT_PRIORITY) {
    if (count >= 2) break
    if (!slotToPhotoIndex.has(slot)) continue
    const caption = captionByIndex.get(slotToPhotoIndex.get(slot))
    if (caption) {
      result[slot] = caption
      count += 1
    }
  }
  return result
}

// AI 다이어리 결과 + storyCards + 업로드 사진을 하나의 master board(3240×1350) 콘텐츠로 엮는
// 오케스트레이터. 실제 "판(board)"은 이 컴포넌트가 한 번만 만들고, PanoramaViewport에게
// 여러 번(미리보기용 축소, 내보내기용 원본 크기) 그대로 넘겨 잘라 보여주기만 한다.
function PanoramaDiary({
  diaryData,
  photos,
  photoStyles,
  storyCards,
  destination,
  preset,
  onChangePreset,
  viewMode,
  onChangeViewMode,
  activeViewportIndex,
  onChangeActiveViewportIndex,
}) {
  const photoCount = Math.min(photos.length, MAX_PANORAMA_PHOTOS)
  const layout = useMemo(() => getPanoramaLayout({ preset, photoCount }), [preset, photoCount])

  const locationLabel = pickLocationLabel(storyCards, destination)
  const titleLine = truncate(diaryData.title, 26)
  const endingText = truncate(pickEndingText(storyCards, diaryData.summary), 60)
  const captionBySlot = useMemo(
    () => buildCaptionsBySlot(layout.photoSlots, diaryData.photoCaptions),
    [layout.photoSlots, diaryData.photoCaptions]
  )

  const boardContent = (
    <div className="relative h-full w-full pb-paper">
      {layout.photoSlots.map(({ slot, photoIndex, x, y, w, h, rotation, tape }) => (
        <PolaroidPhoto
          key={slot}
          x={x}
          y={y}
          width={w}
          height={h}
          rotation={rotation}
          tape={tape}
          photo={photos[photoIndex]}
          photoStyle={getPhotoStyle(photoStyles, photoIndex)}
          caption={captionBySlot[slot] || null}
        />
      ))}

      <div
        className="pb-location-badge"
        style={{ left: layout.geometry.locationLabel.x, top: layout.geometry.locationLabel.y, width: layout.geometry.locationLabel.w }}
      >
        {locationLabel}
      </div>
      <div
        className="pb-title-line"
        style={{ left: layout.geometry.titleLine.x, top: layout.geometry.titleLine.y, width: layout.geometry.titleLine.w }}
      >
        {titleLine}
      </div>
      <div className="pb-ending-line" style={{ left: layout.geometry.ending.x, top: layout.geometry.ending.y, width: layout.geometry.ending.w }}>
        {endingText}
      </div>
      {layout.style.stickerCount >= 1 && (
        <span className="pb-sticker" style={{ left: layout.geometry.sticker1.x, top: layout.geometry.sticker1.y }}>
          {layout.geometry.sticker1.emoji}
        </span>
      )}
      {layout.style.stickerCount >= 2 && (
        <span className="pb-sticker" style={{ left: layout.geometry.sticker2.x, top: layout.geometry.sticker2.y }}>
          {layout.geometry.sticker2.emoji}
        </span>
      )}
    </div>
  )

  const exportRefs = useRef([])
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState('')

  const safeActiveIndex = Math.min(Math.max(activeViewportIndex, 0), VIEWPORT_COUNT - 1)

  async function handleExportCurrent() {
    if (exporting) return
    setExporting(true)
    setExportMessage('')
    try {
      await exportPanoramaViewport(exportRefs.current[safeActiveIndex], destination, safeActiveIndex)
      setExportMessage('현재 게시물을 저장했어요.')
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
    const results = await exportAllPanoramaViewports(exportRefs.current, destination)
    setExporting(false)
    const failures = results.filter((result) => !result.ok).map((result) => result.index + 1)
    setExportMessage(
      failures.length > 0 ? `${failures.join(', ')}번 게시물 저장에 실패했습니다.` : '3장을 모두 저장했어요.'
    )
  }

  function handleChangePreset() {
    const currentIndex = PANORAMA_PRESETS.indexOf(preset)
    onChangePreset(PANORAMA_PRESETS[(currentIndex + 1) % PANORAMA_PRESETS.length])
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          레이아웃: <span className="font-semibold text-gray-700">{PANORAMA_PRESET_LABELS[layout.preset]}</span>
        </p>
        <button
          type="button"
          onClick={handleChangePreset}
          className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700"
        >
          레이아웃 바꾸기
        </button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChangeViewMode('connected')}
          className={`rounded-lg py-2 text-sm font-medium ${
            viewMode === 'connected' ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700'
          }`}
        >
          이어서 보기
        </button>
        <button
          type="button"
          onClick={() => onChangeViewMode('single')}
          className={`rounded-lg py-2 text-sm font-medium ${
            viewMode === 'single' ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700'
          }`}
        >
          한 장씩 보기
        </button>
      </div>

      <PanoramaPreview
        boardContent={boardContent}
        viewMode={viewMode}
        activeViewportIndex={safeActiveIndex}
        onChangeActiveViewportIndex={onChangeActiveViewportIndex}
      />

      {/* 내보내기 전용 숨김 노드: 검은 구분선·버튼 없이 1080×1350 원본 크기 뷰포트만 담는다. */}
      <div style={{ position: 'fixed', left: -99999, top: 0, pointerEvents: 'none' }} aria-hidden="true">
        {Array.from({ length: VIEWPORT_COUNT }, (_, segmentIndex) => (
          <PanoramaViewport
            key={segmentIndex}
            segmentIndex={segmentIndex}
            displayScale={1}
            viewportRef={(node) => {
              exportRefs.current[segmentIndex] = node
            }}
            className="pb-paper"
          >
            {boardContent}
          </PanoramaViewport>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleExportCurrent}
          disabled={exporting}
          className="rounded-lg border border-blue-300 py-2 text-xs font-medium text-blue-700 disabled:opacity-40"
        >
          현재 게시물 저장
        </button>
        <button
          type="button"
          onClick={handleExportAll}
          disabled={exporting}
          className="rounded-lg border border-blue-300 py-2 text-xs font-medium text-blue-700 disabled:opacity-40"
        >
          전체 3장 저장
        </button>
      </div>
      {exporting && <p className="mt-1 text-center text-[11px] text-gray-400">이미지를 저장하는 중...</p>}
      {!exporting && exportMessage && <p className="mt-1 text-center text-[11px] text-gray-500">{exportMessage}</p>}
    </div>
  )
}

export default PanoramaDiary
