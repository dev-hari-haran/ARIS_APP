// ─── Real-Time Weather Service (Open-Meteo API) ──────────────────────────────
// Fetches live satellite & meteorological data (no API key required, global coverage)

export type WeatherCondition = {
  label: string
  icon: string
}

export function getWeatherCondition(code: number): WeatherCondition {
  switch (code) {
    case 0:
      return { label: 'Clear Sky', icon: '☀️' }
    case 1:
      return { label: 'Mainly Clear', icon: '🌤️' }
    case 2:
      return { label: 'Partly Cloudy', icon: '⛅' }
    case 3:
      return { label: 'Overcast', icon: '☁️' }
    case 45:
    case 48:
      return { label: 'Foggy', icon: '🌫️' }
    case 51:
    case 53:
    case 55:
      return { label: 'Drizzle', icon: '🌦️' }
    case 61:
    case 63:
    case 65:
      return { label: 'Rain', icon: '🌧️' }
    case 71:
    case 73:
    case 75:
      return { label: 'Snow', icon: '❄️' }
    case 80:
    case 81:
    case 82:
      return { label: 'Rain Showers', icon: '🌦️' }
    case 95:
    case 96:
    case 99:
      return { label: 'Thunderstorm', icon: '⛈️' }
    default:
      return { label: 'Partly Cloudy', icon: '⛅' }
  }
}

let cachedWeather: any = null
let lastFetchTime = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes cache

export async function fetchLiveWeather(
  latitude = 10.7870,
  longitude = 79.1378,
  forceRefresh = false
) {
  const now = Date.now()
  if (!forceRefresh && cachedWeather && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedWeather
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,direct_radiation,uv_index&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,direct_radiation,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max&timezone=auto`

  const response = await fetch(url, { headers: { 'User-Agent': 'ARIS-Farm-Intelligence/1.0' } })
  if (!response.ok) {
    throw new Error(`Weather API returned ${response.status}`)
  }

  const data = await response.json()
  const current = data.current
  const condition = getWeatherCondition(current.weather_code)

  // Format 7-Day Forecast
  const dailyForecast = (data.daily?.time ?? []).map((dateStr: string, index: number) => {
    const d = new Date(dateStr)
    const dayName = index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' })
    const dayCond = getWeatherCondition(data.daily.weather_code[index])
    return {
      date: dateStr,
      day: dayName,
      temp_max: Math.round(data.daily.temperature_2m_max[index]),
      temp_min: Math.round(data.daily.temperature_2m_min[index]),
      condition: dayCond.label,
      icon: dayCond.icon,
      rain_sum: data.daily.precipitation_sum[index],
      rain_prob: data.daily.precipitation_probability_max?.[index] ?? 0,
      uv_max: data.daily.uv_index_max[index],
      sunrise: data.daily.sunrise[index]?.slice(11, 16),
      sunset: data.daily.sunset[index]?.slice(11, 16),
    }
  })

  // Format 24-Hour Forecast
  const currentHourIndex = new Date().getHours()
  const hourlyForecast = (data.hourly?.time ?? [])
    .slice(currentHourIndex, currentHourIndex + 24)
    .map((timeStr: string, idx: number) => {
      const globalIdx = currentHourIndex + idx
      const hourCond = getWeatherCondition(data.hourly.weather_code[globalIdx])
      return {
        time: timeStr.slice(11, 16),
        temp: Math.round(data.hourly.temperature_2m[globalIdx]),
        humidity: data.hourly.relative_humidity_2m[globalIdx],
        rain_prob: data.hourly.precipitation_probability[globalIdx],
        wind_speed: Math.round(data.hourly.wind_speed_10m[globalIdx] * 10) / 10,
        condition: hourCond.label,
        icon: hourCond.icon,
      }
    })

  const formattedResult = {
    source: 'Open-Meteo Live Meteorological API',
    location: {
      name: 'Thanjavur, Tamil Nadu',
      latitude,
      longitude,
      elevation: data.elevation,
      timezone: data.timezone,
    },
    current: {
      temperature: current.temperature_2m,
      feels_like: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      wind_speed: current.wind_speed_10m,
      wind_direction: current.wind_direction_10m,
      pressure: current.surface_pressure,
      solar_radiation: current.direct_radiation,
      uv_index: current.uv_index,
      precipitation: current.precipitation,
      rain: current.rain,
      is_day: current.is_day === 1,
      condition: condition.label,
      icon: condition.icon,
      weather_code: current.weather_code,
      updated_at: current.time,
    },
    daily: dailyForecast,
    hourly: hourlyForecast,
    cached_at: new Date().toISOString(),
  }

  cachedWeather = formattedResult
  lastFetchTime = now
  return formattedResult
}
