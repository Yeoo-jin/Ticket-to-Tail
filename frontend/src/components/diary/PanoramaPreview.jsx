import { useState } from 'react'
import { VIEWPORT_COUNT } from '../../utils/panoramaLayouts'
import PanoramaViewport from './PanoramaViewport'

const SEGMENTS = Array.from({ length: VIEWPORT_COUNT }, (_, i) => i)

const CONNECTED_SEGMENT_WIDTH = 108
const CONNECTED_SEGMENT_WIDTH_ZOOMED = 260
const SINGLE_VIEW_WIDTH = 320
const THUMBNAIL_WIDTH = 60

// "이어서 보기"(3장을 나란히, 검은 구분선 포함)와 "한 장씩 보기"(4:5 카드 1장 + 이전/다음)를
// 전환한다. 두 모드 모두 같은 boardContent를 PanoramaViewport에 그대로 넘기므로
// 실제로 화면에 보이는 것은 항상 같은 master board를 다르게 잘라 보여주는 것뿐이다.
function PanoramaPreview({ boardContent, viewMode, activeViewportIndex, onChangeActiveViewportIndex }) {
  const [zoomed, setZoomed] = useState(false)
  const safeIndex = Math.min(Math.max(activeViewportIndex, 0), VIEWPORT_COUNT - 1)

  if (viewMode === 'connected') {
    const segmentWidth = zoomed ? CONNECTED_SEGMENT_WIDTH_ZOOMED : CONNECTED_SEGMENT_WIDTH
    const scale = segmentWidth / 1080

    return (
      <div>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <div className="inline-flex bg-black">
            {SEGMENTS.map((segmentIndex) => (
              <div key={segmentIndex} className="flex">
                <PanoramaViewport segmentIndex={segmentIndex} displayScale={scale} className="pb-paper">
                  {boardContent}
                </PanoramaViewport>
                {segmentIndex < SEGMENTS.length - 1 && <div className="pb-divider" />}
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setZoomed((prev) => !prev)}
          className="mt-2 text-xs font-medium text-blue-700 underline"
        >
          {zoomed ? '축소해서 보기' : '전체 보기 확대'}
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-center">
        <PanoramaViewport
          segmentIndex={safeIndex}
          displayScale={SINGLE_VIEW_WIDTH / 1080}
          className="rounded-lg border border-gray-200 pb-paper"
        >
          {boardContent}
        </PanoramaViewport>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <button
          type="button"
          onClick={() => onChangeActiveViewportIndex(safeIndex - 1)}
          disabled={safeIndex === 0}
          className="rounded-full border border-gray-300 px-3 py-1 disabled:opacity-30"
        >
          이전
        </button>
        <span className="font-medium text-gray-700">
          {safeIndex + 1} / {VIEWPORT_COUNT}
        </span>
        <button
          type="button"
          onClick={() => onChangeActiveViewportIndex(safeIndex + 1)}
          disabled={safeIndex === VIEWPORT_COUNT - 1}
          className="rounded-full border border-gray-300 px-3 py-1 disabled:opacity-30"
        >
          다음
        </button>
      </div>

      <div className="mt-2 flex justify-center gap-2">
        {SEGMENTS.map((segmentIndex) => (
          <button
            key={segmentIndex}
            type="button"
            onClick={() => onChangeActiveViewportIndex(segmentIndex)}
            className={`overflow-hidden rounded border ${
              segmentIndex === safeIndex ? 'border-blue-500 ring-1 ring-blue-400' : 'border-gray-300 opacity-70'
            }`}
          >
            <PanoramaViewport segmentIndex={segmentIndex} displayScale={THUMBNAIL_WIDTH / 1080} className="pb-paper">
              {boardContent}
            </PanoramaViewport>
          </button>
        ))}
      </div>
    </div>
  )
}

export default PanoramaPreview
