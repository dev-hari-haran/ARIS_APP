// ─── Robot Operations Routes ────────────────────────────────────────────────
import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router()

// GET /api/robot/telemetry — Latest robot telemetry
router.get('/telemetry', (_req, res) => {
  const db = getDb()

  const telemetry = db.prepare(
    `SELECT battery_pct, speed, gps_lat, gps_lng, gps_accuracy, 
            lidar_status, encoder_status, current_mission, 
            waypoint_current, waypoint_total, timestamp
     FROM robot_telemetry ORDER BY timestamp DESC LIMIT 1`
  ).get() as any

  if (!telemetry) {
    return res.json({ telemetry: null, online: false })
  }

  const systemOnline = db.prepare(
    `SELECT value FROM farm_settings WHERE key = 'system_online'`
  ).get() as { value: string } | undefined

  res.json({
    telemetry: {
      battery: { value: `${telemetry.battery_pct}%`, pct: telemetry.battery_pct },
      speed: { value: `${telemetry.speed} m/s` },
      lidar: { value: telemetry.lidar_status, color: telemetry.lidar_status === 'Healthy' ? '#3d8620' : '#c62828' },
      encoder: { value: telemetry.encoder_status, color: telemetry.encoder_status === 'Healthy' ? '#3d8620' : '#c62828' },
      gps: { value: `±${telemetry.gps_accuracy} m`, lat: telemetry.gps_lat, lng: telemetry.gps_lng },
      mission: { value: telemetry.current_mission ?? 'Idle', color: '#b08800' },
      waypoints: { current: telemetry.waypoint_current, total: telemetry.waypoint_total },
    },
    online: systemOnline?.value === 'true',
    timestamp: telemetry.timestamp,
  })
})

// GET /api/robot/missions — Mission queue
router.get('/missions', (_req, res) => {
  const db = getDb()

  const missions = db.prepare(
    `SELECT id, name, status, progress_pct, created_at, started_at, completed_at
     FROM robot_missions
     WHERE status IN ('running', 'queued')
     ORDER BY 
       CASE status WHEN 'running' THEN 0 WHEN 'queued' THEN 1 ELSE 2 END,
       created_at ASC`
  ).all() as any[]

  res.json({
    missions: missions.map(m => ({
      ...m,
      variant: m.status === 'running' ? 'green' : 'ghost',
      status_label: m.status.charAt(0).toUpperCase() + m.status.slice(1),
    })),
  })
})

// POST /api/robot/command — Send command (pause, resume, base, abort)
router.post('/command', (req, res) => {
  const db = getDb()
  const { command } = req.body

  if (!command || !['pause', 'resume', 'base', 'abort'].includes(command)) {
    return res.status(400).json({ error: 'Valid command required: pause, resume, base, abort' })
  }

  // Log the command
  db.prepare(
    `INSERT INTO activity_log (category, message) VALUES (?, ?)`
  ).run('robot', `Robot command: ${command.toUpperCase()}`)

  // Update robot state based on command
  switch (command) {
    case 'pause':
      db.prepare(
        `UPDATE robot_telemetry SET speed = 0 WHERE id = (SELECT MAX(id) FROM robot_telemetry)`
      ).run()
      break

    case 'resume':
      db.prepare(
        `UPDATE robot_telemetry SET speed = 0.8 WHERE id = (SELECT MAX(id) FROM robot_telemetry)`
      ).run()
      break

    case 'base':
      // Cancel running missions and add return-to-base
      db.prepare(
        `UPDATE robot_missions SET status = 'completed', completed_at = datetime('now') 
         WHERE status = 'running'`
      ).run()
      db.prepare(
        `UPDATE robot_missions SET status = 'completed', completed_at = datetime('now') 
         WHERE status = 'queued'`
      ).run()
      db.prepare(
        `INSERT INTO robot_missions (name, status, progress_pct, started_at) 
         VALUES ('Return to base', 'running', 0, datetime('now'))`
      ).run()
      db.prepare(
        `UPDATE robot_telemetry SET current_mission = 'Return to base', speed = 1.2 
         WHERE id = (SELECT MAX(id) FROM robot_telemetry)`
      ).run()
      break

    case 'abort':
      db.prepare(
        `UPDATE robot_missions SET status = 'failed', completed_at = datetime('now') 
         WHERE status IN ('running', 'queued')`
      ).run()
      db.prepare(
        `UPDATE robot_telemetry SET speed = 0, current_mission = 'Aborted' 
         WHERE id = (SELECT MAX(id) FROM robot_telemetry)`
      ).run()
      break
  }

  res.json({
    success: true,
    message: `Robot command "${command}" executed`,
    command,
  })
})

// GET /api/robot/position — Current position for map animation
router.get('/position', (_req, res) => {
  const db = getDb()

  const pos = db.prepare(
    `SELECT gps_lat, gps_lng, waypoint_current, waypoint_total, speed, current_mission
     FROM robot_telemetry ORDER BY timestamp DESC LIMIT 1`
  ).get() as any

  res.json({
    position: pos ?? { gps_lat: 0, gps_lng: 0, waypoint_current: 0, waypoint_total: 0 },
  })
})

// GET /api/robot/pest-incidents — Pest incident history for History page
router.get('/pest-incidents', (_req, res) => {
  const db = getDb()

  const data = db.prepare(
    `SELECT 
       strftime('%Y-%m', created_at) as month,
       COUNT(*) as incidents
     FROM alerts
     WHERE category = 'crop' AND (title LIKE '%pest%' OR title LIKE '%disease%')
     GROUP BY strftime('%Y-%m', created_at)
     ORDER BY month ASC
     LIMIT 12`
  ).all() as any[]

  if (data.length < 3) {
    return res.json({
      data: [
        { month: 'Jan', incidents: 8 },
        { month: 'Feb', incidents: 6 },
        { month: 'Mar', incidents: 10 },
        { month: 'Apr', incidents: 4 },
        { month: 'May', incidents: 2 },
        { month: 'Jun', incidents: 1 },
      ],
    })
  }

  res.json({ data })
})

export default router
