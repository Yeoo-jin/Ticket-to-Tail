import { DIARY_THEMES, DIARY_THEME_DESCRIPTIONS, DIARY_THEME_LABELS } from '../../utils/diaryTheme'

function ThemeSwitcher({ theme, onChangeTheme }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {DIARY_THEMES.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChangeTheme(value)}
          className={`rounded-lg border p-2 text-left ${
            theme === value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'
          }`}
        >
          <p className="text-xs font-semibold">{DIARY_THEME_LABELS[value]}</p>
          <p className="mt-0.5 text-[10px] text-gray-500">{DIARY_THEME_DESCRIPTIONS[value]}</p>
        </button>
      ))}
    </div>
  )
}

export default ThemeSwitcher
