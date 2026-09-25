// ─── Seed Data ──────────────────────────────────────────────────────────────
// Populates the database with realistic initial data matching the ARIS UI design

import { getDb } from './db.js'

export function seedDatabase() {
  const db = getDb()

  // Check if already seeded
  const count = db.prepare('SELECT COUNT(*) as c FROM sensor_readings').get() as { c: number }
  if (count.c > 0) {
    console.log('📦 Database already seeded, skipping.')
    return
  }

  console.log('🌱 Seeding database...')

  // ─── Farm Settings ──────────────────────────────────────────────────
  const insertSetting = db.prepare('INSERT OR REPLACE INTO farm_settings (key, value) VALUES (?, ?)')
  const settings = [
    ['farm_name', 'Green Valley Farm'],
    ['location', 'Thanjavur, Tamil Nadu'],
    ['area', '12.4'],
    ['area_unit', 'acres'],
    ['primary_crops', 'Sugarcane, Rice'],
    ['software_version', 'v1.0.0'],
    ['ai_model', 'MobileNetV2 INT8'],
    ['edge_device', 'Raspberry Pi 5'],
    ['connectivity', 'Wi-Fi · Bluetooth'],
    // Preferences
    ['pref_ai_recommendations', 'true'],
    ['pref_crop_risk_alerts', 'true'],
    ['pref_robot_alerts', 'true'],
    ['pref_daily_summary', 'false'],
    ['pref_offline_mode', 'true'],
    ['pref_auto_sync', 'true'],
    // System
    ['system_online', 'true'],
  ]
  const insertSettings = db.transaction(() => {
    for (const [key, value] of settings) {
      insertSetting.run(key, value)
    }
  })
  insertSettings()

  // ─── Sensor Readings (last 24 hours, every 2 hours) ─────────────────
  const insertSensor = db.prepare(
    'INSERT INTO sensor_readings (sensor_type, value, unit, zone, created_at) VALUES (?, ?, ?, ?, ?)'
  )
  const now = new Date()
  const tempData = [24.1, 23.4, 22.8, 23.5, 25.2, 27.4, 29.1, 29.4, 28.8, 27.2, 26.0, 25.1]
  const humidityData = [72, 74, 76, 75, 71, 68, 65, 63, 64, 67, 69, 71]
  const lightData = [0, 0, 5, 120, 380, 520, 542, 510, 420, 280, 60, 0]
  const windData = [3.2, 2.8, 2.1, 4.5, 6.2, 7.8, 8.2, 9.1, 7.5, 5.6, 4.2, 3.8]

  const insertSensors = db.transaction(() => {
    for (let i = 0; i < 12; i++) {
      const time = new Date(now.getTime() - (11 - i) * 2 * 60 * 60 * 1000)
      const ts = time.toISOString().replace('T', ' ').slice(0, 19)
      insertSensor.run('temperature', tempData[i], '°C', 'field_a', ts)
      insertSensor.run('humidity', humidityData[i], '%', 'field_a', ts)
      insertSensor.run('light', lightData[i], 'lx', 'field_a', ts)
      insertSensor.run('wind', windData[i], 'km/h', 'field_a', ts)
    }
    // Latest soil moisture
    insertSensor.run('soil_moisture', 38, '%', 'field_a', now.toISOString().replace('T', ' ').slice(0, 19))
    // Latest water level
    insertSensor.run('water_level', 74, '%', 'main', now.toISOString().replace('T', ' ').slice(0, 19))
  })
  insertSensors()

  // ─── Water Tank ─────────────────────────────────────────────────────
  db.prepare('INSERT INTO water_tank (level_pct, liters, capacity) VALUES (?, ?, ?)').run(74, 2960, 4000)

  // ─── Crop Scans ─────────────────────────────────────────────────────
  const insertScan = db.prepare(
    `INSERT INTO crop_scans (zone, health_pct, disease_risk, pest_risk, growth_stage, ai_findings, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const scans = [
    ['ZONE A', 91, 'Low', 'Moderate', 'Flowering', JSON.stringify({
      overall_health: '91%', disease_risk: 'Low', pest_risk: 'Moderate', growth_stage: 'Flowering',
      conditions: [
        { condition: 'Leaf discoloration', pct: 12, badge: 'Review' },
        { condition: 'Early pest pattern', pct: 6, badge: 'Monitor' },
        { condition: 'Water stress', pct: 3, badge: 'Low' },
      ]
    }), 'Reviewed', formatDate(0, 8, 0)],
    ['ZONE B', 88, 'Low', 'Moderate', 'Vegetative', null, 'Flagged', formatDate(1, 16, 30)],
    ['ZONE A', 92, 'Low', 'Low', 'Flowering', null, 'Reviewed', formatDate(2, 9, 15)],
    ['ZONE C', 85, 'Moderate', 'High', 'Tillering', null, 'Action Taken', formatDate(3, 17, 45)],
    ['ZONE A', 90, 'Low', 'Low', 'Flowering', null, 'Reviewed', formatDate(4, 8, 20)],
  ]
  const insertScans = db.transaction(() => {
    for (const s of scans) {
      insertScan.run(...s)
    }
  })
  insertScans()

  // ─── NPK Readings ──────────────────────────────────────────────────
  const insertNpk = db.prepare(
    'INSERT INTO npk_readings (zone, nitrogen, phosphorus, potassium, moisture_pct, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const npkData = [
    ['zone_a', 62, 44, 71, 38, formatDate(0, 10, 0)],
    ['zone_b', 55, 40, 68, 35, formatDate(0, 10, 0)],
    ['zone_c', 30, 20, 45, 28, formatDate(0, 10, 0)],
    ['zone_d', 70, 50, 75, 42, formatDate(0, 10, 0)],
  ]
  const insertNpks = db.transaction(() => {
    for (const n of npkData) {
      insertNpk.run(...n)
    }
  })
  insertNpks()

  // ─── Alerts ─────────────────────────────────────────────────────────
  const insertAlert = db.prepare(
    `INSERT INTO alerts (level, category, title, description, action_label, resolved, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
  const alerts = [
    ['High', 'crop', 'Early pest pattern · Zone 3', 'Detected via ESP32-CAM image analysis', 'Review image scan', 0, formatDate(0, 9, 30)],
    ['Medium', 'environment', 'Heat stress expected · 2 PM', 'Temperature forecast exceeds 32°C threshold', 'Check irrigation plan', 0, formatDate(0, 8, 0)],
    ['Low', 'environment', 'Low Risk of Floods Possible over the next week', 'Weather service advisory for the region', 'Monitor weather reports', 0, formatDate(0, 7, 0)],
    ['Low', 'connectivity', 'NPK sync delayed · 8 min', 'RS485 communication timeout on attempt 3', 'Retry connection', 0, formatDate(0, 6, 0)],
    // Resolved alerts
    ['Medium', 'crop', 'Disease scan anomaly · Zone B', 'False positive corrected after re-scan', 'View details', 1, formatDate(1, 14, 0)],
    ['Low', 'robot', 'Battery below 20%', 'Robot returned to base for charging', 'View log', 1, formatDate(1, 10, 0)],
    ['High', 'soil', 'Moisture critical · Zone C', 'Emergency irrigation triggered', 'View report', 1, formatDate(2, 6, 0)],
    ['Medium', 'irrigation', 'Drip line pressure drop', 'Line B2 repaired', 'View maintenance', 1, formatDate(2, 8, 0)],
    ['Low', 'connectivity', 'Weather feed timeout', 'Reconnected after 5 min', 'View log', 1, formatDate(3, 12, 0)],
    ['Medium', 'crop', 'Nitrogen deficiency detected', 'Fertilizer applied per recommendation', 'View action', 1, formatDate(3, 14, 0)],
    ['Low', 'environment', 'UV index high', 'No action required', 'Dismiss', 1, formatDate(4, 10, 0)],
    ['Low', 'robot', 'GPS signal weak in Zone D', 'Signal restored', 'View map', 1, formatDate(4, 16, 0)],
  ]
  const insertAlerts = db.transaction(() => {
    for (const a of alerts) {
      insertAlert.run(...a)
    }
  })
  insertAlerts()

  // ─── Activity Log ───────────────────────────────────────────────────
  const insertActivity = db.prepare(
    'INSERT INTO activity_log (category, message, created_at) VALUES (?, ?, ?)'
  )
  const activities = [
    ['camera', 'ESP32-CAM image received · Field A', formatDate(0, 10, 20)],
    ['sensor', 'Soil moisture synced · Zone 3', formatDate(0, 9, 21)],
    ['ai', 'Disease scan completed · Sugarcane', formatDate(0, 8, 22)],
    ['robot', 'Robot reached irrigation waypoint', formatDate(0, 7, 23)],
    ['sensor', 'NPK sensor reading updated', formatDate(0, 6, 24)],
    ['sensor', 'Weather feed synced', formatDate(0, 5, 44)],
    ['camera', 'Field A image received', formatDate(0, 4, 45)],
    ['system', 'System backup completed', formatDate(0, 3, 0)],
    ['irrigation', 'Zone 1 irrigation completed', formatDate(0, 2, 30)],
    ['robot', 'Robot mission: scan Zone B completed', formatDate(0, 1, 15)],
  ]
  const insertActivities = db.transaction(() => {
    for (const a of activities) {
      insertActivity.run(...a)
    }
  })
  insertActivities()

  // ─── Irrigation Schedule ────────────────────────────────────────────
  const insertSchedule = db.prepare(
    `INSERT INTO irrigation_schedule (zone, scheduled_time, duration_min, source, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
  const schedules = [
    ['Zone 1', '10:30', 12, 'scheduled', 'pending', formatDate(0, 6, 0)],
    ['Zone 2', '12:15', 18, 'ai_recommended', 'pending', formatDate(0, 6, 0)],
    ['Zone 3', '14:00', 15, 'scheduled', 'pending', formatDate(0, 6, 0)],
  ]
  const insertSchedules = db.transaction(() => {
    for (const s of schedules) {
      insertSchedule.run(...s)
    }
  })
  insertSchedules()

  // ─── Robot Telemetry ────────────────────────────────────────────────
  db.prepare(
    `INSERT INTO robot_telemetry (battery_pct, speed, gps_lat, gps_lng, gps_accuracy, lidar_status, encoder_status, current_mission, waypoint_current, waypoint_total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(82, 0.8, 10.7870, 79.1378, 0.6, 'Healthy', 'Healthy', 'Irrigation Z2', 4, 12)

  // ─── Robot Missions ─────────────────────────────────────────────────
  const insertMission = db.prepare(
    `INSERT INTO robot_missions (name, status, progress_pct, created_at, started_at)
     VALUES (?, ?, ?, ?, ?)`
  )
  insertMission.run('Irrigation · Zone 2', 'running', 42, formatDate(0, 8, 0), formatDate(0, 9, 0))
  insertMission.run('Scan · Field A', 'queued', 0, formatDate(0, 8, 30), null)
  insertMission.run('Return to base', 'queued', 0, formatDate(0, 9, 0), null)

  // ─── Irrigation Zones Water Demand ──────────────────────────────────
  // (We'll compute this from sensor_readings + npk_readings in the API)
  // But add some historical irrigation logs
  const insertLog = db.prepare(
    'INSERT INTO irrigation_logs (zone, duration_min, water_liters, trigger_type, created_at) VALUES (?, ?, ?, ?, ?)'
  )
  const irrLogs = [
    ['Zone 1', 15, 120, 'auto', formatDate(1, 10, 30)],
    ['Zone 2', 18, 145, 'ai', formatDate(1, 12, 15)],
    ['Zone 3', 12, 95, 'manual', formatDate(2, 14, 0)],
    ['Zone 1', 20, 160, 'auto', formatDate(3, 10, 0)],
    ['Zone 2', 15, 120, 'auto', formatDate(4, 11, 0)],
  ]
  const insertLogs = db.transaction(() => {
    for (const l of irrLogs) {
      insertLog.run(...l)
    }
  })
  insertLogs()

  console.log('✅ Database seeded successfully!')
}

// Helper: format date as "YYYY-MM-DD HH:MM:SS" relative to now
function formatDate(daysAgo: number, hour: number, minute: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

// Run directly if called as script
if (process.argv[1] && process.argv[1].includes('seed')) {
  seedDatabase()
  process.exit(0)
}
