import {
  DEFAULT_PHOTO_STYLE,
  MAX_PHOTO_ZOOM,
  MIN_PHOTO_ZOOM,
  PHOTO_FILTERS,
  PHOTO_FILTER_LABELS,
  PHOTO_POSITIONS,
  PHOTO_POSITION_LABELS,
  clampZoom,
  getPhotoStyle,
  photoImageStyle,
} from '../../utils/photoStyle'

// 완전한 사진 편집기는 아니고, 사진별로 필터·표시 위치·확대 비율만 고를 수 있는
// 최소한의 스타일 패널이다. 원본 파일은 절대 변경하지 않고 표시에만 적용된다.
function PhotoStyleControls({ photos, photoStyles, onChangeStyle }) {
  if (!photos || photos.length === 0) return null

  return (
    <details className="rounded-lg border border-gray-200 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-gray-900">사진 꾸미기</summary>
      <div className="mt-3 space-y-3">
        {photos.map((photo, index) => {
          const style = getPhotoStyle(photoStyles, index) || DEFAULT_PHOTO_STYLE
          return (
            <div key={photo.previewUrl} className="flex gap-2 rounded-lg border border-gray-100 p-2">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded">
                <img src={photo.previewUrl} alt={`사진 ${index + 1}`} className="h-full w-full object-cover" style={photoImageStyle(style)} />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 text-[11px]">
                <div className="flex flex-wrap gap-1">
                  {PHOTO_FILTERS.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => onChangeStyle(index, 'filter', filter)}
                      className={`rounded border px-1.5 py-0.5 ${
                        style.filter === filter ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600'
                      }`}
                    >
                      {PHOTO_FILTER_LABELS[filter]}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400">위치</span>
                  {PHOTO_POSITIONS.map((position) => (
                    <button
                      key={position}
                      type="button"
                      onClick={() => onChangeStyle(index, 'position', position)}
                      className={`rounded border px-1.5 py-0.5 ${
                        style.position === position ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600'
                      }`}
                    >
                      {PHOTO_POSITION_LABELS[position]}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 text-gray-400">확대</span>
                  <input
                    type="range"
                    min={MIN_PHOTO_ZOOM}
                    max={MAX_PHOTO_ZOOM}
                    step="0.05"
                    value={style.zoom}
                    onChange={(event) => onChangeStyle(index, 'zoom', clampZoom(event.target.value))}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </details>
  )
}

export default PhotoStyleControls
