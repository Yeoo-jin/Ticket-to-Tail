import { useState } from 'react'
import { DEFAULT_BACKGROUND_COLOR, normalizeHexColor } from '../../utils/backgroundColor'

// 자유 배경색 선택: 실제 컬러판(input type="color") + HEX 직접 입력.
// 어떤 색이든 그대로 반영하고(파스텔로 강제 변환하지 않음), 잘못된 HEX는 반영하지 않고 안내만 표시한다.
// 배경 패턴 색상 선택에도 그대로 재사용하므로, 기본값·리셋 라벨은 props로 바꿀 수 있게 한다
// (미지정 시 기존 배경색 선택 동작과 동일).
function BackgroundColorPicker({
  color,
  onChangeColor,
  defaultColor = DEFAULT_BACKGROUND_COLOR,
  resetLabel = '기본 배경으로',
}) {
  const [hexInput, setHexInput] = useState(color)
  const [error, setError] = useState('')

  function handlePickerChange(event) {
    const value = event.target.value.toUpperCase()
    setHexInput(value)
    setError('')
    onChangeColor(value)
  }

  function handleHexInputChange(event) {
    setHexInput(event.target.value)
  }

  function commitHexInput() {
    const normalized = normalizeHexColor(hexInput)
    if (!normalized) {
      setError('올바른 #RRGGBB 형식의 색상 코드를 입력해주세요.')
      return
    }
    setError('')
    setHexInput(normalized)
    onChangeColor(normalized)
  }

  function handleReset() {
    setHexInput(defaultColor)
    setError('')
    onChangeColor(defaultColor)
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={normalizeHexColor(color) || defaultColor}
          onChange={handlePickerChange}
          className="h-8 w-10 shrink-0 cursor-pointer rounded border border-gray-300"
          aria-label="배경색 선택"
        />
        <input
          type="text"
          value={hexInput}
          onChange={handleHexInputChange}
          onBlur={commitHexInput}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitHexInput()
          }}
          placeholder={defaultColor}
          className="w-24 rounded border border-gray-300 px-2 py-1 text-xs uppercase text-gray-700"
        />
        <button
          type="button"
          onClick={handleReset}
          className="shrink-0 rounded-full border border-gray-300 px-2.5 py-1 text-[11px] text-gray-600"
        >
          {resetLabel}
        </button>
      </div>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  )
}

export default BackgroundColorPicker
