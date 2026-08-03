import { BACKGROUND_CAPTION_PRESETS } from '../../utils/panoramaLayouts'

const TEXT_ALIGN_OPTIONS = [
  { value: 'left', label: '왼쪽' },
  { value: 'center', label: '가운데' },
  { value: 'right', label: '오른쪽' },
]

// 배경 위 독립 글귀(최대 3개) 수정 UI. 각 글귀는 고정 위치 프리셋(왼쪽 위/경계 위/오른쪽 아래)
// 하나를 차지하며, 텍스트·정렬·표시 여부를 사용자가 직접 바꿀 수 있다.
function BackgroundCaptionEditor({ captions, onChangeCaption }) {
  if (!captions || captions.length === 0) return null

  return (
    <details className="rounded-lg border border-gray-200 p-3" open>
      <summary className="cursor-pointer text-sm font-semibold text-gray-900">배경 글귀 수정</summary>
      <div className="mt-3 space-y-3">
        {captions.map((caption) => {
          const preset = BACKGROUND_CAPTION_PRESETS.find((p) => p.id === caption.presetId)
          return (
            <div key={caption.presetId} className="space-y-1.5 rounded border border-gray-100 p-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-gray-500">{preset?.label || caption.presetId}</span>
                <label className="flex items-center gap-1 text-[11px] text-gray-500">
                  <input
                    type="checkbox"
                    checked={caption.visible}
                    onChange={(event) => onChangeCaption(caption.presetId, { visible: event.target.checked })}
                  />
                  표시
                </label>
              </div>
              <input
                type="text"
                value={caption.text}
                onChange={(event) => onChangeCaption(caption.presetId, { text: event.target.value })}
                placeholder="배경에 표시할 짧은 글귀 (선택)"
                className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
              />
              <div className="flex gap-1">
                {TEXT_ALIGN_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onChangeCaption(caption.presetId, { textAlign: option.value })}
                    className={`rounded border px-2 py-0.5 text-[11px] ${
                      caption.textAlign === option.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 text-gray-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </details>
  )
}

export default BackgroundCaptionEditor
