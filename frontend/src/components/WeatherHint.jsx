import { useEffect, useState } from 'react'
import { checkWeatherForecast } from '../services/weatherApi'

// 목적지가 바뀌고 잠시 멈추면(500ms) 날씨를 조회해 참고용으로 보여준다. 추천 로직 자체는
// 건드리지 않고 안내만 하며, 지원하지 않는 지역이나 조회 실패 시에는 조용히 아무것도 안 보여준다.
function WeatherHint({ destination }) {
  const [forecast, setForecast] = useState(null)

  useEffect(() => {
    setForecast(null)
    const trimmed = (destination || '').trim()
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
      {(destination || '').trim()} 날씨: {forecast.sky} (기온 {forecast.temperature}℃)
      {forecast.precipitationExpected && ' · 비 소식이 있어요. 실내 관광지도 고려해보세요.'}
    </p>
  )
}

export default WeatherHint
