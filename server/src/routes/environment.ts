// ─── Environment Routes ─────────────────────────────────────────────────────
import { Router } from 'express'
import { getDb } from '../db.js'
import { fetchLiveWeather } from '../weather.js'

const router = Router()

// GET /api/environment/weather — Live meteorological weather & 7-day forecast
router.get('/weather', async (req, res) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : 10.7870
    const lon = req.query.lon ? parseFloat(req.query.lon as string) : 79.1378
    const force = req.query.force === 'true'

    const weather = await fetchLiveWeather(lat, lon, force)
    res.json(weather)
  } catch (err) {
    console.error('Weather API error:', err)
    res.status(500).json({ error: 'Failed to fetch live weather data' })
  }
})

// POST /api/environment/weather/sync — Ingest real weather metrics into sensor readings
router.post('/weather/sync', async (req, res) => {
  try {
    const lat = req.body.lat ? parseFloat(req.body.lat) : 10.7870
    const lon = req.body.lon ? parseFloat(req.body.lon) : 79.1378

    const weather = await fetchLiveWeather(lat, lon, true)
    const db = getDb()
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)

    const insert = db.prepare(
      `INSERT INTO sensor_readings (sensor_type, value, unit, zone, created_at) VALUES (?, ?, ?, ?, ?)`
    )

    // Insert live atmospheric metrics from real satellite/weather feed
    insert.run('temperature', weather.current.temperature, '°C', 'field_a', ts)
    insert.run('humidity', weather.current.humidity, '%', 'field_a', ts)
    insert.run('wind', weather.current.wind_speed, 'km/h', 'field_a', ts)
    if (weather.current.solar_radiation !== undefined) {
      insert.run('light', Math.max(10, Math.round(weather.current.solar_radiation * 1.5)), 'lx', 'field_a', ts)
    }

    // Log activity
    db.prepare(
      `INSERT INTO activity_log (category, message) VALUES (?, ?)`
    ).run('sensor', `Weather feed synced · ${weather.current.condition} ${weather.current.temperature}°C`)

    res.json({
      success: true,
      message: 'Real-time weather synced with farm sensors',
      current: weather.current,
    })
  } catch (err) {
    console.error('Weather sync error:', err)
    res.status(500).json({ error: 'Failed to sync weather data' })
  }
})

// GET /api/environment/current — Latest readings for all sensors
router.get('/current', (_req, res) => {
  const db = getDb()

  const sensorTypes = ['temperature', 'humidity', 'light', 'wind']
  const readings: Record<string, any> = {}

  for (const type of sensorTypes) {
    const reading = db.prepare(
      `SELECT value, unit, created_at FROM sensor_readings 
       WHERE sensor_type = ? ORDER BY created_at DESC LIMIT 1`
    ).get(type) as { value: number; unit: string; created_at: string } | undefined

    readings[type] = reading ?? { value: 0, unit: type === 'temperature' ? '°C' : '%', created_at: null }
  }

  // Determine badges
  const temp = readings.temperature.value
  const humidity = readings.humidity.value

  res.json({
    readings: {
      temperature: {
        ...readings.temperature,
        formatted: `${readings.temperature.value} ${readings.temperature.unit}`,
        badge: temp <= 32 ? 'Normal' : 'High',
        variant: temp <= 32 ? 'yellow' : 'red',
      },
      humidity: {
        ...readings.humidity,
        formatted: `${readings.humidity.value} %`,
        badge: humidity >= 40 && humidity <= 80 ? 'Normal' : 'Alert',
        variant: humidity >= 40 && humidity <= 80 ? 'green' : 'yellow',
      },
      light: {
        ...readings.light,
        formatted: `${readings.light.value} lx`,
        badge: readings.light.value >= 200 ? 'Good' : 'Low',
        variant: 'green',
      },
      wind: {
        ...readings.wind,
        formatted: `${readings.wind.value} km/h`,
        badge: readings.wind.value <= 20 ? 'Safe' : 'Warning',
        variant: 'ghost',
      },
    },
  })
})

// GET /api/environment/history — Time-series sensor data
router.get('/history', (req, res) => {
  const db = getDb()
  const hours = parseInt(req.query.hours as string) || 24
  const sensorType = req.query.type as string

  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)

  if (sensorType) {
    const data = db.prepare(
      `SELECT value, unit, created_at FROM sensor_readings 
       WHERE sensor_type = ? AND created_at >= ? ORDER BY created_at ASC`
    ).all(sensorType, cutoff)

    return res.json({ type: sensorType, data })
  }

  // Return temp + humidity together (for the chart)
  const temps = db.prepare(
    `SELECT value, created_at FROM sensor_readings 
     WHERE sensor_type = 'temperature' AND created_at >= ? ORDER BY created_at ASC`
  ).all(cutoff) as { value: number; created_at: string }[]

  const humidities = db.prepare(
    `SELECT value, created_at FROM sensor_readings 
     WHERE sensor_type = 'humidity' AND created_at >= ? ORDER BY created_at ASC`
  ).all(cutoff) as { value: number; created_at: string }[]

  // Merge into chart-friendly format
  const chartData = temps.map((t, i) => ({
    time: new Date(t.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    temp: t.value,
    humidity: humidities[i]?.value ?? null,
  }))

  res.json({ chartData })
})

// GET /api/environment/alerts — Environmental alerts
router.get('/alerts', async (_req, res) => {
  const db = getDb()

  const latestTemp = db.prepare(
    `SELECT value FROM sensor_readings WHERE sensor_type = 'temperature' ORDER BY created_at DESC LIMIT 1`
  ).get() as { value: number } | undefined

  const latestHumidity = db.prepare(
    `SELECT value FROM sensor_readings WHERE sensor_type = 'humidity' ORDER BY created_at DESC LIMIT 1`
  ).get() as { value: number } | undefined

  const alerts = []

  // Heat stress alert
  if (latestTemp && latestTemp.value > 28) {
    alerts.push({
      title: 'Heat stress',
      sub: latestTemp.value > 32 ? 'Active — high solar load' : 'Moderate afternoon peak',
      bg: '#fefbe6',
      border: '#fae880',
    })
  }

  // Humidity alert
  alerts.push({
    title: 'Humidity balance',
    sub: latestHumidity ? (latestHumidity.value >= 40 && latestHumidity.value <= 80 ? 'Within optimal target (40-80%)' : 'Outside optimal target range') : 'No data',
    bg: '#f0f9dc',
    border: '#c4e89c',
  })

  // Live Rain probability from weather service
  try {
    const live = await fetchLiveWeather()
    const rainProb = live.daily?.[0]?.rain_prob ?? 0
    const rainSum = live.daily?.[0]?.rain_sum ?? 0
    alerts.push({
      title: 'Real-time rain forecast',
      sub: `${rainProb}% chance · ${rainSum} mm predicted today`,
      bg: '#eff6ff',
      border: '#bfdbfe',
    })
  } catch {
    alerts.push({
      title: 'Rain forecast',
      sub: 'Low precipitation expected',
      bg: '#eff6ff',
      border: '#bfdbfe',
    })
  }

  res.json({ alerts })
})

// GET /api/environment/sensor-health — Status of all sensors
router.get('/sensor-health', (_req, res) => {
  const db = getDb()

  const sensors = ['DHT22 (Temp/Hum)', 'BH1750 (Light)', 'Soil sensor', 'Water level', 'NPK Sensor', 'Open-Meteo Weather Feed']

  const sensorMap: Record<string, string> = {
    'DHT22 (Temp/Hum)': 'temperature',
    'BH1750 (Light)': 'light',
    'Soil sensor': 'soil_moisture',
    'Water level': 'water_level',
    'NPK Sensor': 'soil_moisture',
    'Open-Meteo Weather Feed': 'wind',
  }

  const now = Date.now()
  const result = sensors.map(name => {
    const type = sensorMap[name]
    const latest = db.prepare(
      `SELECT created_at FROM sensor_readings WHERE sensor_type = ? ORDER BY created_at DESC LIMIT 1`
    ).get(type) as { created_at: string } | undefined

    let status = 'ONLINE'
    let variant = 'green'

    if (!latest) {
      status = 'OFFLINE'
      variant = 'red'
    } else {
      const age = now - new Date(latest.created_at).getTime()
      if (age > 30 * 60 * 1000) {
        status = 'STALE'
        variant = 'yellow'
      }
    }

    return { name, status, variant, last_seen: latest?.created_at ?? null }
  })

  res.json({ sensors: result })
})

export default router
