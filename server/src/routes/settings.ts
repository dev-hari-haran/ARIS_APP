// ─── Settings Routes ────────────────────────────────────────────────────────
import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router()

// GET /api/settings/farm — Farm profile
router.get('/farm', (_req, res) => {
  const db = getDb()

  const keys = ['farm_name', 'location', 'area', 'area_unit', 'primary_crops']
  const profile: Record<string, string> = {}

  for (const key of keys) {
    const row = db.prepare(`SELECT value FROM farm_settings WHERE key = ?`).get(key) as { value: string } | undefined
    profile[key] = row?.value ?? ''
  }

  res.json({
    profile: [
      { key: 'farm_name', label: 'Farm name', value: profile.farm_name },
      { key: 'location', label: 'Location', value: profile.location },
      { key: 'area', label: 'Area', value: `${profile.area} ${profile.area_unit || 'acres'}` },
      { key: 'primary_crops', label: 'Primary crops', value: profile.primary_crops },
    ],
  })
})

// PUT /api/settings/farm — Update farm profile
router.put('/farm', (req, res) => {
  const db = getDb()
  const updates = req.body as Record<string, string>

  const allowed = ['farm_name', 'location', 'area', 'area_unit', 'primary_crops']
  const upsert = db.prepare(
    `INSERT INTO farm_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  )

  const updateAll = db.transaction(() => {
    for (const [key, value] of Object.entries(updates)) {
      if (allowed.includes(key)) {
        upsert.run(key, value)
      }
    }
  })
  updateAll()

  // Log activity
  db.prepare(
    `INSERT INTO activity_log (category, message) VALUES (?, ?)`
  ).run('system', 'Farm profile updated')

  res.json({ success: true, message: 'Farm profile updated' })
})

// GET /api/settings/devices — Connected devices + status
router.get('/devices', (_req, res) => {
  const db = getDb()

  const devices = [
    { name: 'ESP32-CAM', sensor_type: 'temperature', protocol: 'Wi-Fi' },
    { name: 'DHT22', sensor_type: 'temperature', protocol: 'GPIO' },
    { name: 'BH1750', sensor_type: 'light', protocol: 'I2C' },
    { name: 'NPK RS485', sensor_type: 'soil_moisture', protocol: 'RS485' },
    { name: 'Soil Moisture', sensor_type: 'soil_moisture', protocol: 'ADC' },
    { name: 'RPLIDAR C1', sensor_type: null, protocol: 'UART' },
  ]

  const now = Date.now()
  const result = devices.map(d => {
    let status = 'CONNECTED'
    let variant: string = 'green'

    if (d.sensor_type) {
      const latest = db.prepare(
        `SELECT created_at FROM sensor_readings WHERE sensor_type = ? ORDER BY created_at DESC LIMIT 1`
      ).get(d.sensor_type) as { created_at: string } | undefined

      if (!latest) {
        status = 'DISCONNECTED'
        variant = 'red'
      } else {
        const age = now - new Date(latest.created_at).getTime()
        if (age > 30 * 60 * 1000) {
          status = 'STALE'
          variant = 'yellow'
        }
      }
    } else {
      // RPLIDAR — check robot telemetry
      const robot = db.prepare(
        `SELECT lidar_status FROM robot_telemetry ORDER BY timestamp DESC LIMIT 1`
      ).get() as { lidar_status: string } | undefined
      if (robot?.lidar_status !== 'Healthy') {
        status = 'ERROR'
        variant = 'red'
      }
    }

    return { ...d, status, variant }
  })

  res.json({ devices: result })
})

// GET /api/settings/preferences — AI/notification prefs
router.get('/preferences', (_req, res) => {
  const db = getDb()

  const prefs = [
    { key: 'pref_ai_recommendations', label: 'AI recommendations' },
    { key: 'pref_crop_risk_alerts', label: 'Crop risk alerts' },
    { key: 'pref_robot_alerts', label: 'Robot mission alerts' },
    { key: 'pref_daily_summary', label: 'Daily farm summary' },
    { key: 'pref_offline_mode', label: 'Offline mode' },
    { key: 'pref_auto_sync', label: 'Auto sync' },
  ]

  const result = prefs.map(p => {
    const row = db.prepare(`SELECT value FROM farm_settings WHERE key = ?`).get(p.key) as { value: string } | undefined
    return { ...p, enabled: row?.value === 'true' }
  })

  res.json({ preferences: result })
})

// PUT /api/settings/preferences — Update preferences
router.put('/preferences', (req, res) => {
  const db = getDb()
  const updates = req.body as Record<string, boolean>

  const allowed = [
    'pref_ai_recommendations', 'pref_crop_risk_alerts', 'pref_robot_alerts',
    'pref_daily_summary', 'pref_offline_mode', 'pref_auto_sync',
  ]

  const upsert = db.prepare(
    `INSERT INTO farm_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  )

  const updateAll = db.transaction(() => {
    for (const [key, value] of Object.entries(updates)) {
      if (allowed.includes(key)) {
        upsert.run(key, String(value))
      }
    }
  })
  updateAll()

  res.json({ success: true, message: 'Preferences updated' })
})

// GET /api/settings/system — System info
router.get('/system', (_req, res) => {
  const db = getDb()

  const keys = ['software_version', 'ai_model', 'edge_device', 'connectivity']
  const system: Record<string, string> = {}

  for (const key of keys) {
    const row = db.prepare(`SELECT value FROM farm_settings WHERE key = ?`).get(key) as { value: string } | undefined
    system[key] = row?.value ?? ''
  }

  // Last backup = last activity
  const lastBackup = db.prepare(
    `SELECT created_at FROM activity_log WHERE category = 'system' ORDER BY created_at DESC LIMIT 1`
  ).get() as { created_at: string } | undefined

  res.json({
    system: [
      { label: 'ARIS software', value: system.software_version },
      { label: 'AI model', value: system.ai_model },
      { label: 'Edge device', value: system.edge_device },
      { label: 'Connectivity', value: system.connectivity },
      { label: 'Last backup', value: lastBackup?.created_at ?? 'Never' },
    ],
  })
})

// POST /api/settings/system/toggle-online — Toggle system online/offline
router.post('/system/toggle-online', (_req, res) => {
  const db = getDb()

  const current = db.prepare(
    `SELECT value FROM farm_settings WHERE key = 'system_online'`
  ).get() as { value: string } | undefined

  const newValue = current?.value === 'true' ? 'false' : 'true'

  db.prepare(
    `INSERT INTO farm_settings (key, value, updated_at) VALUES ('system_online', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(newValue)

  db.prepare(
    `INSERT INTO activity_log (category, message) VALUES (?, ?)`
  ).run('system', `System ${newValue === 'true' ? 'brought online' : 'taken offline'}`)

  res.json({ success: true, online: newValue === 'true' })
})

export default router
