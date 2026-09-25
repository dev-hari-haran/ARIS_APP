// ─── Dashboard Routes ───────────────────────────────────────────────────────
import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router()

// GET /api/dashboard/summary — KPIs + system status
router.get('/summary', (_req, res) => {
  const db = getDb()

  // Latest sensor readings
  const latestTemp = db.prepare(
    `SELECT value, unit FROM sensor_readings WHERE sensor_type = 'temperature' ORDER BY created_at DESC LIMIT 1`
  ).get() as { value: number; unit: string } | undefined

  const latestHumidity = db.prepare(
    `SELECT value FROM sensor_readings WHERE sensor_type = 'humidity' ORDER BY created_at DESC LIMIT 1`
  ).get() as { value: number } | undefined

  const latestMoisture = db.prepare(
    `SELECT value FROM sensor_readings WHERE sensor_type = 'soil_moisture' ORDER BY created_at DESC LIMIT 1`
  ).get() as { value: number } | undefined

  // Latest crop health
  const latestScan = db.prepare(
    `SELECT health_pct FROM crop_scans ORDER BY created_at DESC LIMIT 1`
  ).get() as { health_pct: number } | undefined

  // Water tank
  const tank = db.prepare(
    `SELECT level_pct, liters FROM water_tank ORDER BY created_at DESC LIMIT 1`
  ).get() as { level_pct: number; liters: number } | undefined

  // System status
  const systemOnline = db.prepare(
    `SELECT value FROM farm_settings WHERE key = 'system_online'`
  ).get() as { value: string } | undefined

  // Unresolved alerts count
  const alertCount = db.prepare(
    `SELECT COUNT(*) as c FROM alerts WHERE resolved = 0`
  ).get() as { c: number }

  // High priority alert
  const highAlert = db.prepare(
    `SELECT title, action_label FROM alerts WHERE resolved = 0 AND level = 'High' ORDER BY created_at DESC LIMIT 1`
  ).get() as { title: string; action_label: string } | undefined

  res.json({
    kpis: {
      crop_health: {
        value: latestScan ? `${latestScan.health_pct}%` : 'N/A',
        pct: latestScan?.health_pct ?? 0,
        badge: (latestScan?.health_pct ?? 0) >= 85 ? 'Healthy' : 'At Risk',
        variant: (latestScan?.health_pct ?? 0) >= 85 ? 'green' : 'yellow',
      },
      soil_moisture: {
        value: latestMoisture ? `${latestMoisture.value}%` : 'N/A',
        pct: latestMoisture?.value ?? 0,
        badge: (latestMoisture?.value ?? 0) >= 30 ? 'Optimal' : 'Low',
        variant: (latestMoisture?.value ?? 0) >= 30 ? 'green' : 'red',
      },
      temperature: {
        value: latestTemp ? `${latestTemp.value} ${latestTemp.unit}` : 'N/A',
        badge: (latestTemp?.value ?? 0) <= 32 ? 'Normal' : 'High',
        variant: (latestTemp?.value ?? 0) <= 32 ? 'yellow' : 'red',
      },
      water_tank: {
        value: tank ? `${tank.level_pct}%` : 'N/A',
        pct: tank?.level_pct ?? 0,
        badge: (tank?.level_pct ?? 0) >= 30 ? 'Available' : 'Low',
        variant: (tank?.level_pct ?? 0) >= 30 ? 'green' : 'red',
      },
    },
    system: {
      online: systemOnline?.value === 'true',
      alert_count: alertCount.c,
      high_alert: highAlert ?? null,
      last_sync: new Date().toISOString(),
    },
    farm: {
      name: (db.prepare(`SELECT value FROM farm_settings WHERE key = 'farm_name'`).get() as any)?.value ?? 'Farm',
      area: (db.prepare(`SELECT value FROM farm_settings WHERE key = 'area'`).get() as any)?.value ?? '0',
    },
  })
})

// GET /api/dashboard/recommendations — AI-generated recommendations
router.get('/recommendations', (_req, res) => {
  const db = getDb()

  // Generate recommendations based on actual data
  const moisture = db.prepare(
    `SELECT value FROM sensor_readings WHERE sensor_type = 'soil_moisture' ORDER BY created_at DESC LIMIT 1`
  ).get() as { value: number } | undefined

  const npk = db.prepare(
    `SELECT nitrogen, phosphorus, potassium FROM npk_readings ORDER BY created_at DESC LIMIT 1`
  ).get() as { nitrogen: number; phosphorus: number; potassium: number } | undefined

  const highAlerts = db.prepare(
    `SELECT title FROM alerts WHERE resolved = 0 AND level IN ('High', 'Medium') ORDER BY created_at DESC LIMIT 1`
  ).get() as { title: string } | undefined

  const recommendations = []

  // Irrigation recommendation
  if (moisture && moisture.value < 40) {
    recommendations.push({
      category: 'Irrigation',
      variant: 'green',
      bg: '#f0f9dc',
      title: `Field A needs water in ~45 min`,
      sub: `Moisture is at ${moisture.value}% and trending below target.`,
    })
  }

  // Nutrient recommendation
  if (npk && npk.nitrogen < 80) {
    recommendations.push({
      category: 'Nutrients',
      variant: 'yellow',
      bg: '#fefbe6',
      title: `Nitrogen level is moderate (${npk.nitrogen} mg/kg)`,
      sub: 'Consider the recommended N application.',
    })
  }

  // Crop alert recommendation
  if (highAlerts) {
    recommendations.push({
      category: 'Crop alert',
      variant: 'red',
      bg: '#fde8e8',
      title: highAlerts.title,
      sub: 'Review the crop intelligence scan.',
    })
  }

  // Fallback if no dynamic recommendations
  if (recommendations.length === 0) {
    recommendations.push({
      category: 'System',
      variant: 'green',
      bg: '#f0f9dc',
      title: 'All systems operating normally',
      sub: 'No action required at this time.',
    })
  }

  res.json({ recommendations })
})

// GET /api/dashboard/activity — Recent activity log
router.get('/activity', (req, res) => {
  const db = getDb()
  const limit = parseInt(req.query.limit as string) || 10

  const activities = db.prepare(
    `SELECT id, category, message, metadata, created_at
     FROM activity_log ORDER BY created_at DESC LIMIT ?`
  ).all(limit)

  res.json({ activities })
})

export default router
