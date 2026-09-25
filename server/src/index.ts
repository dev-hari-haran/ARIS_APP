// ─── ARIS Backend Server ────────────────────────────────────────────────────
// Express + Socket.IO server powering the ARIS AI Farm Intelligence dashboard
//
// Endpoints:
//   /api/dashboard/*    — KPIs, recommendations, activity
//   /api/crops/*        — Crop scans, conditions, health timeline
//   /api/environment/*  — Sensor readings, history, alerts, sensor health
//   /api/soil/*         — NPK, zone data, fertilizer recommendations
//   /api/irrigation/*   — Tank, schedule, zones, start irrigation
//   /api/robot/*        — Telemetry, missions, commands
//   /api/alerts/*       — Alert CRUD, event history
//   /api/assistant/*    — AI chat, context
//   /api/settings/*     — Farm profile, devices, preferences, system
//
// WebSocket (Socket.IO):
//   sensor:update, robot:position, robot:telemetry, alert:new, system:status

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import http from 'node:http'
import { Server as SocketServer } from 'socket.io'

import { getDb, closeDb } from './db.js'
import { seedDatabase } from './seed.js'
import { initSocket, startSimulator } from './socket.js'

// Route imports
import dashboardRoutes from './routes/dashboard.js'
import cropsRoutes from './routes/crops.js'
import environmentRoutes from './routes/environment.js'
import soilRoutes from './routes/soil.js'
import irrigationRoutes from './routes/irrigation.js'
import robotRoutes from './routes/robot.js'
import alertsRoutes from './routes/alerts.js'
import settingsRoutes from './routes/settings.js'

const PORT = parseInt(process.env.PORT || '3001')

// ─── App Setup ──────────────────────────────────────────────────────────────
const app = express()
const server = http.createServer(app)

// Socket.IO
const io = new SocketServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

// Middleware
app.use(cors())
app.use(express.json())

// Request logger
app.use((req, _res, next) => {
  if (req.url.startsWith('/api')) {
    console.log(`${new Date().toISOString().slice(11, 19)} ${req.method} ${req.url}`)
  }
  next()
})

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/crops', cropsRoutes)
app.use('/api/environment', environmentRoutes)
app.use('/api/soil', soilRoutes)
app.use('/api/irrigation', irrigationRoutes)
app.use('/api/robot', robotRoutes)
app.use('/api/alerts', alertsRoutes)
app.use('/api/settings', settingsRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
  })
})

// Sensor data ingestion endpoint (for ESP32/Arduino HTTP POST)
app.post('/api/ingest', (req, res) => {
  const { sensor_type, value, unit, zone } = req.body

  if (!sensor_type || value === undefined || !unit) {
    return res.status(400).json({ error: 'sensor_type, value, and unit are required' })
  }

  try {
    const db = getDb()
    db.prepare(
      `INSERT INTO sensor_readings (sensor_type, value, unit, zone) VALUES (?, ?, ?, ?)`
    ).run(sensor_type, value, unit, zone || 'field_a')

    // Broadcast via Socket.IO
    io.emit('sensor:update', {
      sensor_type,
      value,
      unit,
      zone: zone || 'field_a',
      timestamp: new Date().toISOString(),
    })

    res.json({ success: true })
  } catch (err) {
    console.error('Ingest error:', err)
    res.status(500).json({ error: 'Failed to ingest data' })
  }
})

// ─── Initialize ─────────────────────────────────────────────────────────────

// Initialize database
console.log('📦 Initializing database...')
getDb()

// Seed with initial data
seedDatabase()

// Initialize Socket.IO
initSocket(io)

// Start sensor simulator (for demo)
startSimulator()

// ─── Start Server ───────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   🌾  ARIS Backend Server                            ║
║                                                      ║
║   REST API:   http://localhost:${PORT}/api             ║
║   WebSocket:  http://localhost:${PORT}                 ║
║   Health:     http://localhost:${PORT}/api/health      ║
║                                                      ║
║   Database:   SQLite (aris.db)                        ║
║   Simulator:  Running (30s interval)                  ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down...')
  closeDb()
  server.close()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...')
  closeDb()
  server.close()
  process.exit(0)
})
