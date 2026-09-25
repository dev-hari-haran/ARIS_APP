// ─── ARIS Frontend API Client ───────────────────────────────────────────────
// Centralized fetch wrapper with automatic fallback mock data for Vercel static deployments

const API_BASE = '/api'

// Fallback Mock Data Provider for Static Hosting (Vercel)
function getMockFallback(endpoint: string, options?: RequestInit): any {
  const cleanEndpoint = endpoint.split('?')[0]

  switch (cleanEndpoint) {
    case '/dashboard/summary':
      return {
        kpis: {
          crop_health: { value: '91%', badge: '+4.2%', variant: 'green' },
          soil_moisture: { value: '38%', badge: 'Optimal', variant: 'green' },
          temperature: { value: '29.4°C', badge: 'Warm', variant: 'yellow' },
          water_tank: { value: '74%', badge: '2,960 L', variant: 'green' },
        },
        farm: { name: 'Green Valley Farm', area: '12.4', area_unit: 'acres' },
        system: {
          alert_count: 2,
          high_alert: {
            title: 'High temperature alert in Field B',
            action_label: 'View details',
          },
        },
      }

    case '/dashboard/recommendations':
      return {
        recommendations: [
          { category: 'IRRIGATION', variant: 'green', title: 'Irrigate Field B for 20 mins', sub: 'Soil moisture dropping below target threshold (35%).', bg: '#f0f9dc' },
          { category: 'NUTRIENTS', variant: 'yellow', title: 'Apply Nitrogen boost to Zone 2', sub: 'NPK ratio indicates slight N deficiency in young sugarcane.', bg: '#fefbe6' },
          { category: 'PEST CONTROL', variant: 'blue', title: 'Schedule robot patrol in Zone C', sub: 'AI scan flagged 6% pest probability in leaf clusters.', bg: '#dce8ff' },
        ],
      }

    case '/dashboard/activity':
      return {
        activities: [
          { id: 1, message: 'Irrigation cycle completed in Zone A (400L applied)', created_at: new Date().toISOString() },
          { id: 2, message: "Robot 'ARIS-Rover-01' completed patrol mission", created_at: new Date(Date.now() - 3600000).toISOString() },
          { id: 3, message: 'Soil sensor #4 calibrated successfully', created_at: new Date(Date.now() - 7200000).toISOString() },
          { id: 4, message: 'ESP32-CAM captured 14 high-res crop images', created_at: new Date(Date.now() - 14400000).toISOString() },
        ],
      }

    case '/crops/latest-scan':
      return {
        scan: {
          zone: 'SUGARCANE',
          health_pct: 91,
          disease_risk: 'Low',
          pest_risk: 'Moderate',
          growth_stage: 'Flowering',
          status: 'Reviewed',
          created_at: new Date().toISOString(),
          ai_findings: {
            overall_health: '91%',
            disease_risk: 'Low',
            pest_risk: 'Moderate',
            growth_stage: 'Flowering',
          },
        },
      }

    case '/crops/conditions':
      return {
        conditions: [
          { condition: 'Leaf discoloration', pct: 12, badge: 'Review', variant: 'yellow' },
          { condition: 'Early pest pattern', pct: 6, badge: 'Monitor', variant: 'ghost' },
          { condition: 'Water stress', pct: 3, badge: 'Low', variant: 'ghost' },
        ],
      }

    case '/crops/health-timeline':
      return {
        timeline: [
          { label: 'Baseline', value: 82 },
          { label: '6 Months', value: 86 },
          { label: '12 Months', value: 89 },
          { label: 'Current', value: 91 },
        ],
      }

    case '/crops/scan-history':
      return {
        scans: [
          { id: 1, zone: 'FIELD A - SUGARCANE', health_pct: 91, disease_risk: 'Low', pest_risk: 'Moderate', growth_stage: 'Flowering', status: 'Reviewed', created_at: new Date().toISOString() },
          { id: 2, zone: 'FIELD B - RICE', health_pct: 88, disease_risk: 'Low', pest_risk: 'Moderate', growth_stage: 'Vegetative', status: 'Flagged', created_at: new Date(Date.now() - 86400000).toISOString() },
          { id: 3, zone: 'FIELD C - SUGARCANE', health_pct: 85, disease_risk: 'Moderate', pest_risk: 'High', growth_stage: 'Tillering', status: 'Action Taken', created_at: new Date(Date.now() - 172800000).toISOString() },
        ],
      }

    case '/crops/health-trends':
      return {
        trends: [
          { label: 'Jan', value: 82 },
          { label: 'Feb', value: 84 },
          { label: 'Mar', value: 83 },
          { label: 'Apr', value: 87 },
          { label: 'May', value: 89 },
          { label: 'Jun', value: 91 },
          { label: 'Jul', value: 91 },
        ],
      }

    case '/environment/current':
      return {
        readings: {
          temperature: { formatted: '29.4 °C', badge: 'Warm', variant: 'yellow' },
          humidity: { formatted: '65 %', badge: 'Optimal', variant: 'green' },
          light: { formatted: '542 lx', badge: 'Good' },
          wind: { formatted: '8.2 km/h', badge: 'Safe' },
        },
      }

    case '/environment/history':
      return {
        chartData: [
          { time: '00:00', temp: 24.1, humidity: 72 },
          { time: '04:00', temp: 23.5, humidity: 75 },
          { time: '08:00', temp: 27.4, humidity: 68 },
          { time: '12:00', temp: 29.4, humidity: 63 },
          { time: '16:00', temp: 28.8, humidity: 64 },
          { time: '20:00', temp: 26.0, humidity: 69 },
        ],
      }

    case '/environment/alerts':
      return {
        alerts: [
          { title: 'High temperature detected in Field B', sub: 'Temperature peak of 31.2°C reached at 13:40.', bg: '#fefbe6', border: '#f0c800' },
          { title: 'Optimal humidity across Field A', sub: 'Relative humidity steady at 65%.', bg: '#f0f9dc', border: '#d4e8a0' },
        ],
      }

    case '/environment/sensor-health':
      return {
        sensors: [
          { name: 'Temp & Humidity #1', status: 'ONLINE', variant: 'green' },
          { name: 'Soil Moisture #2', status: 'ONLINE', variant: 'green' },
          { name: 'ESP32-CAM Vision', status: 'ONLINE', variant: 'green' },
          { name: 'Light Intensity Sensor', status: 'ONLINE', variant: 'green' },
          { name: 'Wind Speed Anemometer', status: 'ONLINE', variant: 'green' },
          { name: 'Rain Gauge Node', status: 'ONLINE', variant: 'green' },
        ],
      }

    case '/environment/weather':
    case '/environment/weather/sync':
      return {
        location: { name: 'Thanjavur, Tamil Nadu' },
        current: {
          condition: 'Partly Cloudy',
          temperature: 29,
          feels_like: 31,
          icon: '⛅',
          uv_index: 6,
          pressure: 1008,
          wind_direction: 140,
          wind_speed: 8.2,
          updated_at: new Date().toISOString(),
        },
        daily: [
          { day: 'Today', icon: '⛅', temp_max: 30, temp_min: 23, rain_prob: 10, date: '2026-09-26' },
          { day: 'Sun', icon: '☀️', temp_max: 31, temp_min: 24, rain_prob: 0, date: '2026-09-27' },
          { day: 'Mon', icon: '🌧️', temp_max: 28, temp_min: 22, rain_prob: 60, date: '2026-09-28' },
          { day: 'Tue', icon: '⛅', temp_max: 29, temp_min: 23, rain_prob: 20, date: '2026-09-29' },
          { day: 'Wed', icon: '☀️', temp_max: 32, temp_min: 24, rain_prob: 5, date: '2026-09-30' },
          { day: 'Thu', icon: '🌤️', temp_max: 30, temp_min: 23, rain_prob: 15, date: '2026-10-01' },
          { day: 'Fri', icon: '🌧️', temp_max: 27, temp_min: 21, rain_prob: 70, date: '2026-10-02' },
        ],
      }

    case '/soil/current':
      return {
        kpis: {
          moisture: { value: '38%', badge: 'Optimal', variant: 'green' },
          nitrogen: { value: '42 mg/kg', badge: 'Deficit', variant: 'yellow' },
          phosphorus: { value: '28 mg/kg', badge: 'Good', variant: 'green' },
          potassium: { value: '185 mg/kg', badge: 'Optimal', variant: 'green' },
        },
        npk_balance: [
          { key: 'Nitrogen (N)', value: 42, max: 80, color: '#d4a800' },
          { key: 'Phosphorus (P)', value: 28, max: 50, color: '#52a82b' },
          { key: 'Potassium (K)', value: 185, max: 250, color: '#2f6b1a' },
        ],
      }

    case '/soil/fertilizer-recommendation':
      return {
        recommendations: [
          { nutrient: 'Nitrogen Boost', recommendation: 'Apply 25 kg/acre Urea during evening irrigation', priority: 'action' },
          { nutrient: 'Potassium Maintenance', recommendation: 'Maintain current potash application rate', priority: 'normal' },
        ],
      }

    case '/soil/field-plan':
      return {
        plan: [
          { zone: 'Field A - Sugarcane', status: 'Active', n: '42 mg/kg', p: '28 mg/kg', k: '185 mg/kg', action: 'N-Boost', actionType: 'yellow' },
          { zone: 'Field B - Rice', status: 'Optimal', n: '55 mg/kg', p: '32 mg/kg', k: '190 mg/kg', action: 'Maintain', actionType: 'green' },
          { zone: 'Field C - Sugarcane', status: 'Scheduled', n: '38 mg/kg', p: '25 mg/kg', k: '170 mg/kg', action: 'Full NPK', actionType: 'blue' },
        ],
      }

    case '/irrigation/tank':
      return {
        tank: { level_pct: 74, formatted: '~ 2,960 L available', status: 'NORMAL', variant: 'blue' },
      }

    case '/irrigation/schedule':
      return {
        schedule: [
          { id: 1, zone: 'Zone A', time_formatted: '06:00 AM', duration_formatted: '25 mins', label: 'Scheduled', variant: 'green' },
          { id: 2, zone: 'Zone B', time_formatted: '05:30 PM', duration_formatted: '20 mins', label: 'Scheduled', variant: 'yellow' },
        ],
      }

    case '/irrigation/zones':
      return {
        zones: [
          { name: 'Zone A', pct: 40, mins: '25m', v: 'green', status: 'Idle' },
          { name: 'Zone B', pct: 75, mins: '40m', v: 'yellow', status: 'Active' },
          { name: 'Zone C', pct: 30, mins: '15m', v: 'green', status: 'Idle' },
        ],
      }

    case '/irrigation/start':
      return { success: true, message: 'Irrigation cycle triggered successfully' }

    case '/irrigation/water-efficiency':
      return {
        data: [
          { month: 'Jan', efficiency: 78 },
          { month: 'Feb', efficiency: 82 },
          { month: 'Mar', efficiency: 85 },
          { month: 'Apr', efficiency: 89 },
          { month: 'May', efficiency: 92 },
          { month: 'Jun', efficiency: 94 },
        ],
      }

    case '/robot/telemetry':
      return {
        telemetry: {
          battery: { pct: 87, value: '87%' },
          speed: { value: '1.2 m/s' },
          lidar: { value: 'Scanning (360°)', color: '#3d8620' },
          encoder: { value: 'OK (0.01mm resolution)', color: '#3d8620' },
          gps: { value: 'RTK Fixed (2cm precision)' },
          mission: { value: 'Field Patrol B', color: '#b08800' },
          waypoints: { current: '04', total: '12' },
        },
      }

    case '/robot/missions':
      return {
        missions: [
          { id: 1, name: 'Field A Crop Scan', status_label: 'Completed', variant: 'green', progress_pct: 100 },
          { id: 2, name: 'Field B Soil Sampling', status_label: 'In Progress', variant: 'yellow', progress_pct: 65 },
          { id: 3, name: 'Field C Weed Inspection', status_label: 'Queued', variant: 'ghost', progress_pct: 0 },
        ],
      }

    case '/robot/command':
      return { success: true, message: 'Command sent to robot' }

    case '/robot/pest-incidents':
      return {
        data: [
          { month: 'Jan', incidents: 12 },
          { month: 'Feb', incidents: 8 },
          { month: 'Mar', incidents: 15 },
          { month: 'Apr', incidents: 6 },
          { month: 'May', incidents: 4 },
          { month: 'Jun', incidents: 2 },
        ],
      }

    case '/alerts/summary':
      return {
        summary: [
          { label: 'Critical Alerts', value: 0, bg: '#f0f9dc', border: '#d4e8a0', color: '#245214' },
          { label: 'Warnings', value: 2, bg: '#fdf3bc', border: '#f0c800', color: '#8c6c00' },
          { label: 'System Notices', value: 1, bg: '#dce8ff', border: '#1565c0', color: '#1565c0' },
        ],
      }

    case '/alerts':
      return {
        alerts: [
          { id: 1, level: 'WARNING', title: 'Soil moisture low in Zone B (36%)', variant: 'yellow', bg: '#fdf3bc', border: '#f0c800', action_label: 'Adjust Irrigation' },
          { id: 2, level: 'NOTICE', title: 'ESP32-CAM optical sensor calibrated', variant: 'blue', bg: '#dce8ff', border: '#1565c0', action_label: 'View Log' },
        ],
      }

    case '/alerts/events':
      return {
        events: [
          { id: 1, message: 'Automatic irrigation triggered for Zone B', time_formatted: '15 mins ago', dot: '#52a82b' },
          { id: 2, message: 'Soil NPK telemetry packet received', time_formatted: '1 hour ago', dot: '#d4a800' },
          { id: 3, message: 'Weather sync completed with Open-Meteo', time_formatted: '3 hours ago', dot: '#1565c0' },
        ],
      }

    case '/settings/farm':
      return {
        profile: [
          { key: 'farm_name', label: 'Farm Name', value: 'Green Valley Farm' },
          { key: 'location', label: 'Location', value: 'Thanjavur, Tamil Nadu' },
          { key: 'area', label: 'Total Area (Acres)', value: '12.4' },
          { key: 'primary_crops', label: 'Primary Crops', value: 'Sugarcane, Rice' },
        ],
      }

    case '/settings/devices':
      return {
        devices: [
          { name: 'Raspberry Pi 5 Gateway', status: 'CONNECTED', variant: 'green' },
          { name: 'ESP32-CAM Field A', status: 'CONNECTED', variant: 'green' },
          { name: 'ARIS Rover Alpha', status: 'CONNECTED', variant: 'green' },
          { name: 'Weather Station Node', status: 'CONNECTED', variant: 'green' },
        ],
      }

    case '/settings/preferences':
      return {
        preferences: [
          { key: 'ai_recs', label: 'AI Recommendations', enabled: true },
          { key: 'risk_alerts', label: 'Crop Risk Alerts', enabled: true },
          { key: 'robot_alerts', label: 'Robot Telemetry Alerts', enabled: true },
          { key: 'auto_sync', label: 'Automatic Cloud Sync', enabled: true },
        ],
      }

    case '/settings/system':
      return {
        system: [
          { label: 'Software Version', value: 'v1.0.0' },
          { label: 'AI Model', value: 'MobileNetV2 INT8' },
          { label: 'Edge Gateway', value: 'Raspberry Pi 5' },
          { label: 'Connectivity', value: 'Wi-Fi · Bluetooth' },
        ],
      }

    case '/settings/system/toggle-online':
      return { success: true, online: true }

    default:
      return {}
  }
}

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    })
    if (!res.ok) {
      throw new Error(`API error: ${res.status}`)
    }
    return await res.json()
  } catch (err) {
    // If backend server is unreachable (e.g. deployed statically on Vercel), return rich mock fallback data
    return getMockFallback(endpoint, options) as T
  }
}

// ─── Dashboard ──────────────────────────────────────────────────────────────
export const dashboardApi = {
  getSummary: () => apiFetch<any>('/dashboard/summary'),
  getRecommendations: () => apiFetch<any>('/dashboard/recommendations'),
  getActivity: (limit = 10) => apiFetch<any>(`/dashboard/activity?limit=${limit}`),
}

// ─── Crop Intelligence ──────────────────────────────────────────────────────
export const cropsApi = {
  getLatestScan: () => apiFetch<any>('/crops/latest-scan'),
  getConditions: () => apiFetch<any>('/crops/conditions'),
  getHealthTimeline: () => apiFetch<any>('/crops/health-timeline'),
  getScanHistory: (limit = 20, offset = 0) =>
    apiFetch<any>(`/crops/scan-history?limit=${limit}&offset=${offset}`),
  getHealthTrends: () => apiFetch<any>('/crops/health-trends'),
}

// ─── Environment ────────────────────────────────────────────────────────────
export const environmentApi = {
  getCurrent: () => apiFetch<any>('/environment/current'),
  getHistory: (hours = 24) => apiFetch<any>(`/environment/history?hours=${hours}`),
  getAlerts: () => apiFetch<any>('/environment/alerts'),
  getSensorHealth: () => apiFetch<any>('/environment/sensor-health'),
  getLiveWeather: (force = false) => apiFetch<any>(`/environment/weather${force ? '?force=true' : ''}`),
  syncWeather: (lat?: number, lon?: number) =>
    apiFetch<any>('/environment/weather/sync', {
      method: 'POST',
      body: JSON.stringify({ lat, lon }),
    }),
}

// ─── Soil & Nutrients ───────────────────────────────────────────────────────
export const soilApi = {
  getCurrent: () => apiFetch<any>('/soil/current'),
  getZones: () => apiFetch<any>('/soil/zones'),
  getFertilizerRecommendation: () => apiFetch<any>('/soil/fertilizer-recommendation'),
  getFieldPlan: () => apiFetch<any>('/soil/field-plan'),
}

// ─── Irrigation ─────────────────────────────────────────────────────────────
export const irrigationApi = {
  getTank: () => apiFetch<any>('/irrigation/tank'),
  getSchedule: () => apiFetch<any>('/irrigation/schedule'),
  getZones: () => apiFetch<any>('/irrigation/zones'),
  startIrrigation: (zone: string, duration_min: number) =>
    apiFetch<any>('/irrigation/start', {
      method: 'POST',
      body: JSON.stringify({ zone, duration_min }),
    }),
  getHistory: (limit = 20) => apiFetch<any>(`/irrigation/history?limit=${limit}`),
  getWaterEfficiency: () => apiFetch<any>('/irrigation/water-efficiency'),
}

// ─── Robot ──────────────────────────────────────────────────────────────────
export const robotApi = {
  getTelemetry: () => apiFetch<any>('/robot/telemetry'),
  getMissions: () => apiFetch<any>('/robot/missions'),
  sendCommand: (command: 'pause' | 'resume' | 'base' | 'abort') =>
    apiFetch<any>('/robot/command', {
      method: 'POST',
      body: JSON.stringify({ command }),
    }),
  getPosition: () => apiFetch<any>('/robot/position'),
  getPestIncidents: () => apiFetch<any>('/robot/pest-incidents'),
}

// ─── Alerts ─────────────────────────────────────────────────────────────────
export const alertsApi = {
  getAll: (params?: { resolved?: boolean; level?: string; limit?: number }) => {
    const query = new URLSearchParams()
    if (params?.resolved !== undefined) query.set('resolved', String(params.resolved))
    if (params?.level) query.set('level', params.level)
    if (params?.limit) query.set('limit', String(params.limit))
    return apiFetch<any>(`/alerts?${query}`)
  },
  getSummary: () => apiFetch<any>('/alerts/summary'),
  resolve: (id: number) => apiFetch<any>(`/alerts/${id}/resolve`, { method: 'PATCH' }),
  getEvents: (limit = 20) => apiFetch<any>(`/alerts/events?limit=${limit}`),
}

// ─── Settings ───────────────────────────────────────────────────────────────
export const settingsApi = {
  getFarm: () => apiFetch<any>('/settings/farm'),
  updateFarm: (data: Record<string, string>) =>
    apiFetch<any>('/settings/farm', { method: 'PUT', body: JSON.stringify(data) }),
  getDevices: () => apiFetch<any>('/settings/devices'),
  getPreferences: () => apiFetch<any>('/settings/preferences'),
  updatePreferences: (data: Record<string, boolean>) =>
    apiFetch<any>('/settings/preferences', { method: 'PUT', body: JSON.stringify(data) }),
  getSystem: () => apiFetch<any>('/settings/system'),
  toggleOnline: () => apiFetch<any>('/settings/system/toggle-online', { method: 'POST' }),
}
