// ─── Soil & Nutrients Routes ────────────────────────────────────────────────
import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router()

// GET /api/soil/current — Latest NPK + moisture
router.get('/current', (_req, res) => {
  const db = getDb()

  const moisture = db.prepare(
    `SELECT value FROM sensor_readings WHERE sensor_type = 'soil_moisture' ORDER BY created_at DESC LIMIT 1`
  ).get() as { value: number } | undefined

  const npk = db.prepare(
    `SELECT nitrogen, phosphorus, potassium, moisture_pct, zone, created_at 
     FROM npk_readings WHERE zone = 'zone_a' ORDER BY created_at DESC LIMIT 1`
  ).get() as any

  res.json({
    kpis: {
      moisture: {
        value: `${moisture?.value ?? npk?.moisture_pct ?? 0} %`,
        pct: moisture?.value ?? npk?.moisture_pct ?? 0,
        badge: (moisture?.value ?? 0) >= 30 ? 'Optimal' : 'Low',
        variant: (moisture?.value ?? 0) >= 30 ? 'green' : 'red',
      },
      nitrogen: {
        value: `${npk?.nitrogen ?? 0} mg/kg`,
        badge: (npk?.nitrogen ?? 0) >= 50 ? ((npk?.nitrogen ?? 0) >= 80 ? 'Good' : 'Moderate') : 'Low',
        variant: (npk?.nitrogen ?? 0) >= 50 ? ((npk?.nitrogen ?? 0) >= 80 ? 'green' : 'yellow') : 'red',
      },
      phosphorus: {
        value: `${npk?.phosphorus ?? 0} mg/kg`,
        badge: (npk?.phosphorus ?? 0) >= 30 ? 'Good' : 'Low',
        variant: (npk?.phosphorus ?? 0) >= 30 ? 'green' : 'yellow',
      },
      potassium: {
        value: `${npk?.potassium ?? 0} mg/kg`,
        badge: (npk?.potassium ?? 0) >= 50 ? 'Good' : 'Low',
        variant: (npk?.potassium ?? 0) >= 50 ? 'green' : 'yellow',
      },
    },
    npk_balance: [
      { key: 'N', label: 'Nitrogen', value: npk?.nitrogen ?? 0, max: 120, color: '#3d8620' },
      { key: 'P', label: 'Phosphorus', value: npk?.phosphorus ?? 0, max: 120, color: '#d4a800' },
      { key: 'K', label: 'Potassium', value: npk?.potassium ?? 0, max: 120, color: '#2f6b1a' },
    ],
  })
})

// GET /api/soil/zones — Zone-by-zone nutrient data
router.get('/zones', (_req, res) => {
  const db = getDb()

  const zones = db.prepare(
    `SELECT zone, nitrogen, phosphorus, potassium, moisture_pct, created_at
     FROM npk_readings 
     WHERE id IN (SELECT MAX(id) FROM npk_readings GROUP BY zone)
     ORDER BY zone ASC`
  ).all() as any[]

  res.json({ zones })
})

// GET /api/soil/fertilizer-recommendation — AI fertilizer plan
router.get('/fertilizer-recommendation', (_req, res) => {
  const db = getDb()

  const npk = db.prepare(
    `SELECT nitrogen, phosphorus, potassium FROM npk_readings 
     WHERE zone = 'zone_a' ORDER BY created_at DESC LIMIT 1`
  ).get() as { nitrogen: number; phosphorus: number; potassium: number } | undefined

  const recommendations = []

  if (npk) {
    // Nitrogen recommendation
    if (npk.nitrogen < 80) {
      const needed = Math.round((80 - npk.nitrogen) * 0.3) // simplified calc
      recommendations.push({
        nutrient: 'Nitrogen application',
        recommendation: `Apply ${needed} kg/acre in Field A`,
        priority: 'action',
      })
    } else {
      recommendations.push({
        nutrient: 'Nitrogen',
        recommendation: 'No additional application required',
        priority: 'info',
      })
    }

    // Phosphorus & Potassium
    if (npk.phosphorus >= 30 && npk.potassium >= 50) {
      recommendations.push({
        nutrient: 'Phosphorus & Potassium',
        recommendation: 'No additional application required',
        priority: 'info',
      })
    } else {
      const parts = []
      if (npk.phosphorus < 30) parts.push('P')
      if (npk.potassium < 50) parts.push('K')
      recommendations.push({
        nutrient: `${parts.join(' & ')} application`,
        recommendation: `Apply balanced ${parts.join('K')} fertilizer`,
        priority: 'action',
      })
    }
  }

  res.json({ recommendations })
})

// GET /api/soil/field-plan — Full field nutrient plan
router.get('/field-plan', (_req, res) => {
  const db = getDb()

  const zones = db.prepare(
    `SELECT zone, nitrogen, phosphorus, potassium, moisture_pct
     FROM npk_readings 
     WHERE id IN (SELECT MAX(id) FROM npk_readings GROUP BY zone)
     ORDER BY zone ASC`
  ).all() as any[]

  const plan = zones.map(z => {
    const n = z.nitrogen
    const p = z.phosphorus
    const k = z.potassium

    let status = 'Optimal'
    let action = 'None required'
    let actionType: string = 'ghost'

    if (n < 40 || p < 25 || k < 40) {
      status = 'Deficient'
      action = 'Schedule Full NPK Application'
      actionType = 'red'
    } else if (n < 60 || p < 35 || k < 55) {
      status = 'Good'
      action = 'Monitor levels'
      actionType = 'ghost'
    } else if (n < 80) {
      status = 'Optimal'
      const needed = Math.round((80 - n) * 0.3)
      action = `Apply ${needed} kg/acre Nitrogen`
      actionType = 'yellow'
    }

    return {
      zone: z.zone.replace('zone_', 'ZONE ').toUpperCase(),
      status,
      n: `${n} mg/kg`,
      p: `${p} mg/kg`,
      k: `${k} mg/kg`,
      action,
      actionType,
    }
  })

  res.json({ plan })
})

export default router
