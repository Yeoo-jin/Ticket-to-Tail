import { POSTER_FONTS, POSTER_FONT_LABELS, POSTER_FONT_STACKS } from '../../utils/posterFonts'

function FontSelector({ font, onChangeFont }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {POSTER_FONTS.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChangeFont(value)}
          style={{ fontFamily: POSTER_FONT_STACKS[value] }}
          className={`rounded-lg border py-2 text-xs ${
            font === value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'
          }`}
        >
          {POSTER_FONT_LABELS[value]}
        </button>
      ))}
    </div>
  )
}

export default FontSelector
