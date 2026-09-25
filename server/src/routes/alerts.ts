// ─── Alerts & Events Routes ─────────────────────────────────────────────────
import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router()

// GET /api/alerts — All alerts with filters
router.get('/', (req, res) => {
  const db = getDb()
  const resolved = req.query.resolved as string
  const level = req.query.level as string
  const limit = parseInt(req.query.limit as string) || 50

  let sql = 'SELECT id, level, category, title, description, action_label, resolved, created_at, resolved_at FROM alerts WHERE 1=1'
  const params: any[] = []

  if (resolved !== undefined) {
    sql += ' AND resolved = ?'
    params.push(resolved === 'true' ? 1 : 0)
  }
  if (level) {
    sql += ' AND level = ?'
    params.push(level)
  }

  sql += ' ORDER BY created_at DESC LIMIT ?'
  params.push(limit)

  const alerts = db.prepare(sql).all(...params) as any[]

  // Assign display properties
  const levelMap: Record<string, { variant: string; bg: string; border: string }> = {
    High: { variant: 'red', bg: '#fde8e8', border: '#fca5a5' },
    Medium: { variant: 'yellow', bg: '#fefbe6', border: '#fae880' },
    Low: { variant: 'blue', bg: '#eff6ff', border: '#bfdbfe' },
    Info: { variant: 'ghost', bg: '#f0f9dc', border: '#d4e8a0' },
  }

  res.json({
    alerts: alerts.map(a => ({
      ...a,
      resolved: Boolean(a.resolved),
      ...(levelMap[a.level] ?? levelMap.Info),
    })),
  })
})

// GET /api/alerts/summary — Attention/Resolved/Today counts
router.get('/summary', (_req, res) => {
  const db = getDb()
  const today = new Date().toISOString().slice(0, 10)

  const attention = db.prepare(
    `SELECT COUNT(*) as c FROM alerts WHERE resolved = 0`
  ).get() as { c: number }

  const resolved = db.prepare(
    `SELECT COUNT(*) as c FROM alerts WHERE resolved = 1`
  ).get() as { c: number }

  const todayCount = db.prepare(
    `SELECT COUNT(*) as c FROM alerts WHERE date(created_at) = ?`
  ).get(today) as { c: number }

  // If no alerts today, count all
  const totalAlerts = todayCount.c > 0 ? todayCount.c : (db.prepare(`SELECT COUNT(*) as c FROM alerts`).get() as { c: number }).c

  res.json({
    summary: [
      { label: 'Attention', value: String(attention.c), bg: '#fefbe6', border: '#fae880', color: '#b08800' },
      { label: 'Resolved', value: String(resolved.c), bg: '#f0f9dc', border: '#c4e89c', color: '#3d8620' },
      { label: 'Today', value: String(totalAlerts), bg: '#ffffff', border: '#d4e8a0', color: '#245214' },
    ],
  })
})

// PATCH /api/alerts/:id/resolve — Mark alert resolved
router.patch('/:id/resolve', (req, res) => {
  const db = getDb()
  const { id } = req.params

  const result = db.prepare(
    `UPDATE alerts SET resolved = 1, resolved_at = datetime('now') WHERE id = ?`
  ).run(id)

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Alert not found' })
  }

  // Log activity
  db.prepare(
    `INSERT INTO activity_log (category, message) VALUES (?, ?)`
  ).run('alert', `Alert #${id} resolved`)

  res.json({ success: true, message: `Alert #${id} resolved` })
})

// GET /api/events — Event history timeline
router.get('/events', (req, res) => {
  const db = getDb()
  const limit = parseInt(req.query.limit as string) || 20

  const events = db.prepare(
    `SELECT id, category, message, created_at FROM activity_log ORDER BY created_at DESC LIMIT ?`
  ).all(limit) as any[]

  // Assign dot colors by category
  const categoryColors: Record<string, string> = {
    camera: '#52a82b',
    sensor: '#52a82b',
    ai: '#f0c800',
    robot: '#52a82b',
    irrigation: '#52a82b',
    system: '#52a82b',
    alert: '#f0c800',
  }

  res.json({
    events: events.map(e => ({
      ...e,
      dot: categoryColors[e.category] ?? '#52a82b',
      time_formatted: formatTime(e.created_at),
    })),
  })
})

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()

    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

    if (isToday) return `Today · ${time}`
    if (isYesterday) return `Yesterday · ${time}`
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`
  } catch {
    return dateStr
  }
}

export default router
