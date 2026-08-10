import { useEffect, useState } from 'react'
import ErrorMessage from '../../components/ErrorMessage'
import { COMPANION_TYPES } from '../../utils/companionTypes'
import { checkWeatherForecast } from '../../services/weatherApi'

// 목적지 입력이 잠시 멈추면(500ms) 날씨를 조회해 참고용으로 보여준다. 추천 로직 자체는
// 건드리지 않고 안내만 하며, 지원하지 않는 지역이나 조회 실패 시에는 조용히 아무것도 안 보여준다.
function WeatherHint({ destination }) {
  const [forecast, setForecast] = useState(null)

  useEffect(() => {
    setForecast(null)
    const trimmed = destination.trim()
    if (!trimmed) return undefined

    let cancelled = false
    const timer = setTimeout(() => {
      checkWeatherForecast(trimmed)
        .then((data) => {
          if (!cancelled) setForecast(data)
        })
        .catch(() => {
          if (!cancelled) setForecast(null)
        })
    }, 500)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [destination])

  if (!forecast || !forecast.found) return null

  return (
    <p className={`mt-2 text-xs ${forecast.precipitationExpected ? 'text-blue-700' : 'text-gray-500'}`}>
      {destination.trim()} 날씨: {forecast.sky} (기온 {forecast.temperature}℃)
      {forecast.precipitationExpected && ' · 비 소식이 있어요. 실내 관광지도 고려해보세요.'}
    </p>
  )
}

function CompanionSelectStep({
  destination,
  onChangeDestination,
  selectedCompanionTypes,
  onToggleCompanionType,
  onSubmit,
  loading,
  error,
  onBack,
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900">🧑‍🤝‍🧑 동행 조건 선택</h2>
      <p className="mt-1 text-sm text-gray-500">함께 여행하는 동행자의 특성을 선택해주세요. (복수 선택 가능)</p>

      <label className="mt-3 block text-sm text-gray-700">
        여행 목적지
        <input
          className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-[#1a1a1a] focus:outline-none"
          value={destination}
          onChange={(event) => onChangeDestination(event.target.value)}
          placeholder="예: 부산"
        />
      </label>
      <p className="mt-1 text-xs text-gray-400">
        예매정보에서 자동으로 추정한 값이에요. 실제 목적지와 다르면 직접 수정해주세요.
      </p>
      <WeatherHint destination={destination} />

      <div className="mt-3 grid grid-cols-2 gap-2">
        {COMPANION_TYPES.map((type) => {
          const active = selectedCompanionTypes.includes(type.value)
          return (
            <button
              key={type.value}
              type="button"
              onClick={() => onToggleCompanionType(type.value)}
              className={`rounded-lg border px-3 py-2 text-sm ${
                active ? 'border-[#1a1a1a] bg-[#f3ece2] text-[#1a1a1a]' : 'border-gray-300 text-gray-700'
              }`}
            >
              {type.label}
            </button>
          )
        })}
      </div>

      <ErrorMessage message={error} />

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm text-gray-700"
        >
          이전
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || !destination.trim() || selectedCompanionTypes.length === 0}
          className="flex-1 rounded-lg bg-[#1a1a1a] py-2.5 text-sm text-white disabled:opacity-40"
        >
          {loading ? '추천받는 중...' : '관광지 추천받기'}
        </button>
      </div>
    </section>
  )
}

export default CompanionSelectStep
