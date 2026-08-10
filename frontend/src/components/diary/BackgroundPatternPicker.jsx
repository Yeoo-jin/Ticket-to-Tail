import {
  BACKGROUND_PATTERNS,
  BACKGROUND_PATTERN_LABELS,
  DEFAULT_PATTERN_COLOR,
  DOT_SHAPES,
  DOT_SHAPE_LABELS,
  MAX_CHECK_SPACING,
  MAX_DOT_SIZE,
  MIN_CHECK_SPACING,
  MIN_DOT_SIZE,
} from '../../utils/backgroundPattern'
import BackgroundColorPicker from './BackgroundColorPicker'

// 배경 패턴(단색/도트/체크) 선택 + 단색이 아닐 때만 패턴 색상 선택기를 함께 보여준다.
// 도트를 고르면 모양(동그라미/정사각형)·크기를, 체크를 고르면 줄 간격을 추가로 조절할 수 있다.
function BackgroundPatternPicker({
  pattern,
  onChangePattern,
  patternColor,
  onChangePatternColor,
  dotSize,
  onChangeDotSize,
  dotShape,
  onChangeDotShape,
  checkSpacing,
  onChangeCheckSpacing,
}) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {BACKGROUND_PATTERNS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChangePattern(value)}
            className={`rounded-lg border py-2 text-xs ${
              pattern === value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'
            }`}
          >
            {BACKGROUND_PATTERN_LABELS[value]}
          </button>
        ))}
      </div>

      {pattern !== 'solid' && (
        <div className="mt-2">
          <p className="mb-1.5 text-[11px] text-gray-500">패턴 색상</p>
          <BackgroundColorPicker
            color={patternColor}
            onChangeColor={onChangePatternColor}
            defaultColor={DEFAULT_PATTERN_COLOR}
            resetLabel="기본 패턴색으로"
          />
        </div>
      )}

      {pattern === 'dot' && (
        <div className="mt-2 space-y-2">
          <div>
            <p className="mb-1.5 text-[11px] text-gray-500">도트 모양</p>
            <div className="grid grid-cols-2 gap-2">
              {DOT_SHAPES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChangeDotShape(value)}
                  className={`rounded-lg border py-1.5 text-xs ${
                    dotShape === value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'
                  }`}
                >
                  {DOT_SHAPE_LABELS[value]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] text-gray-500">도트 크기: {dotSize}</p>
            <input
              type="range"
              min={MIN_DOT_SIZE}
              max={MAX_DOT_SIZE}
              value={dotSize}
              onChange={(event) => onChangeDotSize(Number(event.target.value))}
              className="w-full"
            />
          </div>
        </div>
      )}

      {pattern === 'check' && (
        <div className="mt-2">
          <p className="mb-1.5 text-[11px] text-gray-500">체크 간격: {checkSpacing}</p>
          <input
            type="range"
            min={MIN_CHECK_SPACING}
            max={MAX_CHECK_SPACING}
            value={checkSpacing}
            onChange={(event) => onChangeCheckSpacing(Number(event.target.value))}
            className="w-full"
          />
        </div>
      )}
    </div>
  )
}

export default BackgroundPatternPicker
