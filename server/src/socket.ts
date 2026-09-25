// ─── Socket.IO Realtime Events ──────────────────────────────────────────────
// Handles WebSocket connections and emits realtime sensor updates, robot
// position, alerts, and system status to connected clients.

import { Server as SocketServer } from 'socket.io'
import { getDb } from './db.js'

let io: SocketServer | null = null

export function initSocket(socketIo: SocketServer) {
  io = socketIo

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`)

    // Send initial system status on connect
    try {
      const db = getDb()
      const online = db.prepare(
        `SELECT value FROM farm_settings WHERE key = 'system_online'`
      ).get() as { value: string } | undefined

      socket.emit('system:status', {
        online: online?.value === 'true',
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      console.error('Socket init error:', err)
    }

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`)
    })

    // Handle sensor data submission (from ESP32/Raspberry Pi)
    socket.on('sensor:submit', (data: {
      sensor_type: string
      value: number
      unit: string
      zone?: string
    }) => {
      try {
        const db = getDb()
        db.prepare(
          `INSERT INTO sensor_readings (sensor_type, value, unit, zone) VALUES (?, ?, ?, ?)`
        ).run(data.sensor_type, data.value, data.unit, data.zone || 'field_a')

        // Broadcast to all clients
        io?.emit('sensor:update', {
          sensor_type: data.sensor_type,
          value: data.value,
          unit: data.unit,
          zone: data.zone || 'field_a',
          timestamp: new Date().toISOString(),
        })

        // Check for alert thresholds
        checkThresholds(data)
      } catch (err) {
        console.error('Sensor submission error:', err)
      }
    })

    // Handle robot position updates
    socket.on('robot:update', (data: {
      battery_pct: number
      speed: number
      gps_lat: number
      gps_lng: number
      gps_accuracy: number
      waypoint_current: number
      waypoint_total: number
    }) => {
      try {
        const db = getDb()
        db.prepare(
          `INSERT INTO robot_telemetry (battery_pct, speed, gps_lat, gps_lng, gps_accuracy, waypoint_current, waypoint_total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(data.battery_pct, data.speed, data.gps_lat, data.gps_lng, data.gps_accuracy, data.waypoint_current, data.waypoint_total)

        io?.emit('robot:position', {
          ...data,
          timestamp: new Date().toISOString(),
        })

        io?.emit('robot:telemetry', {
          battery_pct: data.battery_pct,
          speed: data.speed,
          timestamp: new Date().toISOString(),
        })
      } catch (err) {
        console.error('Robot update error:', err)
      }
    })
  })
}

// Check sensor readings against thresholds and create alerts
function checkThresholds(data: { sensor_type: string; value: number; unit: string; zone?: string }) {
  try {
    const db = getDb()

    let alert: { level: string; category: string; title: string; action: string } | null = null

    switch (data.sensor_type) {
      case 'temperature':
        if (data.value > 35) {
          alert = {
            level: 'High',
            category: 'environment',
            title: `Extreme heat: ${data.value}°C`,
            action: 'Increase irrigation immediately',
          }
        } else if (data.value > 32) {
          alert = {
            level: 'Medium',
            category: 'environment',
            title: `Heat stress: ${data.value}°C`,
            action: 'Check irrigation plan',
          }
        }
        break

      case 'soil_moisture':
        if (data.value < 20) {
          alert = {
            level: 'High',
            category: 'soil',
            title: `Critical moisture: ${data.value}% in ${data.zone ?? 'field'}`,
            action: 'Trigger emergency irrigation',
          }
        } else if (data.value < 30) {
          alert = {
            level: 'Medium',
            category: 'soil',
            title: `Low moisture: ${data.value}% in ${data.zone ?? 'field'}`,
            action: 'Schedule irrigation',
          }
        }
        break

      case 'humidity':
        if (data.value > 90) {
          alert = {
            level: 'Medium',
            category: 'environment',
            title: `High humidity: ${data.value}% — disease risk elevated`,
            action: 'Monitor crop scan',
          }
        }
        break
    }

    if (alert) {
      // Check for duplicate recent alerts (within 1 hour)
      const existing = db.prepare(
        `SELECT id FROM alerts WHERE title = ? AND resolved = 0 AND created_at > datetime('now', '-1 hour')`
      ).get(alert.title)

      if (!existing) {
        db.prepare(
          `INSERT INTO alerts (level, category, title, action_label) VALUES (?, ?, ?, ?)`
        ).run(alert.level, alert.category, alert.title, alert.action)

        io?.emit('alert:new', {
          ...alert,
          timestamp: new Date().toISOString(),
        })
      }
    }
  } catch (err) {
    console.error('Threshold check error:', err)
  }
}

// ─── Simulator ──────────────────────────────────────────────────────────────
// Simulates sensor data flow for demo purposes

export function startSimulator() {
  console.log('🔄 Starting sensor simulator...')

  // Simulate sensor readings every 30 seconds
  setInterval(() => {
    if (!io) return

    try {
      const db = getDb()

      // Get last readings
      const lastTemp = db.prepare(
        `SELECT value FROM sensor_readings WHERE sensor_type = 'temperature' ORDER BY created_at DESC LIMIT 1`
      ).get() as { value: number } | undefined

      const lastHumidity = db.prepare(
        `SELECT value FROM sensor_readings WHERE sensor_type = 'humidity' ORDER BY created_at DESC LIMIT 1`
      ).get() as { value: number } | undefined

      // Add small random variations
      const temp = (lastTemp?.value ?? 28) + (Math.random() - 0.5) * 1.2
      const humidity = (lastHumidity?.value ?? 68) + (Math.random() - 0.5) * 2
      const light = Math.max(0, 500 + (Math.random() - 0.5) * 100)
      const wind = Math.max(0, 8 + (Math.random() - 0.5) * 3)

      const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)

      // Insert new readings
      const insert = db.prepare(
        `INSERT INTO sensor_readings (sensor_type, value, unit, zone, created_at) VALUES (?, ?, ?, ?, ?)`
      )
      insert.run('temperature', Math.round(temp * 10) / 10, '°C', 'field_a', ts)
      insert.run('humidity', Math.round(humidity), '%', 'field_a', ts)
      insert.run('light', Math.round(light), 'lx', 'field_a', ts)
      insert.run('wind', Math.round(wind * 10) / 10, 'km/h', 'field_a', ts)

      // Emit to connected clients
      io.emit('sensor:update', {
        temperature: Math.round(temp * 10) / 10,
        humidity: Math.round(humidity),
        light: Math.round(light),
        wind: Math.round(wind * 10) / 10,
        timestamp: new Date().toISOString(),
      })

      // Simulate robot position update
      const robotTelemetry = db.prepare(
        `SELECT waypoint_current, waypoint_total, battery_pct FROM robot_telemetry ORDER BY timestamp DESC LIMIT 1`
      ).get() as any

      if (robotTelemetry) {
        const newWaypoint = robotTelemetry.waypoint_current < robotTelemetry.waypoint_total
          ? robotTelemetry.waypoint_current + 1
          : 1
        const newBattery = Math.max(5, robotTelemetry.battery_pct - 0.1)

        io.emit('robot:position', {
          waypoint_current: newWaypoint,
          waypoint_total: robotTelemetry.waypoint_total,
          battery_pct: Math.round(newBattery * 10) / 10,
        })
      }
    } catch (err) {
      console.warn('Simulator cycle warning:', err)
    }
  }, 30000) // Every 30 seconds

  // Emit system heartbeat every 10 seconds
  setInterval(() => {
    if (!io) return
    try {
      const db = getDb()
      const online = db.prepare(
        `SELECT value FROM farm_settings WHERE key = 'system_online'`
      ).get() as { value: string } | undefined

      io.emit('system:status', {
        online: online?.value === 'true',
        timestamp: new Date().toISOString(),
      })
    } catch { /* ignore */ }
  }, 10000)
}

export function getIO(): SocketServer | null {
  return io
}
