import { useMemo, useRef, useState } from 'react'
import { autoTextColor, normalizeHexColor } from '../../utils/backgroundColor'
import { truncateAtWordBoundary } from '../../utils/memoDistribution'
import {
  BACKGROUND_CAPTION_PRESETS,
  MAX_PANORAMA_PHOTOS,
  SPLIT_COUNTS,
  getBackgroundCaptionX,
  getPanoramaLayout,
} from '../../utils/panoramaLayouts'
import { exportAllPanoramaViewports, exportFullBoard, exportPanoramaViewport } from '../../utils/panoramaExport'
import { getPhotoStyle } from '../../utils/photoStyle'
import { posterFontStack } from '../../utils/posterFonts'
import PanoramaPreview from './PanoramaPreview'
import PanoramaViewport from './PanoramaViewport'
import PolaroidPhoto from './PolaroidPhoto'

const POLAROID_CAPTION_MAX_CHARS = 40
const BACKGROUND_CAPTION_MAX_CHARS = 60

function BackgroundCaptionText({ caption, boardWidth, fontFamily, fontSize, color }) {
  if (!caption.visible || !caption.text) return null
  const preset = BACKGROUND_CAPTION_PRESETS.find((p) => p.id === caption.presetId)
  const x = getBackgroundCaptionX(caption.presetId, boardWidth)
  const transform = caption.textAlign === 'center' ? 'translateX(-50%)' : caption.textAlign === 'right' ? 'translateX(-100%)' : 'none'

  return (
    <p
      className="pb-background-caption"
      style={{
        left: x,
        top: preset.y,
        width: preset.maxWidth,
        transform,
        textAlign: caption.textAlign,
        fontFamily,
        fontSize,
        color,
      }}
    >
      {truncateAtWordBoundary(caption.text, BACKGROUND_CAPTION_MAX_CHARS)}
    </p>
  )
}

// AI 다이어리 결과가 아니라 사용자가 직접 쓴 사진별 글귀 + 배경 글귀 + 업로드 사진을 하나의
// master board 콘텐츠로 엮는 오케스트레이터. "판(board)"은 이 컴포넌트가 한 번만 만들고,
// PanoramaViewport에게 여러 번(미리보기용 축소, 내보내기용 원본 크기) 그대로 넘겨 잘라 보여준다.
function PanoramaDiary({
  photos,
  photoStyles,
  destination,
  splitCount,
  onChangeSplitCount,
  viewMode,
  onChangeViewMode,
  activeViewportIndex,
  onChangeActiveViewportIndex,
  backgroundColor,
  font,
  polaroidCaptionSize,
  backgroundTextSize,
  photoCaptions,
  backgroundCaptions,
}) {
  const photoCount = Math.min(photos.length, MAX_PANORAMA_PHOTOS)
  const layout = useMemo(() => getPanoramaLayout({ splitCount, photoCount }), [splitCount, photoCount])

  const resolvedBackgroundColor = normalizeHexColor(backgroundColor) || backgroundColor
  const textColor = autoTextColor(resolvedBackgroundColor)
  const fontFamily = posterFontStack(font)

  const boardContent = (
    <div className="relative h-full w-full" style={{ backgroundColor: resolvedBackgroundColor }}>
      <div
        className="absolute inset-0"
        style={{ backgroundImage: 'radial-gradient(rgba(120,100,70,0.05) 1px, transparent 1px)', backgroundSize: '14px 14px' }}
      />

      {layout.photoSlots.map((slot) => (
        <PolaroidPhoto
          key={slot.photoIndex}
          x={slot.x}
          y={slot.y}
          width={slot.w}
          height={slot.h}
          photoH={slot.photoH}
          framePad={slot.framePad}
          rotation={slot.rotation}
          tape={slot.tape}
          photo={photos[slot.photoIndex]}
          photoStyle={getPhotoStyle(photoStyles, slot.photoIndex)}
          caption={truncateAtWordBoundary(photoCaptions[slot.photoIndex] || '', POLAROID_CAPTION_MAX_CHARS)}
          fontFamily={fontFamily}
          captionFontSize={polaroidCaptionSize}
        />
      ))}

      {backgroundCaptions.map((caption) => (
        <BackgroundCaptionText
          key={caption.presetId}
          caption={caption}
          boardWidth={layout.boardWidth}
          fontFamily={fontFamily}
          fontSize={backgroundTextSize}
          color={textColor}
        />
      ))}

      <span className="pb-sticker" style={{ left: layout.boardWidth - 140, top: 55 }}>
        ✈️
      </span>
      <span className="pb-sticker" style={{ left: 30, top: 1255 }}>
        🌿
      </span>
    </div>
  )

  const exportRefs = useRef([])
  const fullBoardRef = useRef(null)
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState('')

  const safeActiveIndex = Math.min(Math.max(activeViewportIndex, 0), layout.splitCount - 1)

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
    const results = await exportAllPanoramaViewports(exportRefs.current.slice(0, layout.splitCount), destination)
    setExporting(false)
    const failures = results.filter((result) => !result.ok).map((result) => result.index + 1)
    setExportMessage(
      failures.length > 0
        ? `${failures.join(', ')}번 게시물 저장에 실패했습니다.`
        : `${layout.splitCount}장을 모두 저장했어요.`
    )
  }

  async function handleExportFullBoard() {
    if (exporting) return
    setExporting(true)
    setExportMessage('')
    try {
      await exportFullBoard(fullBoardRef.current, destination)
      setExportMessage('전체 보드를 저장했어요.')
    } catch (error) {
      setExportMessage(error.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <div className="mb-3">
        <p className="mb-1.5 text-xs font-semibold text-gray-500">인스타 분할</p>
        <div className="grid grid-cols-2 gap-2">
          {SPLIT_COUNTS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChangeSplitCount(value)}
              className={`rounded-lg border p-2 text-left ${
                splitCount === value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'
              }`}
            >
              <p className="text-xs font-semibold">{value}장</p>
              <p className="mt-0.5 text-[10px] text-gray-500">
                {value === 3 ? '인스타 게시물 3장으로 연결' : '인스타 게시물 4장으로 연결'}
              </p>
            </button>
          ))}
        </div>
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
        boardWidth={layout.boardWidth}
        splitCount={layout.splitCount}
        viewMode={viewMode}
        activeViewportIndex={safeActiveIndex}
        onChangeActiveViewportIndex={onChangeActiveViewportIndex}
      />

      {/* 내보내기 전용 숨김 노드: 검은 구분선·버튼 없이 1080×1350 원본 크기 뷰포트만 담는다. */}
      <div style={{ position: 'fixed', left: -99999, top: 0, pointerEvents: 'none' }} aria-hidden="true">
        {Array.from({ length: layout.splitCount }, (_, segmentIndex) => (
          <PanoramaViewport
            key={segmentIndex}
            segmentIndex={segmentIndex}
            boardWidth={layout.boardWidth}
            displayScale={1}
            viewportRef={(node) => {
              exportRefs.current[segmentIndex] = node
            }}
          >
            {boardContent}
          </PanoramaViewport>
        ))}
        <div
          ref={fullBoardRef}
          style={{ width: layout.boardWidth, height: 1350, position: 'relative' }}
        >
          {boardContent}
        </div>
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
          전체 {layout.splitCount}장 저장
        </button>
      </div>
      <button
        type="button"
        onClick={handleExportFullBoard}
        disabled={exporting}
        className="mt-2 w-full rounded-lg border border-gray-300 py-2 text-xs font-medium text-gray-600 disabled:opacity-40"
      >
        전체 보드 PNG로 저장 (선택)
      </button>
      {exporting && <p className="mt-1 text-center text-[11px] text-gray-400">이미지를 저장하는 중...</p>}
      {!exporting && exportMessage && <p className="mt-1 text-center text-[11px] text-gray-500">{exportMessage}</p>}
    </div>
  )
}

export default PanoramaDiary
