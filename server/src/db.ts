import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'aris.db')

let db: DatabaseSync & { transaction: <T extends (...args: any[]) => any>(fn: T) => T }

export function getDb(): DatabaseSync & { transaction: <T extends (...args: any[]) => any>(fn: T) => T } {
  if (!db) {
    const rawDb = new DatabaseSync(DB_PATH)
    rawDb.exec('PRAGMA busy_timeout = 5000;')
    rawDb.exec('PRAGMA journal_mode = WAL;')
    rawDb.exec('PRAGMA synchronous = NORMAL;')
    rawDb.exec('PRAGMA foreign_keys = ON;')
    
    ;(rawDb as any).transaction = <T extends (...args: any[]) => any>(fn: T): T => {
      return ((...args: any[]) => {
        rawDb.exec('BEGIN TRANSACTION;')
        try {
          const result = fn(...args)
          rawDb.exec('COMMIT;')
          return result
        } catch (err) {
          rawDb.exec('ROLLBACK;')
          throw err
        }
      }) as T
    }

    db = rawDb as any
    initSchema()
  }
  return db
}

function initSchema() {
  const d = getDbRaw()

  d.exec(`
    -- ─── Sensor Readings ────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS sensor_readings (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_type TEXT    NOT NULL,  -- temperature, humidity, light, wind, soil_moisture, water_level
      value       REAL    NOT NULL,
      unit        TEXT    NOT NULL,
      zone        TEXT    DEFAULT 'field_a',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sensor_type_time ON sensor_readings(sensor_type, created_at DESC);

    -- ─── Crop Scans ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS crop_scans (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      zone         TEXT    NOT NULL,
      health_pct   REAL    NOT NULL,
      disease_risk TEXT    NOT NULL DEFAULT 'Low',
      pest_risk    TEXT    NOT NULL DEFAULT 'Low',
      growth_stage TEXT    NOT NULL DEFAULT 'Vegetative',
      image_url    TEXT,
      ai_findings  TEXT,   -- JSON string
      status       TEXT    NOT NULL DEFAULT 'Reviewed',
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── NPK Readings ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS npk_readings (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      zone         TEXT    NOT NULL,
      nitrogen     REAL    NOT NULL,
      phosphorus   REAL    NOT NULL,
      potassium    REAL    NOT NULL,
      moisture_pct REAL    NOT NULL,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Alerts ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS alerts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      level        TEXT    NOT NULL,  -- High, Medium, Low, Info
      category     TEXT    NOT NULL,  -- crop, environment, soil, robot, connectivity
      title        TEXT    NOT NULL,
      description  TEXT,
      action_label TEXT,
      resolved     INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      resolved_at  TEXT
    );

    -- ─── Activity Log ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS activity_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      category   TEXT    NOT NULL,
      message    TEXT    NOT NULL,
      metadata   TEXT,   -- JSON string
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Irrigation Logs ────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS irrigation_logs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      zone          TEXT    NOT NULL,
      duration_min  REAL    NOT NULL,
      water_liters  REAL,
      trigger_type  TEXT    NOT NULL DEFAULT 'manual',  -- manual, auto, ai
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Irrigation Schedule ────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS irrigation_schedule (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      zone            TEXT    NOT NULL,
      scheduled_time  TEXT    NOT NULL,
      duration_min    REAL    NOT NULL,
      source          TEXT    NOT NULL DEFAULT 'scheduled',  -- scheduled, ai_recommended
      status          TEXT    NOT NULL DEFAULT 'pending',    -- pending, running, completed, cancelled
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Robot Telemetry ────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS robot_telemetry (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      battery_pct     REAL    NOT NULL,
      speed           REAL    NOT NULL DEFAULT 0,
      gps_lat         REAL,
      gps_lng         REAL,
      gps_accuracy    REAL,
      lidar_status    TEXT    NOT NULL DEFAULT 'Healthy',
      encoder_status  TEXT    NOT NULL DEFAULT 'Healthy',
      current_mission TEXT,
      waypoint_current INTEGER DEFAULT 0,
      waypoint_total   INTEGER DEFAULT 0,
      timestamp       TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Robot Missions ─────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS robot_missions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      status       TEXT    NOT NULL DEFAULT 'queued',  -- queued, running, completed, failed
      progress_pct REAL    DEFAULT 0,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      started_at   TEXT,
      completed_at TEXT
    );

    -- ─── Chat Messages ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS chat_messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT    NOT NULL,
      role       TEXT    NOT NULL,  -- user, assistant
      content    TEXT    NOT NULL,
      metadata   TEXT,   -- JSON string (tags, charts, etc.)
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Farm Settings ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS farm_settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Water Tank ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS water_tank (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      level_pct   REAL    NOT NULL,
      liters      REAL    NOT NULL,
      capacity    REAL    NOT NULL DEFAULT 4000,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `)
}

/** Raw db access (skips singleton init guard for use inside initSchema) */
function getDbRaw(): DatabaseSync {
  return db
}

export function closeDb() {
  if (db) {
    db.close()
  }
}
