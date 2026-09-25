// ─── Irrigation Routes ──────────────────────────────────────────────────────
import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router()

// GET /api/irrigation/tank — Water tank level
router.get('/tank', (_req, res) => {
  const db = getDb()

  const tank = db.prepare(
    `SELECT level_pct, liters, capacity, created_at FROM water_tank ORDER BY created_at DESC LIMIT 1`
  ).get() as { level_pct: number; liters: number; capacity: number; created_at: string } | undefined

  if (!tank) {
    return res.json({ tank: { level_pct: 0, liters: 0, capacity: 4000, status: 'EMPTY' } })
  }

  let status = 'SUFFICIENT'
  let variant = 'blue'
  if (tank.level_pct < 20) { status = 'CRITICAL'; variant = 'red' }
  else if (tank.level_pct < 40) { status = 'LOW'; variant = 'yellow' }

  res.json({
    tank: {
      ...tank,
      status,
      variant,
      formatted: `~ ${Math.round(tank.liters).toLocaleString()} L available`,
    },
  })
})

// GET /api/irrigation/schedule — Today's irrigation plan
router.get('/schedule', (_req, res) => {
  const db = getDb()

  const today = new Date().toISOString().slice(0, 10)
  const schedules = db.prepare(
    `SELECT id, zone, scheduled_time, duration_min, source, status, created_at
     FROM irrigation_schedule 
     WHERE date(created_at) = ?
     ORDER BY scheduled_time ASC`
  ).all(today) as any[]

  // If no schedules for today, return all
  const result = schedules.length > 0 ? schedules : db.prepare(
    `SELECT id, zone, scheduled_time, duration_min, source, status, created_at
     FROM irrigation_schedule ORDER BY scheduled_time ASC LIMIT 10`
  ).all() as any[]

  res.json({
    schedule: result.map(s => ({
      ...s,
      time_formatted: s.scheduled_time,
      duration_formatted: `${s.duration_min} min`,
      label: s.source === 'ai_recommended' ? 'AI recommended' : 'Scheduled',
      variant: s.source === 'ai_recommended' ? 'yellow' : 'ghost',
    })),
  })
})

// GET /api/irrigation/zones — Water demand per zone
router.get('/zones', (_req, res) => {
  const db = getDb()

  // Get moisture levels per zone from NPK readings
  const zones = db.prepare(
    `SELECT zone, moisture_pct FROM npk_readings 
     WHERE id IN (SELECT MAX(id) FROM npk_readings GROUP BY zone)
     ORDER BY zone ASC`
  ).all() as { zone: string; moisture_pct: number }[]

  const zoneData = [
    { name: 'Zone 1', pct: 52, mins: '8 min',  status: 'READY', v: 'green' },
    { name: 'Zone 2', pct: 65, mins: '11 min', status: 'READY', v: 'green' },
    { name: 'Zone 3', pct: 78, mins: '14 min', status: 'REVIEW', v: 'yellow' },
    { name: 'Zone 4', pct: 86, mins: '17 min', status: 'READY', v: 'green' },
    { name: 'Nursery', pct: 90, mins: '20 min', status: 'READY', v: 'green' },
  ]

  // Override with real zone data if available
  zones.forEach((z, i) => {
    if (i < zoneData.length) {
      const moisture = z.moisture_pct
      const demand = Math.max(0, Math.round((50 - moisture) / 50 * 100))
      zoneData[i].pct = demand > 0 ? demand : zoneData[i].pct
      zoneData[i].status = moisture < 25 ? 'URGENT' : moisture < 35 ? 'REVIEW' : 'READY'
      zoneData[i].v = zoneData[i].status === 'URGENT' ? 'red' : zoneData[i].status === 'REVIEW' ? 'yellow' : 'green'
    }
  })

  res.json({ zones: zoneData })
})

// POST /api/irrigation/start — Trigger irrigation sequence
router.post('/start', (req, res) => {
  const db = getDb()
  const { zone, duration_min } = req.body

  if (!zone || !duration_min) {
    return res.status(400).json({ error: 'zone and duration_min are required' })
  }

  // Log the irrigation
  const result = db.prepare(
    `INSERT INTO irrigation_logs (zone, duration_min, water_liters, trigger_type) VALUES (?, ?, ?, ?)`
  ).run(zone, duration_min, Math.round(duration_min * 8), 'manual')

  // Log activity
  db.prepare(
    `INSERT INTO activity_log (category, message) VALUES (?, ?)`
  ).run('irrigation', `Irrigation started · ${zone} · ${duration_min} min`)

  // Update water tank (reduce level)
  const tank = db.prepare(
    `SELECT level_pct, liters, capacity FROM water_tank ORDER BY created_at DESC LIMIT 1`
  ).get() as { level_pct: number; liters: number; capacity: number } | undefined

  if (tank) {
    const usedLiters = Math.round(duration_min * 8)
    const newLiters = Math.max(0, tank.liters - usedLiters)
    const newPct = Math.round((newLiters / tank.capacity) * 100)
    db.prepare(
      `INSERT INTO water_tank (level_pct, liters, capacity) VALUES (?, ?, ?)`
    ).run(newPct, newLiters, tank.capacity)
  }

  res.json({
    success: true,
    message: `Irrigation sequence initiated for ${zone} — ${duration_min} minutes`,
    id: result.lastInsertRowid,
  })
})

// GET /api/irrigation/history — Irrigation history
router.get('/history', (req, res) => {
  const db = getDb()
  const limit = parseInt(req.query.limit as string) || 20

  const logs = db.prepare(
    `SELECT id, zone, duration_min, water_liters, trigger_type, created_at
     FROM irrigation_logs ORDER BY created_at DESC LIMIT ?`
  ).all(limit)

  res.json({ logs })
})

// GET /api/irrigation/water-efficiency — Historical water efficiency for History page
router.get('/water-efficiency', (_req, res) => {
  const db = getDb()

  // Aggregate monthly usage from irrigation logs
  const data = db.prepare(
    `SELECT 
       strftime('%Y-%m', created_at) as month,
       SUM(water_liters) as total_liters,
       COUNT(*) as sessions
     FROM irrigation_logs
     GROUP BY strftime('%Y-%m', created_at)
     ORDER BY month ASC
     LIMIT 12`
  ).all() as any[]

  if (data.length < 3) {
    return res.json({
      data: [
        { month: 'Jan', usage: 120, efficiency: 75 },
        { month: 'Feb', usage: 135, efficiency: 78 },
        { month: 'Mar', usage: 150, efficiency: 82 },
        { month: 'Apr', usage: 140, efficiency: 88 },
        { month: 'May', usage: 160, efficiency: 91 },
        { month: 'Jun', usage: 175, efficiency: 89 },
      ],
    })
  }

  res.json({
    data: data.map(d => ({
      month: d.month,
      usage: Math.round(d.total_liters),
      efficiency: Math.min(95, Math.round(70 + d.sessions * 3)),
    })),
  })
})

export default router
