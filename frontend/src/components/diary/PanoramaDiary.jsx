import { useEffect, useMemo, useRef, useState } from 'react'
import { autoTextColor, normalizeHexColor } from '../../utils/backgroundColor'
import { backgroundPatternRotation, backgroundPatternStyle } from '../../utils/backgroundPattern'
import { truncateAtWordBoundary } from '../../utils/memoDistribution'
import {
  BACKGROUND_CAPTION_PRESETS,
  BOARD_HEIGHT,
  MAX_PANORAMA_PHOTOS,
  SPLIT_COUNTS,
  getBackgroundCaptionX,
  getPanoramaLayout,
} from '../../utils/panoramaLayouts'
import { getPhotoStyle } from '../../utils/photoStyle'
import { posterFontStack } from '../../utils/posterFonts'
import PanoramaExportPanel from './PanoramaExportPanel'
import PanoramaPreview from './PanoramaPreview'
import PanoramaViewport from './PanoramaViewport'
import PolaroidPhoto from './PolaroidPhoto'

const POLAROID_CAPTION_MAX_CHARS = 40
const BACKGROUND_CAPTION_MAX_CHARS = 60

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function BackgroundCaptionText({ caption, boardWidth, fontFamily, fontSize, color }) {
  if (!caption.visible || !caption.text) return null
  const preset = BACKGROUND_CAPTION_PRESETS.find((p) => p.id === caption.presetId)
  const x = getBackgroundCaptionX(caption.presetId, boardWidth, caption.textAlign)
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
// 저장·공유(Blob/File, iPhone 대응 포함)는 PanoramaExportPanel이 전담한다.
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
  backgroundPattern,
  patternColor,
  dotSize,
  dotShape,
  checkSpacing,
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
  const patternStyle = backgroundPatternStyle(backgroundPattern, patternColor, { dotSize, dotShape, checkSpacing })
  const patternRotation = backgroundPatternRotation(backgroundPattern)
  // 보드는 정사각형이 아니라 가로로 매우 긴 직사각형(너비 3240~4320 × 높이 1350)이라,
  // "가로·세로 각각 2배"로 덮는 방식은 회전 시 특정 모서리(예: 오른쪽 위·왼쪽 아래)를
  // 빈 채로 남길 수 있다. 대신 보드 대각선보다 한 변이 큰 "정사각형"을 중앙에 두면, 정사각형은
  // 어떤 각도로 돌려도 자신의 내접원(반지름 = 한 변의 절반)을 항상 포함하므로, 그 내접원이
  // 보드의 대각선 절반(= 가장 먼 모서리까지의 거리)보다 크기만 하면 회전 각도와 무관하게
  // 네 모서리를 포함한 보드 전체를 항상 덮는다는 것이 보장된다.
  const patternOverlaySize = Math.ceil(Math.sqrt(layout.boardWidth ** 2 + BOARD_HEIGHT ** 2)) + 40
  const patternOverlayLeft = (layout.boardWidth - patternOverlaySize) / 2
  const patternOverlayTop = (BOARD_HEIGHT - patternOverlaySize) / 2

  // photosForBoard만 다르고 나머지는 동일한 board를 만든다. 화면 미리보기(boardContent)는
  // 가벼운 blob: URL을 그대로 쓰고, 내보내기용(exportBoardContent)은 base64 data: URL을 쓴다
  // (아래 exportPhotos 설명 참고 — html-to-image가 사진을 못 읽어오는 문제를 근본적으로 피하기 위함).
  function renderBoard(photosForBoard) {
    return (
      <div className="relative h-full w-full overflow-hidden" style={{ backgroundColor: resolvedBackgroundColor }}>
        {backgroundPattern && backgroundPattern !== 'solid' && (
          // 회전은 이 레이어에만 적용되므로 사진·글귀 등 다른 내용은 그대로 수평을 유지한다.
          <div className="absolute inset-0" style={{ overflow: 'hidden' }} aria-hidden="true">
            <div
              style={{
                position: 'absolute',
                left: patternOverlayLeft,
                top: patternOverlayTop,
                width: patternOverlaySize,
                height: patternOverlaySize,
                transform: patternRotation ? `rotate(${patternRotation}deg)` : undefined,
                ...patternStyle,
              }}
            />
          </div>
        )}

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
            photo={photosForBoard[slot.photoIndex]}
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
      </div>
    )
  }

  const boardContent = renderBoard(photos)

  // 내보내기(저장·공유) 전용 사진 URL. 화면 미리보기는 사진을 blob: URL로 보여주는데,
  // html-to-image는 저장 시 각 <img>를 다시 fetch해서 embed하는 과정에서 (1) 실패한 fetch
  // 결과를 내부적으로 영구 캐시해버리는 버그와 (2) Safari(특히 iOS)의 blob: URL fetch 자체가
  // 불안정한 문제가 겹쳐, 화면엔 사진이 정상 표시돼도 저장된 이미지에만 사진이 빠지는 경우가
  // 있었다. data: URL(base64)은 html-to-image가 애초에 다시 fetch하지 않고 그대로 쓰므로
  // 이 문제를 구조적으로 피할 수 있다. 원본 File을 직접 읽어 변환한다(blob: URL을 다시 fetch하지 않음).
  const [exportPhotoDataUrls, setExportPhotoDataUrls] = useState([])
  useEffect(() => {
    let cancelled = false
    if (photos.length === 0) {
      setExportPhotoDataUrls([])
      return undefined
    }
    Promise.all(photos.map((photo) => readAsDataUrl(photo.file)))
      .then((urls) => {
        if (!cancelled) setExportPhotoDataUrls(urls)
      })
      .catch(() => {
        if (!cancelled) setExportPhotoDataUrls([])
      })
    return () => {
      cancelled = true
    }
  }, [photos])

  const exportPhotosReady = photos.length === 0 || exportPhotoDataUrls.length === photos.length
  const exportPhotos = photos.map((photo, index) => ({
    ...photo,
    previewUrl: exportPhotoDataUrls[index] || photo.previewUrl,
  }))
  const exportBoardContent = renderBoard(exportPhotos)

  // 내보내기용 숨김 노드는 splitCount(최대 4개)+전체보드까지 한꺼번에 계속 떠 있으면
  // 사진이 있는 board 사본이 화면에 3~5장 동시에 존재하게 되어 모바일에서 메모리 부담이 크다.
  // 그래서 실제로 저장 버튼을 누른 그 순간에만 필요한 조각 하나만 마운트하고, 캡처가 끝나면
  // 바로 언마운트한다(captureRequest가 null이면 아무것도 렌더링하지 않음).
  const [captureRequest, setCaptureRequest] = useState(null)
  const captureNodeRef = useRef(null)
  const captureResolversRef = useRef([])

  function requestCaptureNode(request) {
    return new Promise((resolve) => {
      captureResolversRef.current.push(resolve)
      setCaptureRequest(request)
    })
  }

  function releaseCaptureNode() {
    captureNodeRef.current = null
    setCaptureRequest(null)
  }

  function handleCaptureRef(node) {
    captureNodeRef.current = node
    if (node && captureResolversRef.current.length > 0) {
      const resolvers = captureResolversRef.current
      captureResolversRef.current = []
      resolvers.forEach((resolve) => resolve(node))
    }
  }

  const safeActiveIndex = Math.min(Math.max(activeViewportIndex, 0), layout.splitCount - 1)

  // 준비된 저장용 파일이 최신 상태를 반영하는지 판단하는 키. 배경색·폰트·글자 크기·글귀·
  // 사진별 필터가 하나라도 바뀌면 값이 달라져 PanoramaExportPanel이 "다시 준비해주세요"를 보여준다.
  const boardStateKey = useMemo(
    () =>
      [
        resolvedBackgroundColor,
        backgroundPattern,
        patternColor,
        dotSize,
        dotShape,
        checkSpacing,
        font,
        polaroidCaptionSize,
        backgroundTextSize,
        JSON.stringify(photoCaptions),
        JSON.stringify(backgroundCaptions),
        JSON.stringify(photoStyles),
        photos.map((photo) => photo.previewUrl).join(','),
      ].join('|'),
    [
      resolvedBackgroundColor,
      backgroundPattern,
      patternColor,
      dotSize,
      dotShape,
      checkSpacing,
      font,
      polaroidCaptionSize,
      backgroundTextSize,
      photoCaptions,
      backgroundCaptions,
      photoStyles,
      photos,
    ]
  )

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

      {/* 내보내기 전용 숨김 노드: 저장 버튼을 누른 순간에만 필요한 조각 하나만 마운트한다
          (바로 위 captureRequest 설명 참고). 크기 0(width:0/height:0) 또는 화면 밖 멀리
          (left:-99999px) 배치하는 방식은 모두 Safari(특히 iOS)가 "보이지 않는다"고 판단해
          그 안의 <img> 사진 로딩·디코딩을 건너뛰는 경우가 보고되어 있어(텍스트·배경은 SVG로
          직접 그려져 정상, 사진만 빈 칸으로 나오는 것과 일치), 실제 크기(1080×1350 등)는
          그대로 유지한 채 opacity:0 + z-index로만 안 보이게 한다. position:fixed를 쓰는 이유는
          absolute면 문서 흐름상 스크롤 가능한 영역에 영향을 줄 수 있기 때문이다. */}
      <div
        style={{ position: 'fixed', top: 0, left: 0, opacity: 0, zIndex: -1, pointerEvents: 'none' }}
        aria-hidden="true"
      >
        {captureRequest?.kind === 'segment' && (
          <PanoramaViewport
            key={captureRequest.segmentIndex}
            segmentIndex={captureRequest.segmentIndex}
            boardWidth={layout.boardWidth}
            displayScale={1}
            viewportRef={handleCaptureRef}
          >
            {exportBoardContent}
          </PanoramaViewport>
        )}
        {captureRequest?.kind === 'full' && (
          <div ref={handleCaptureRef} style={{ width: layout.boardWidth, height: 1350, position: 'relative' }}>
            {exportBoardContent}
          </div>
        )}
      </div>

      <div className="mt-3">
        <PanoramaExportPanel
          requestCaptureNode={requestCaptureNode}
          releaseCaptureNode={releaseCaptureNode}
          splitCount={layout.splitCount}
          activeViewportIndex={safeActiveIndex}
          destination={destination}
          boardStateKey={boardStateKey}
          photosReady={exportPhotosReady}
        />
      </div>
    </div>
  )
}

export default PanoramaDiary
