// ─── AI Assistant Routes ────────────────────────────────────────────────────
import { Router } from 'express'
import { getDb } from '../db.js'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

// POST /api/assistant/chat — Send message, get AI response
router.post('/chat', async (req, res) => {
  const db = getDb()
  const { message, session_id } = req.body

  if (!message) {
    return res.status(400).json({ error: 'message is required' })
  }

  const sessionId = session_id || uuidv4()

  // Save user message
  db.prepare(
    `INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)`
  ).run(sessionId, 'user', message)

  // Build farm context for AI response
  const context = buildFarmContext(db)

  // Generate AI response
  let aiResponse: string

  const apiKey = process.env.GEMINI_API_KEY
  if (apiKey) {
    // Use Gemini API
    try {
      aiResponse = await callGeminiAPI(apiKey, message, context)
    } catch (err) {
      console.error('Gemini API error:', err)
      aiResponse = generateLocalResponse(message, context)
    }
  } else {
    // Local context-aware response
    aiResponse = generateLocalResponse(message, context)
  }

  // Save assistant message
  db.prepare(
    `INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)`
  ).run(sessionId, 'assistant', aiResponse)

  // Log activity
  db.prepare(
    `INSERT INTO activity_log (category, message) VALUES (?, ?)`
  ).run('ai', `AI Assistant answered: "${message.slice(0, 50)}..."`)

  res.json({
    response: aiResponse,
    session_id: sessionId,
  })
})

// GET /api/assistant/context — Farm context summary
router.get('/context', (_req, res) => {
  const db = getDb()
  const context = buildFarmContext(db)

  res.json({
    context: [
      `${context.area} acres`,
      `${context.fieldCount} fields`,
      `${context.sensorCount} sensors`,
      context.robotOnline ? 'ARIS robot online' : 'ARIS robot offline',
    ],
    details: context,
  })
})

// GET /api/assistant/history — Chat history for a session
router.get('/history', (req, res) => {
  const db = getDb()
  const sessionId = req.query.session_id as string
  const limit = parseInt(req.query.limit as string) || 50

  let messages
  if (sessionId) {
    messages = db.prepare(
      `SELECT role, content, metadata, created_at FROM chat_messages 
       WHERE session_id = ? ORDER BY created_at ASC LIMIT ?`
    ).all(sessionId, limit)
  } else {
    // Get the latest session
    const latest = db.prepare(
      `SELECT session_id FROM chat_messages ORDER BY created_at DESC LIMIT 1`
    ).get() as { session_id: string } | undefined

    if (latest) {
      messages = db.prepare(
        `SELECT role, content, metadata, created_at FROM chat_messages 
         WHERE session_id = ? ORDER BY created_at ASC LIMIT ?`
      ).all(latest.session_id, limit)
    } else {
      messages = []
    }
  }

  res.json({ messages })
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildFarmContext(db: any) {
  const farmName = (db.prepare(`SELECT value FROM farm_settings WHERE key = 'farm_name'`).get() as any)?.value ?? 'Farm'
  const area = (db.prepare(`SELECT value FROM farm_settings WHERE key = 'area'`).get() as any)?.value ?? '0'
  const crops = (db.prepare(`SELECT value FROM farm_settings WHERE key = 'primary_crops'`).get() as any)?.value ?? ''

  const latestTemp = db.prepare(
    `SELECT value FROM sensor_readings WHERE sensor_type = 'temperature' ORDER BY created_at DESC LIMIT 1`
  ).get() as any
  const latestHumidity = db.prepare(
    `SELECT value FROM sensor_readings WHERE sensor_type = 'humidity' ORDER BY created_at DESC LIMIT 1`
  ).get() as any
  const latestMoisture = db.prepare(
    `SELECT value FROM sensor_readings WHERE sensor_type = 'soil_moisture' ORDER BY created_at DESC LIMIT 1`
  ).get() as any
  const latestScan = db.prepare(
    `SELECT health_pct, disease_risk, pest_risk FROM crop_scans ORDER BY created_at DESC LIMIT 1`
  ).get() as any
  const npk = db.prepare(
    `SELECT nitrogen, phosphorus, potassium FROM npk_readings ORDER BY created_at DESC LIMIT 1`
  ).get() as any
  const tank = db.prepare(
    `SELECT level_pct FROM water_tank ORDER BY created_at DESC LIMIT 1`
  ).get() as any
  const activeAlerts = db.prepare(
    `SELECT COUNT(*) as c FROM alerts WHERE resolved = 0`
  ).get() as any
  const robotTelemetry = db.prepare(
    `SELECT battery_pct, current_mission FROM robot_telemetry ORDER BY timestamp DESC LIMIT 1`
  ).get() as any

  const systemOnline = (db.prepare(
    `SELECT value FROM farm_settings WHERE key = 'system_online'`
  ).get() as any)?.value === 'true'

  return {
    farmName,
    area,
    crops,
    fieldCount: 4,
    sensorCount: 18,
    temperature: latestTemp?.value ?? null,
    humidity: latestHumidity?.value ?? null,
    soilMoisture: latestMoisture?.value ?? null,
    cropHealth: latestScan?.health_pct ?? null,
    diseaseRisk: latestScan?.disease_risk ?? null,
    pestRisk: latestScan?.pest_risk ?? null,
    nitrogen: npk?.nitrogen ?? null,
    phosphorus: npk?.phosphorus ?? null,
    potassium: npk?.potassium ?? null,
    tankLevel: tank?.level_pct ?? null,
    activeAlerts: activeAlerts?.c ?? 0,
    robotBattery: robotTelemetry?.battery_pct ?? null,
    robotMission: robotTelemetry?.current_mission ?? null,
    robotOnline: systemOnline,
  }
}

function generateLocalResponse(question: string, context: any): string {
  const q = question.toLowerCase()

  // Irrigation-related
  if (q.includes('irrigat') || q.includes('water') || q.includes('moisture')) {
    const moisture = context.soilMoisture ?? 'unknown'
    const tank = context.tankLevel ?? 'unknown'
    if (moisture !== null && moisture < 30) {
      return `Soil moisture is currently at ${moisture}%. This is below the optimal threshold of 30%. I strongly recommend immediate irrigation. Water tank is at ${tank}%, which is ${tank > 40 ? 'sufficient' : 'running low'} for the operation.`
    }
    return `Current soil moisture is at ${moisture}%. The water tank is at ${tank}% capacity (~${Math.round((tank / 100) * 4000)} L available). Based on current evapotranspiration rates and the temperature of ${context.temperature}°C, I recommend scheduling irrigation within the next hour.`
  }

  // Crop health
  if (q.includes('crop') || q.includes('health') || q.includes('disease') || q.includes('pest')) {
    return `Overall crop health is at ${context.cropHealth ?? 'N/A'}%. Disease risk is ${context.diseaseRisk ?? 'unknown'}, and pest risk is ${context.pestRisk ?? 'unknown'}. ${
      context.pestRisk === 'Moderate' || context.pestRisk === 'High'
        ? 'I recommend reviewing the latest crop scan images and considering preventive measures.'
        : 'Current conditions are favorable. Continue monitoring with regular scans.'
    }`
  }

  // Soil / Nutrients
  if (q.includes('soil') || q.includes('npk') || q.includes('nutrient') || q.includes('nitrogen') || q.includes('fertilizer')) {
    return `Current NPK readings — Nitrogen: ${context.nitrogen ?? 'N/A'} mg/kg, Phosphorus: ${context.phosphorus ?? 'N/A'} mg/kg, Potassium: ${context.potassium ?? 'N/A'} mg/kg. Soil moisture is at ${context.soilMoisture ?? 'N/A'}%. ${
      (context.nitrogen ?? 0) < 80
        ? `Nitrogen is below optimal (80 mg/kg). I recommend applying approximately ${Math.round((80 - (context.nitrogen ?? 0)) * 0.3)} kg/acre of nitrogen fertilizer.`
        : 'All nutrient levels are within acceptable ranges.'
    }`
  }

  // Robot
  if (q.includes('robot') || q.includes('mission') || q.includes('battery')) {
    return `The ARIS robot is ${context.robotOnline ? 'online' : 'offline'}. Battery is at ${context.robotBattery ?? 'N/A'}%. Current mission: ${context.robotMission ?? 'Idle'}. ${
      (context.robotBattery ?? 100) < 30
        ? 'Battery is getting low. Consider returning to base for charging.'
        : 'All systems are nominal.'
    }`
  }

  // Alerts
  if (q.includes('alert') || q.includes('warning') || q.includes('notification')) {
    return `There are currently ${context.activeAlerts} active alerts requiring attention. The most critical ones relate to ${context.pestRisk === 'High' || context.pestRisk === 'Moderate' ? 'pest detection' : 'environmental conditions'}. I recommend reviewing the alerts panel for detailed information and recommended actions.`
  }

  // Weather / Environment
  if (q.includes('weather') || q.includes('temperature') || q.includes('humid') || q.includes('environment')) {
    return `Current conditions — Temperature: ${context.temperature ?? 'N/A'}°C, Humidity: ${context.humidity ?? 'N/A'}%, Soil Moisture: ${context.soilMoisture ?? 'N/A'}%. ${
      (context.temperature ?? 0) > 32
        ? 'Temperature is above the heat stress threshold. Consider increasing irrigation frequency.'
        : 'Environmental conditions are within normal range for your crops.'
    }`
  }

  // Summary
  if (q.includes('summary') || q.includes('overview') || q.includes('status') || q.includes('today')) {
    return `Farm: ${context.farmName} (${context.area} acres). Crop health: ${context.cropHealth}%. Temperature: ${context.temperature}°C, Humidity: ${context.humidity}%. Soil moisture: ${context.soilMoisture}%. Water tank: ${context.tankLevel}%. Active alerts: ${context.activeAlerts}. Robot: ${context.robotOnline ? 'online' : 'offline'}, battery ${context.robotBattery}%. Overall status: ${context.activeAlerts <= 2 ? 'Good — all systems operating normally.' : 'Attention needed — review active alerts.'}`
  }

  // Default response
  return `I'm analyzing your farm data for "${context.farmName}" (${context.area} acres). Based on current readings — crop health is at ${context.cropHealth}%, temperature ${context.temperature}°C, and soil moisture ${context.soilMoisture}%. I have ${context.activeAlerts} active alerts. Would you like me to provide specific recommendations for irrigation, crops, soil nutrients, or robot operations?`
}

async function callGeminiAPI(apiKey: string, question: string, context: any): Promise<string> {
  const systemPrompt = `You are ARIS, an AI farm intelligence assistant for "${context.farmName}" (${context.area} acres, growing ${context.crops}).

Current farm data:
- Temperature: ${context.temperature}°C
- Humidity: ${context.humidity}%
- Soil Moisture: ${context.soilMoisture}%
- Crop Health: ${context.cropHealth}%
- Disease Risk: ${context.diseaseRisk}
- Pest Risk: ${context.pestRisk}
- NPK: N=${context.nitrogen} mg/kg, P=${context.phosphorus} mg/kg, K=${context.potassium} mg/kg
- Water Tank: ${context.tankLevel}%
- Active Alerts: ${context.activeAlerts}
- Robot: ${context.robotOnline ? 'Online' : 'Offline'}, Battery ${context.robotBattery}%, Mission: ${context.robotMission}

Respond concisely and actionably as a precision agriculture advisor. Use specific numbers from the data above.`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: question }] }],
        generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const data = await response.json() as any
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'I apologize, I could not generate a response. Please try again.'
}

export default router
