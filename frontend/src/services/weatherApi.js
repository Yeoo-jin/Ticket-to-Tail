import { postJson } from './apiClient'

export function checkWeatherForecast(destination) {
  return postJson('/api/weather/forecast', { destination })
}
