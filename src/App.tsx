import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar, AreaChart, Area
} from 'recharts'
import {
  dashboardApi, cropsApi, environmentApi, soilApi,
  irrigationApi, robotApi, alertsApi, settingsApi,
} from './api'
import { useFetch } from './hooks'

// ─── Palette ─────────────────────────────────────────────────────────────────
const G = {
  // greens
  g950: '#0d2207', g900: '#1a3a0e', g800: '#245214', g700: '#2f6b1a',
  g600: '#3d8620', g500: '#52a82b', g400: '#70c040', g300: '#9cd468',
  g200: '#c4e89c', g100: '#dff2bc', g50: '#f0f9dc',
  // yellows
  y900: '#4a3800', y800: '#6b5200', y700: '#8c6c00', y600: '#b08800',
  y500: '#d4a800', y400: '#f0c800', y300: '#f6d840', y200: '#fae880',
  y100: '#fdf3bc', y50: '#fefbe6',
  // page
  bg: '#f5f9e8', surface: '#ffffff', surfaceAlt: '#f8fce6',
  sidebar: '#1a3a0e', sidebarHover: '#245214', sidebarActive: '#f0c800',
  border: '#d4e8a0', borderLight: '#e8f4c4',
  textPrimary: '#1a3a0e', textSecondary: '#3d5c28', textMuted: '#6a8c4a', textDim: '#a0bc7a',
  // alerts
  red: '#c62828', redBg: '#fde8e8',
  blue: '#1565c0', blueBg: '#dce8ff',
}

const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',         icon: '⌂' },
  { id: 'crop',        label: 'Crop Intelligence',  icon: '🌿' },
  { id: 'environment', label: 'Environment',        icon: '🌡' },
  { id: 'soil',        label: 'Soil & Nutrients',   icon: '🧪' },
  { id: 'irrigation',  label: 'Irrigation',         icon: '💧' },
  { id: 'robot',       label: 'Robot Operations',   icon: '🤖' },
  { id: 'history',     label: 'History',            icon: '📉' },
  { id: 'alerts',      label: 'Alerts & Events',    icon: '🔔' },
  { id: 'settings',    label: 'Settings',           icon: '⚙' },
]

// ─── Shared UI ────────────────────────────────────────────────────────────────

type BadgeVariant = 'green' | 'yellow' | 'red' | 'blue' | 'ghost'

function Badge({ children, variant = 'green' }: { children: React.ReactNode; variant?: BadgeVariant }) {
  const map: Record<BadgeVariant, string> = {
    green:  'bg-[#dff2bc] text-[#245214]',
    yellow: 'bg-[#fdf3bc] text-[#8c6c00]',
    red:    'bg-[#fde8e8] text-[#c62828]',
    blue:   'bg-[#dce8ff] text-[#1565c0]',
    ghost:  'bg-[#f0f9dc] text-[#6a8c4a] border border-[#d4e8a0]',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${map[variant]}`}>
      {children}
    </span>
  )
}

function Card({ children, className = '', yellow = false }: {
  children: React.ReactNode; className?: string; yellow?: boolean
}) {
  return (
    <div className={`rounded-2xl border ${yellow ? 'bg-[#fdf3bc] border-[#f0c800]' : 'bg-white border-[#d4e8a0]'} ${className}`}>
      {children}
    </div>
  )
}

function KpiCard({ label, value, badge, variant = 'green', accent = false }: {
  label: string; value: string; badge?: string; variant?: BadgeVariant; accent?: boolean
}) {
  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-2 ${accent ? 'bg-[#f0c800] border-[#d4a800]' : 'bg-white border-[#d4e8a0]'}`}>
      <span className={`text-xs font-semibold tracking-wide uppercase ${accent ? 'text-[#6b5200]' : 'text-[#6a8c4a]'}`}>{label}</span>
      <span className={`text-3xl font-bold ${accent ? 'text-[#1a3a0e]' : 'text-[#1a3a0e]'}`}>{value}</span>
      {badge && <Badge variant={variant}>{badge}</Badge>}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-widest text-[#6a8c4a] mb-1">{children}</p>
}

function PageHeader({ title, sub, badge, variant = 'green' }: {
  title: string; sub?: string; badge?: string; variant?: BadgeVariant
}) {
  return (
    <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
      <div>
        <h1 className="text-2xl font-bold text-[#1a3a0e]">{title}</h1>
        {sub && <p className="text-sm text-[#6a8c4a] mt-1">{sub}</p>}
      </div>
      {badge && <Badge variant={variant}>{badge}</Badge>}
    </div>
  )
}

function ProgressBar({ pct, yellow = false }: { pct: number; yellow?: boolean }) {
  return (
    <div className="h-2.5 bg-[#e8f4c4] rounded-full overflow-hidden">
      <div
        className="h-full bar-animated rounded-full"
        style={{ width: `${pct}%`, backgroundColor: yellow ? G.y400 : G.g500 }}
      />
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-3 border-[#d4e8a0] border-t-[#52a82b] rounded-full animate-spin" />
    </div>
  )
}

function FieldMap() {
  const greens = [G.g700, G.g600, G.g500, G.g400, G.g300, '#4a7c3f']
  return (
    <div className="rounded-xl overflow-hidden border border-[#c4e89c]" style={{ background: '#e4f2b8' }}>
      <div className="p-3">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} className="rounded aspect-[4/2.5]"
              style={{ backgroundColor: i === 32 || i === 33 ? G.y300 : greens[i % greens.length] }} />
          ))}
        </div>
        <div className="flex gap-4 mt-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ background: G.g600 }} />
            <span className="text-[10px] font-semibold text-[#245214] tracking-wide">FIELD A · SUGARCANE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ background: G.y300 }} />
            <span className="text-[10px] font-semibold text-[#6b5200] tracking-wide">FIELD B · RICE</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ active, setActive, onClose }: {
  active: string; setActive: (s: string) => void; onClose?: () => void
}) {
  return (
    <aside className="w-[184px] shrink-0 flex flex-col h-full" style={{ background: G.sidebar }}>
      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: '#245214' }}>
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: G.y400 }}>
            <span className="text-xs font-bold" style={{ color: G.g900 }}>A</span>
          </div>
          <span className="text-lg font-bold text-white">ARIS</span>
        </div>
        <p className="text-[11px]" style={{ color: G.g300 }}>AI Farm Intelligence</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => { setActive(item.id); onClose?.() }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-all"
              style={{
                background: isActive ? G.y400 : 'transparent',
                color: isActive ? G.g900 : G.g200,
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = G.sidebarHover }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className={`font-medium ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Status */}
      <div className="px-5 py-4 border-t" style={{ borderColor: '#245214' }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: G.g400 }}>Field Status</p>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse-dot" style={{ background: G.y400 }} />
          <span className="text-sm font-semibold text-white">ARIS online</span>
        </div>
        <p className="text-[11px] mt-0.5" style={{ color: G.g300 }}>Last sync · 2 min ago</p>
      </div>
    </aside>
  )
}

// ─── Mobile header ────────────────────────────────────────────────────────────

function MobileHeader({ active, onMenu }: { active: string; onMenu: () => void }) {
  const page = NAV_ITEMS.find(n => n.id === active)
  return (
    <header className="md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-20 border-b border-[#d4e8a0]"
      style={{ background: G.sidebar }}>
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: G.y400 }}>
          <span className="text-xs font-bold" style={{ color: G.g900 }}>A</span>
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight">{page?.label ?? 'ARIS'}</p>
          <p className="text-[10px]" style={{ color: G.g300 }}>AI Farm Intelligence</p>
        </div>
      </div>
      <button onClick={onMenu}
        className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-xl transition-colors"
        style={{ background: '#245214' }}>
        <span className="w-4 h-0.5 rounded-full bg-white" />
        <span className="w-4 h-0.5 rounded-full bg-white" />
        <span className="w-4 h-0.5 rounded-full bg-white" />
      </button>
    </header>
  )
}

// ─── Mobile drawer ────────────────────────────────────────────────────────────

function MobileDrawer({ open, active, setActive, onClose }: {
  open: boolean; active: string; setActive: (s: string) => void; onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="md:hidden fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-64 flex flex-col h-full z-50 animate-slide-in-left" style={{ background: G.sidebar }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#245214' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: G.y400 }}>
              <span className="text-xs font-bold" style={{ color: G.g900 }}>A</span>
            </div>
            <span className="text-base font-bold text-white">ARIS</span>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-lg leading-none">✕</button>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const isActive = active === item.id
            return (
              <button key={item.id} onClick={() => { setActive(item.id); onClose() }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-all"
                style={{ background: isActive ? G.y400 : 'transparent', color: isActive ? G.g900 : G.g200 }}>
                <span className="text-base leading-none">{item.icon}</span>
                <span className={`font-medium ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="px-5 py-4 border-t" style={{ borderColor: '#245214' }}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full animate-pulse-dot" style={{ background: G.y400 }} />
            <span className="text-sm font-semibold text-white">ARIS online</span>
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: G.g300 }}>Last sync · 2 min ago</p>
        </div>
      </div>
    </div>
  )
}

// ─── Mobile bottom nav ────────────────────────────────────────────────────────

function MobileBottomNav({ active, setActive }: { active: string; setActive: (s: string) => void }) {
  const tabs = NAV_ITEMS.slice(0, 5)
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-[#d4e8a0] flex"
      style={{ background: G.sidebar }}>
      {tabs.map(item => {
        const isActive = active === item.id
        return (
          <button key={item.id} onClick={() => setActive(item.id)}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors">
            <span className={`text-xl leading-none ${isActive ? '' : 'opacity-50'}`}>{item.icon}</span>
            <span className="text-[9px] font-semibold"
              style={{ color: isActive ? G.y400 : G.g300 }}>
              {item.label.split(' ')[0]}
            </span>
            {isActive && <span className="w-1.5 h-1.5 rounded-full" style={{ background: G.y400 }} />}
          </button>
        )
      })}
    </nav>
  )
}

// ─── Dashboard (LIVE) ─────────────────────────────────────────────────────────

function Dashboard({ isSystemOnline, toggleOnline }: { isSystemOnline: boolean, toggleOnline: () => void }) {
  const { data: summary } = useFetch(() => dashboardApi.getSummary(), [], { interval: 15000 })
  const { data: recs } = useFetch(() => dashboardApi.getRecommendations(), [], { interval: 30000 })
  const { data: activity } = useFetch(() => dashboardApi.getActivity(), [], { interval: 10000 })

  const kpis = summary?.kpis
  const farm = summary?.farm

  return (
    <div className="p-5 md:p-7 animate-fade-in-up space-y-5">
      {/* Hero header */}
      <div className="rounded-2xl p-5 md:p-6 flex items-start justify-between flex-wrap gap-3"
        style={{ background: `linear-gradient(135deg, ${G.g800} 0%, ${G.g600} 100%)` }}>
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: G.y300 }}>Good morning, Farmer 👋</p>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Here's what ARIS sees today</h1>
          <p className="text-sm mt-1" style={{ color: G.g200 }}>{new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })} · {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} · {farm?.name ?? 'Farm'}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant="yellow">ALL SYSTEMS NORMAL</Badge>
          <div className="flex items-center gap-2 cursor-pointer select-none" onClick={toggleOnline}>
            <span className={`w-2 h-2 rounded-full ${isSystemOnline ? 'animate-pulse-dot' : ''}`} style={{ background: isSystemOnline ? G.y400 : '#9ca3af' }} />
            <span className="text-sm font-medium" style={{ color: isSystemOnline ? G.g100 : '#9ca3af' }}>{isSystemOnline ? 'ARIS online' : 'ARIS offline'}</span>
          </div>
        </div>
      </div>

      {/* KPIs — from API */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Crop Health"   value={kpis?.crop_health?.value ?? '—'}     badge={kpis?.crop_health?.badge}    variant={(kpis?.crop_health?.variant as BadgeVariant) ?? 'green'}  accent />
        <KpiCard label="Soil Moisture" value={kpis?.soil_moisture?.value ?? '—'}    badge={kpis?.soil_moisture?.badge}   variant={(kpis?.soil_moisture?.variant as BadgeVariant) ?? 'green'} />
        <KpiCard label="Temperature"   value={kpis?.temperature?.value ?? '—'}     badge={kpis?.temperature?.badge}    variant={(kpis?.temperature?.variant as BadgeVariant) ?? 'yellow'} />
        <KpiCard label="Water Tank"    value={kpis?.water_tank?.value ?? '—'}      badge={kpis?.water_tank?.badge}     variant={(kpis?.water_tank?.variant as BadgeVariant) ?? 'green'} />
      </div>

      {/* Farm overview + right col */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-[#1a3a0e] text-base">Farm overview</h3>
              <p className="text-xs text-[#6a8c4a]">Live field intelligence · {farm?.area ?? '12.4'} acres</p>
            </div>
            <Badge variant="green">LIVE</Badge>
          </div>
          <FieldMap />
        </Card>

        <div className="space-y-4">
          
          {/* High Alerts Dashboard Card */}
          <div className="rounded-2xl p-4 bg-red-600 border border-red-700 shadow-md">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-red-100 mb-1">High priority alerts</p>
                <p className="text-xs text-red-200">Requires immediate action</p>
              </div>
              <div className="px-2 py-1 rounded bg-red-800 text-red-100 text-[10px] font-bold tracking-wider">{summary?.system?.alert_count ?? 0} NEW</div>
            </div>
            <div className="mt-3 bg-red-700 rounded-lg p-3 border border-red-800">
              <div className="flex items-center gap-3">
                <div className="px-2 py-0.5 rounded bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider">HIGH</div>
                <p className="text-sm font-bold text-white">{summary?.system?.high_alert?.title ?? 'No high alerts'}</p>
              </div>
              <button className="mt-2 text-xs font-bold text-red-200 hover:text-white transition-colors w-full text-left">
                {summary?.system?.high_alert?.action_label ?? 'All clear'} →
              </button>
            </div>
          </div>

          {/* Crop health card */}
          <Card className="p-4" yellow>
            <div className="flex items-start justify-between mb-2">
              <div>
                <SectionLabel>Crop health</SectionLabel>
                <p className="text-xs text-[#8c6c00]">Overall field condition</p>
              </div>
              <Badge variant="green">LOW RISK</Badge>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-4xl font-bold text-[#1a3a0e]">{kpis?.crop_health?.value ?? '—'}</span>
              <span className="text-sm font-bold text-[#3d8620]">{kpis?.crop_health?.badge ?? ''}</span>
            </div>
            <p className="text-xs text-[#8c6c00] mt-1">+4.2% vs last week</p>
          </Card>

          {/* Environment */}
          <Card className="p-4">
            <h4 className="font-bold text-[#1a3a0e] text-sm mb-3">Environment</h4>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Temp', value: kpis?.temperature?.value ?? '—', color: G.y600 },
                { label: 'Humidity', value: kpis?.soil_moisture?.value ?? '—', color: G.g600 },
                { label: 'Light', value: '542 lx', color: G.g700 },
              ].map(e => (
                <div key={e.label} className="text-center p-2 rounded-xl" style={{ background: G.g50 }}>
                  <p className="text-[10px] text-[#6a8c4a] mb-0.5">{e.label}</p>
                  <p className="text-sm font-bold" style={{ color: e.color }}>{e.value}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Recommendations + Activity — from API */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-bold text-[#1a3a0e] mb-4">ARIS recommendations</h3>
          <div className="space-y-3">
            {(recs?.recommendations ?? []).map((r: any) => (
              <div key={r.title} className="p-3 rounded-xl flex items-start gap-3 border border-[#e8f4c4]"
                style={{ background: r.bg }}>
                <Badge variant={r.variant as BadgeVariant}>{r.category}</Badge>
                <div>
                  <p className="text-sm font-semibold text-[#1a3a0e]">{r.title}</p>
                  <p className="text-xs text-[#6a8c4a] mt-0.5">{r.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-[#1a3a0e] mb-4">Recent activity</h3>
          <div className="space-y-3">
            {(activity?.activities ?? []).slice(0, 5).map((a: any, i: number) => (
              <div key={a.id ?? i} className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: G.g500 }} />
                <div>
                  <p className="text-sm text-[#1a3a0e]">{a.message}</p>
                  <p className="text-xs text-[#6a8c4a]">{formatActivityTime(a.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function formatActivityTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    return isToday ? `Today · ${time}` : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`
  } catch { return dateStr }
}

// ─── Crop Intelligence (LIVE) ─────────────────────────────────────────────────

function CropIntelligence() {
  const [showHistory, setShowHistory] = useState(false)
  const { data: scanData } = useFetch(() => cropsApi.getLatestScan(), [], { interval: 30000 })
  const { data: conditionsData } = useFetch(() => cropsApi.getConditions(), [], { interval: 30000 })
  const { data: timelineData } = useFetch(() => cropsApi.getHealthTimeline(), [])
  const { data: historyData } = useFetch(() => cropsApi.getScanHistory(), [], { enabled: showHistory })

  const scan = scanData?.scan
  const findings = scan?.ai_findings

  if (showHistory) {
    return (
      <div className="p-5 md:p-7 animate-fade-in-up space-y-5 pb-24">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => setShowHistory(false)} className="text-[#3d5c28] hover:text-[#1a3a0e] transition-colors p-2 -ml-2 rounded-lg hover:bg-[#e8f4c4]">
            ← Back
          </button>
          <h2 className="text-xl font-bold text-[#1a3a0e]">Scan History</h2>
        </div>
        
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-[#e8f4c4]">
            {(historyData?.scans ?? []).map((scan: any, i: number) => (
              <div key={scan.id ?? i} className="p-4 flex items-center justify-between hover:bg-white/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[#e8f4c4] flex items-center justify-center text-lg">📷</div>
                  <div>
                    <h4 className="font-bold text-[#1a3a0e]">{scan.zone}</h4>
                    <p className="text-xs text-[#6a8c4a]">{formatActivityTime(scan.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="hidden md:block">
                    <p className="text-[#6a8c4a] text-xs">Health</p>
                    <p className="font-bold text-[#1a3a0e]">{scan.health_pct}%</p>
                  </div>
                  <div className="hidden md:block">
                    <p className="text-[#6a8c4a] text-xs">Pest Risk</p>
                    <p className={`font-bold ${scan.pest_risk === 'High' ? 'text-red-600' : scan.pest_risk === 'Moderate' ? 'text-[#ca8a04]' : 'text-[#16a34a]'}`}>{scan.pest_risk}</p>
                  </div>
                  <Badge variant={scan.status === 'Flagged' ? 'yellow' : scan.status === 'Action Taken' ? 'blue' : 'ghost'}>{scan.status}</Badge>
                  <span className="text-[#6a8c4a] hidden sm:inline">→</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-5 md:p-7 animate-fade-in-up space-y-5">
      <PageHeader title="Crop Intelligence" sub="Visual health analysis from ESP32-CAM and field observations." badge="AI MODEL · ONLINE" variant="green" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#1a3a0e]">Latest crop scan</h3>
            <Badge variant="yellow">{scan?.zone ?? 'SUGARCANE'} · FIELD A</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl aspect-[4/3] flex items-center justify-center border border-[#fca5a5]"
              style={{ background: '#fef2f2' }}>
              <div className="text-center flex flex-col items-center">
                <p className="text-2xl mb-2 opacity-40 grayscale">📷</p>
                <p className="text-xs font-semibold text-[#991b1b] tracking-wide mb-2">CAM IMAGE</p>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-full shadow-sm border border-[#f87171]">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                  <span className="text-[10px] font-bold text-red-600 uppercase tracking-wide">Cam not Connected</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-[#1a3a0e] mb-3">AI findings</h4>
              <div className="space-y-2.5">
                {[
                  { label: 'Overall health', value: findings?.overall_health ?? `${scan?.health_pct ?? 91}%`, color: G.g700 },
                  { label: 'Disease risk',   value: findings?.disease_risk ?? scan?.disease_risk ?? 'Low', color: G.g600 },
                  { label: 'Pest risk',      value: findings?.pest_risk ?? scan?.pest_risk ?? 'Moderate', color: G.y600 },
                  { label: 'Growth stage',   value: findings?.growth_stage ?? scan?.growth_stage ?? 'Flowering', color: G.blue },
                ].map(f => (
                  <div key={f.label} className="flex justify-between items-center pb-2.5 border-b border-[#e8f4c4] last:border-0">
                    <span className="text-sm text-[#6a8c4a]">{f.label}</span>
                    <span className="text-sm font-bold" style={{ color: f.color }}>{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-[#1a3a0e] mb-4">Detected conditions</h3>
          <div className="space-y-5">
            {(conditionsData?.conditions ?? []).map((d: any) => (
              <div key={d.condition}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-[#1a3a0e]">{d.condition}</span>
                  <Badge variant={(d.variant as BadgeVariant) ?? 'ghost'}>{d.badge}</Badge>
                </div>
                <p className="text-3xl font-bold text-[#1a3a0e]">{d.pct}%</p>
                <ProgressBar pct={d.pct * 5} yellow={d.variant === 'yellow'} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-bold text-[#1a3a0e] mb-1">Health timeline</h3>
        <p className="text-xs text-[#6a8c4a] mb-4">Baseline → 6 months → 12 months → current</p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timelineData?.timeline ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={G.borderLight} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: G.textMuted }} tickLine={false} axisLine={false} />
              <YAxis domain={[75, 95]} tick={{ fontSize: 11, fill: G.textMuted }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#fff', border: `1px solid ${G.border}`, borderRadius: 10, fontSize: 12 }} />
              <Bar dataKey="value" fill={G.g500} radius={[6, 6, 0, 0]} name="Health %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-4 border-t border-[#e8f4c4]">
          <div>
            <p className="font-bold text-[#1a3a0e]">Recommended action</p>
            <p className="text-sm text-[#6a8c4a] mt-0.5">Continue current irrigation schedule. Re-scan Zone 3 within 24 hours.</p>
          </div>
          <button className="px-5 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap hover:bg-[#d4a800]"
            style={{ background: G.y400, color: G.g900 }}
            onClick={() => setShowHistory(true)}>
            OPEN SCAN HISTORY
          </button>
        </div>
      </Card>
    </div>
  )
}

// ─── Environment (LIVE) ───────────────────────────────────────────────────────

function Environment() {
  const { data: current, refetch: refetchSensors } = useFetch(() => environmentApi.getCurrent(), [], { interval: 15000 })
  const { data: history } = useFetch(() => environmentApi.getHistory(24), [], { interval: 60000 })
  const { data: envAlerts } = useFetch(() => environmentApi.getAlerts(), [], { interval: 30000 })
  const { data: sensorHealth } = useFetch(() => environmentApi.getSensorHealth(), [], { interval: 30000 })
  const { data: liveWeather, refetch: refetchWeather } = useFetch(() => environmentApi.getLiveWeather(), [], { interval: 60000 })
  const [syncing, setSyncing] = useState(false)
  const [syncSuccess, setSyncSuccess] = useState(false)

  const handleSyncWeather = async () => {
    try {
      setSyncing(true)
      await environmentApi.syncWeather()
      refetchSensors()
      refetchWeather()
      setSyncSuccess(true)
      setTimeout(() => setSyncSuccess(false), 3000)
    } catch {
      window.alert('Failed to sync weather')
    } finally {
      setSyncing(false)
    }
  }

  const r = current?.readings
  const cw = liveWeather?.current

  return (
    <div className="p-5 md:p-7 animate-fade-in-up space-y-5">
      <PageHeader
        title="Environment & Microclimate"
        sub="Live sensor telemetry synchronized with Open-Meteo meteorological satellite data."
        badge={`${sensorHealth?.sensors?.filter((s: any) => s.status === 'ONLINE').length ?? 6} SENSORS ONLINE`}
        variant="green"
      />

      {/* ─── Real-Time Weather Satellite & Meteorological Banner ─── */}
      <Card className="p-5 overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #1a3a0e 0%, #245214 60%, #15320c 100%)' }}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 relative z-10">
          <div className="flex items-start md:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-inner shrink-0"
              style={{ background: 'rgba(255, 255, 255, 0.12)', border: '1px solid rgba(240, 200, 0, 0.4)' }}>
              {cw?.icon ?? '⛅'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-white font-bold text-lg">{liveWeather?.location?.name ?? 'Thanjavur, Tamil Nadu'}</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase"
                  style={{ background: 'rgba(240, 200, 0, 0.2)', color: '#fae880', border: '1px solid rgba(240, 200, 0, 0.4)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#fae880] animate-pulse-dot" />
                  Live Meteorological Feed
                </span>
              </div>
              <p className="text-white/80 text-xs">
                {cw?.condition ?? 'Partly Cloudy'} · Feels like <strong className="text-white">{cw?.feels_like ?? cw?.temperature ?? '28'}°C</strong> · Updated: {cw?.updated_at ? new Date(cw.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}
              </p>
            </div>
          </div>

          {/* Quick Metrics & Sync Button */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl border border-white/10" style={{ background: 'rgba(255, 255, 255, 0.08)' }}>
              <div>
                <p className="text-[10px] uppercase font-bold text-[#c4e89c]">UV Index</p>
                <p className="text-sm font-bold text-white">{cw?.uv_index ?? 0} <span className="text-[10px] text-white/60 font-normal">/ 11</span></p>
              </div>
              <div className="h-6 w-px bg-white/20" />
              <div>
                <p className="text-[10px] uppercase font-bold text-[#c4e89c]">Air Pressure</p>
                <p className="text-sm font-bold text-white">{Math.round(cw?.pressure ?? 1008)} <span className="text-[10px] text-white/60 font-normal">hPa</span></p>
              </div>
              <div className="h-6 w-px bg-white/20" />
              <div>
                <p className="text-[10px] uppercase font-bold text-[#c4e89c]">Wind Heading</p>
                <p className="text-sm font-bold text-white">{cw?.wind_direction ?? 0}° <span className="text-[10px] text-white/60 font-normal">{cw?.wind_speed ?? 0} km/h</span></p>
              </div>
            </div>

            <button
              onClick={handleSyncWeather}
              disabled={syncing}
              className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              style={{ background: syncSuccess ? '#70c040' : G.y400, color: G.g900 }}
            >
              {syncing ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-[#1a3a0e] border-t-transparent rounded-full animate-spin" />
                  <span>Syncing...</span>
                </>
              ) : syncSuccess ? (
                <>
                  <span>✓ Synced to Sensors</span>
                </>
              ) : (
                <>
                  <span>🔄 Sync Live Feed</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ─── 7-Day Meteorological Forecast ─── */}
        <div className="mt-5 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#dff2bc]">7-Day Agriculture Forecast</p>
            <span className="text-[10px] text-white/60">Source: Open-Meteo High-Resolution Model</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {(liveWeather?.daily ?? []).map((d: any, idx: number) => (
              <div
                key={d.date ?? idx}
                className="p-3 rounded-xl flex flex-col items-center justify-between text-center transition-all hover:bg-white/10"
                style={{
                  background: idx === 0 ? 'rgba(240, 200, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  border: idx === 0 ? '1px solid rgba(240, 200, 0, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <span className="text-[11px] font-bold text-white mb-1">{d.day}</span>
                <span className="text-2xl my-1">{d.icon}</span>
                <p className="text-[11px] text-white font-semibold">{d.temp_max}° <span className="text-white/60 font-normal">{d.temp_min}°</span></p>
                <div className="mt-1.5 flex items-center gap-1">
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold text-[#fae880]" style={{ background: 'rgba(0,0,0,0.25)' }}>
                    💧 {d.rain_prob}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ─── Current Live Sensor Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Temperature" value={r?.temperature?.formatted ?? (cw ? `${cw.temperature} °C` : '—')} badge={r?.temperature?.badge ?? 'Normal'}  variant={(r?.temperature?.variant as BadgeVariant) ?? 'yellow'} accent />
        <KpiCard label="Humidity"    value={r?.humidity?.formatted ?? (cw ? `${cw.humidity} %` : '—')}    badge={r?.humidity?.badge ?? 'Normal'}     variant={(r?.humidity?.variant as BadgeVariant) ?? 'green'} />
        <KpiCard label="Light"       value={r?.light?.formatted ?? '—'}      badge={r?.light?.badge ?? 'Good'}         variant="green" />
        <KpiCard label="Wind"        value={r?.wind?.formatted ?? (cw ? `${cw.wind_speed} km/h` : '—')}       badge={r?.wind?.badge ?? 'Safe'}          variant="ghost" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-[#1a3a0e]">24-hour temperature & humidity</h3>
            <span className="text-[11px] text-[#6a8c4a]">Hourly Sensor & Meteorological Trace</span>
          </div>
          <p className="text-xs text-[#6a8c4a] mb-4">Sensor history · Field A</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history?.chartData ?? []} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={G.borderLight} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: G.textMuted }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: G.textMuted }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#fff', border: `1px solid ${G.border}`, borderRadius: 10, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="temp"     stroke={G.y500} strokeWidth={2.5} dot={false} name="TEMPERATURE" />
                <Line type="monotone" dataKey="humidity" stroke={G.g500} strokeWidth={2.5} dot={false} name="HUMIDITY" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-[#1a3a0e] mb-4">Environmental alerts</h3>
          <div className="space-y-3">
            {(envAlerts?.alerts ?? []).map((a: any) => (
              <div key={a.title} className="p-3 rounded-xl border" style={{ background: a.bg, borderColor: a.border }}>
                <p className="text-sm font-bold text-[#1a3a0e]">{a.title}</p>
                <p className="text-xs text-[#6a8c4a] mt-0.5">{a.sub}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-bold text-[#1a3a0e] mb-4">Sensor & Data Feeds Health</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {(sensorHealth?.sensors ?? []).map((s: any) => (
            <div key={s.name} className="flex items-center justify-between p-3 rounded-xl border border-[#d4e8a0]"
              style={{ background: G.g50 }}>
              <span className="text-sm font-medium text-[#1a3a0e]">{s.name}</span>
              <Badge variant={(s.variant as BadgeVariant) ?? 'green'}>{s.status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ─── Soil & Nutrients (LIVE) ──────────────────────────────────────────────────

function SoilNutrients() {
  const [showPlan, setShowPlan] = useState(false)
  const { data: soilData } = useFetch(() => soilApi.getCurrent(), [], { interval: 30000 })
  const { data: fertData } = useFetch(() => soilApi.getFertilizerRecommendation(), [])
  const { data: planData } = useFetch(() => soilApi.getFieldPlan(), [], { enabled: showPlan })

  const kpis = soilData?.kpis
  const npk = soilData?.npk_balance ?? []

  if (showPlan) {
    return (
      <div className="p-5 md:p-7 animate-fade-in-up space-y-5 pb-24">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => setShowPlan(false)} className="text-[#3d5c28] hover:text-[#1a3a0e] transition-colors p-2 -ml-2 rounded-lg hover:bg-[#e8f4c4]">
            ← Back
          </button>
          <h2 className="text-xl font-bold text-[#1a3a0e]">Field Nutrient Plan</h2>
        </div>
        
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-[#e8f4c4]">
            {(planData?.plan ?? []).map((plan: any, i: number) => (
              <div key={i} className="p-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-white/50 transition-colors cursor-pointer gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[#e8f4c4] flex items-center justify-center text-lg">🧪</div>
                  <div>
                    <h4 className="font-bold text-[#1a3a0e]">{plan.zone}</h4>
                    <p className="text-xs text-[#6a8c4a]">Status: {plan.status}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm justify-between flex-1 md:flex-none">
                  <div className="flex gap-4">
                    <div className="hidden sm:block text-center">
                      <p className="text-[#6a8c4a] text-[10px]">Nitrogen</p>
                      <p className="font-bold text-[#1a3a0e] text-xs">{plan.n}</p>
                    </div>
                    <div className="hidden sm:block text-center">
                      <p className="text-[#6a8c4a] text-[10px]">Phosphorus</p>
                      <p className="font-bold text-[#1a3a0e] text-xs">{plan.p}</p>
                    </div>
                    <div className="hidden sm:block text-center">
                      <p className="text-[#6a8c4a] text-[10px]">Potassium</p>
                      <p className="font-bold text-[#1a3a0e] text-xs">{plan.k}</p>
                    </div>
                  </div>
                  
                  <div className="text-right flex items-center gap-4">
                    <Badge variant={(plan.actionType as BadgeVariant) || 'ghost'}>{plan.action}</Badge>
                    <span className="text-[#6a8c4a] hidden sm:inline">→</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-5 md:p-7 animate-fade-in-up space-y-5">
      <PageHeader title="Soil & Nutrient Intelligence" sub="NPK, moisture, and soil-zone analysis for actionable recommendations." badge="NPK SENSOR · CONNECTED" variant="green" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Moisture"   value={kpis?.moisture?.value ?? '—'}    badge={kpis?.moisture?.badge}    variant={(kpis?.moisture?.variant as BadgeVariant) ?? 'green'} accent />
        <KpiCard label="Nitrogen"   value={kpis?.nitrogen?.value ?? '—'}    badge={kpis?.nitrogen?.badge}    variant={(kpis?.nitrogen?.variant as BadgeVariant) ?? 'yellow'} />
        <KpiCard label="Phosphorus" value={kpis?.phosphorus?.value ?? '—'}  badge={kpis?.phosphorus?.badge}  variant={(kpis?.phosphorus?.variant as BadgeVariant) ?? 'green'} />
        <KpiCard label="Potassium"  value={kpis?.potassium?.value ?? '—'}   badge={kpis?.potassium?.badge}   variant={(kpis?.potassium?.variant as BadgeVariant) ?? 'green'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <h3 className="font-bold text-[#1a3a0e] mb-3">Soil zone map</h3>
          <FieldMap />
          <div className="mt-3 p-3 rounded-xl border border-[#d4e8a0]" style={{ background: G.g50 }}>
            <Badge variant="yellow">ZONE 1 · OPTIMAL</Badge>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-[#1a3a0e] mb-4">Nutrient balance</h3>
          <div className="space-y-5">
            {npk.map((n: any) => (
              <div key={n.key}>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-lg font-bold" style={{ color: n.color }}>{n.key}</span>
                  <span className="text-2xl font-bold text-[#1a3a0e]">{n.value}</span>
                  <span className="text-xs text-[#6a8c4a]">mg/kg</span>
                </div>
                <div className="h-2 bg-[#e8f4c4] rounded-full overflow-hidden">
                  <div className="h-full bar-animated rounded-full"
                    style={{ width: `${(n.value / n.max) * 100}%`, background: n.color }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5" yellow>
        <h3 className="font-bold text-[#1a3a0e] mb-1">Fertilizer recommendation</h3>
        <p className="text-xs text-[#8c6c00] mb-4">Based on current NPK readings and crop stage</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(fertData?.recommendations ?? []).map((rec: any, i: number) => (
            <div key={i} className={`p-4 rounded-xl bg-white border ${rec.priority === 'action' ? 'border-[#f0c800]' : 'border-[#d4e8a0]'}`}>
              <p className="text-xs text-[#6a8c4a] mb-1">{rec.nutrient}</p>
              <p className={`text-base ${rec.priority === 'action' ? 'font-bold text-[#2f6b1a]' : 'font-semibold text-[#1a3a0e]'}`}>{rec.recommendation}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-4">
          <button className="px-5 py-2 rounded-xl text-sm font-semibold transition-colors hover:bg-[#1a3a0e]"
            style={{ background: G.g800, color: '#fff' }}
            onClick={() => setShowPlan(true)}>
            VIEW FIELD PLAN
          </button>
        </div>
      </Card>
    </div>
  )
}

// ─── Irrigation (LIVE) ────────────────────────────────────────────────────────

function Irrigation() {
  const { data: tankData } = useFetch(() => irrigationApi.getTank(), [], { interval: 15000 })
  const { data: scheduleData } = useFetch(() => irrigationApi.getSchedule(), [], { interval: 30000 })
  const { data: zonesData, refetch: refetchZones } = useFetch(() => irrigationApi.getZones(), [], { interval: 30000 })

  const tank = tankData?.tank
  const zones = zonesData?.zones ?? []

  const handleStartIrrigation = useCallback(async () => {
    const mins = window.prompt("Enter irrigation duration in minutes:", "30")
    if (mins) {
      try {
        const result = await irrigationApi.startIrrigation('All zones', parseInt(mins))
        window.alert(`✅ ${result.message}`)
        refetchZones()
      } catch (err) {
        window.alert(`❌ Failed to start irrigation`)
      }
    }
  }, [refetchZones])

  return (
    <div className="p-5 md:p-7 animate-fade-in-up space-y-5">
      <PageHeader title="Irrigation Control" sub="Water demand, tank status, and AI-assisted irrigation planning." badge="AUTOMATION READY" variant="yellow" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-bold text-[#1a3a0e] mb-3">Main water tank</h3>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-5xl font-bold" style={{ color: G.g800 }}>{tank?.level_pct ?? 0}%</span>
          </div>
          <p className="text-sm text-[#6a8c4a] mb-3">{tank?.formatted ?? '~ 0 L available'}</p>
          <div className="h-3 bg-[#e8f4c4] rounded-full overflow-hidden mb-3">
            <div className="h-full bar-animated rounded-full" style={{ width: `${tank?.level_pct ?? 0}%`, background: `linear-gradient(90deg, ${G.g600}, ${G.y400})` }} />
          </div>
          <Badge variant={(tank?.variant as BadgeVariant) ?? 'blue'}>{tank?.status ?? 'CHECKING...'}</Badge>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-[#1a3a0e] mb-3">Today's irrigation plan</h3>
          <div className="space-y-3">
            {(scheduleData?.schedule ?? []).map((p: any) => (
              <div key={p.id ?? p.zone} className="flex items-center justify-between border-b border-[#e8f4c4] pb-3 last:border-0 last:pb-0">
                <span className="text-sm font-semibold text-[#1a3a0e] w-14">{p.zone}</span>
                <span className="text-sm text-[#6a8c4a]">{p.time_formatted}</span>
                <span className="text-sm text-[#6a8c4a]">{p.duration_formatted}</span>
                <Badge variant={(p.variant as BadgeVariant) ?? 'ghost'}>{p.label}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-bold text-[#1a3a0e] mb-4">Water demand by zone</h3>
        <div className="space-y-4">
          {zones.map((z: any) => (
            <div key={z.name} className="flex items-center gap-3">
              <span className="text-sm font-medium text-[#1a3a0e] w-16 flex-shrink-0">{z.name}</span>
              <div className="flex-1 h-3 bg-[#e8f4c4] rounded-full overflow-hidden">
                <div className="h-full bar-animated rounded-full"
                  style={{ width: `${z.pct}%`, background: z.v === 'yellow' ? G.y400 : `linear-gradient(90deg, ${G.g600}, ${G.g400})` }} />
              </div>
              <span className="text-sm text-[#6a8c4a] w-12 text-right flex-shrink-0">{z.mins}</span>
              <div className="w-20 flex-shrink-0 flex justify-end"><Badge variant={(z.v as BadgeVariant) ?? 'green'}>{z.status}</Badge></div>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-5">
          <button className="px-7 py-3 rounded-xl text-sm font-bold transition-colors shadow-sm hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${G.g700}, ${G.g500})`, color: '#fff' }}
            onClick={handleStartIrrigation}>
            START IRRIGATION
          </button>
        </div>
      </Card>
    </div>
  )
}

// ─── Robot Operations (LIVE) ──────────────────────────────────────────────────

function RobotOperations({ isSystemOnline }: { isSystemOnline: boolean }) {
  const { data: telemetryData } = useFetch(() => robotApi.getTelemetry(), [], { interval: 10000 })
  const { data: missionsData, refetch: refetchMissions } = useFetch(() => robotApi.getMissions(), [], { interval: 10000 })

  const t = telemetryData?.telemetry

  const handleCommand = useCallback(async (cmd: 'pause' | 'resume' | 'base' | 'abort') => {
    try {
      await robotApi.sendCommand(cmd)
      refetchMissions()
    } catch { /* ignore */ }
  }, [refetchMissions])

  return (
    <div className="p-5 md:p-7 animate-fade-in-up space-y-5">
      <PageHeader 
        title="Robot Operations" 
        sub="ARIS mobile robot status, navigation, missions, and telemetry." 
        badge={isSystemOnline ? "ROBOT · ONLINE" : "ROBOT · OFFLINE"} 
        variant={isSystemOnline ? "green" : "ghost"} 
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[#1a3a0e]">Live navigation</h3>
            <Badge variant="yellow">SLAM · ACTIVE</Badge>
          </div>
          <div className="relative rounded-xl overflow-hidden border border-[#c4e89c]"
            style={{ height: 220, background: '#e4f2b8' }}>
            <div className="absolute inset-0"
              style={{ backgroundImage: `linear-gradient(${G.g300}33 1px, transparent 1px), linear-gradient(90deg, ${G.g300}33 1px, transparent 1px)`, backgroundSize: '36px 36px' }} />
            
            {/* Interactive SVG Farm Map */}
            <svg width="100%" height="100%" className="absolute inset-0 z-0">
              {/* Farm Zones */}
              <rect x="5%" y="10%" width="30%" height="40%" fill={G.g200} stroke={G.g400} strokeWidth="1" opacity={0.6} rx="4" />
              <text x="20%" y="30%" fill={G.g700} fontSize="10" fontWeight="bold" textAnchor="middle">ZONE A</text>

              <rect x="40%" y="10%" width="25%" height="30%" fill={G.g100} stroke={G.g300} strokeWidth="1" opacity={0.6} rx="4" />
              <text x="52.5%" y="25%" fill={G.g700} fontSize="10" fontWeight="bold" textAnchor="middle">ZONE B</text>

              <rect x="70%" y="15%" width="20%" height="60%" fill={G.y100} stroke={G.y400} strokeWidth="2" opacity={0.6} rx="4" />
              <text x="80%" y="45%" fill={G.y600} fontSize="10" fontWeight="bold" textAnchor="middle">ZONE C (Alert)</text>

              <rect x="5%" y="60%" width="60%" height="30%" fill={G.g200} stroke={G.g400} strokeWidth="1" opacity={0.6} rx="4" />
              <text x="35%" y="75%" fill={G.g700} fontSize="10" fontWeight="bold" textAnchor="middle">ZONE D</text>

              {/* Paths */}
              <path d="M 15% 20% L 30% 35% L 55% 25% L 44% 52% L 70% 50% L 85% 70%" stroke={G.g600} strokeWidth="2" strokeDasharray="4 4" fill="none" className="opacity-50" />
            </svg>

            <style>{`
              @keyframes robotPatrol {
                0% { left: 15%; top: 20%; }
                20% { left: 30%; top: 35%; }
                40% { left: 55%; top: 25%; }
                60% { left: 44%; top: 52%; }
                80% { left: 70%; top: 50%; }
                100% { left: 85%; top: 70%; }
              }
              .animate-robot-patrol {
                animation: robotPatrol 24s linear infinite alternate;
              }
            `}</style>

            <p className="absolute top-3 left-3 text-[10px] font-bold text-[#3d5c28] tracking-widest uppercase z-10">Field Map</p>
            {/* Robot */}
            <div className="absolute z-10 animate-robot-patrol" style={{ transform: 'translate(-50%,-50%)', animationPlayState: isSystemOnline ? 'running' : 'paused' }}>
              <div className="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
                style={{ background: G.g800 }}>
                <span className="text-white text-[10px] font-bold">R</span>
              </div>
              <div className="absolute inset-0 rounded-full border-2 animate-ping opacity-40"
                style={{ borderColor: G.y400 }} />
            </div>
            {/* Waypoints */}
            {[[15, 20], [30, 35], [55, 25], [70, 50], [85, 70]].map(([x, y], i) => (
              <div key={i} className="absolute w-2 h-2 rounded-full border border-white"
                style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', background: i < 4 ? G.g600 : G.g200 }} />
            ))}
            <p className="absolute bottom-3 left-3 text-[10px] font-bold tracking-wide" style={{ color: G.g700 }}>
              WAYPOINT {t?.waypoints?.current ?? '04'} / {t?.waypoints?.total ?? '12'}
            </p>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-[#1a3a0e] mb-4">Robot telemetry</h3>
          <div className="space-y-2.5 mb-4">
            {[
              { label: 'Battery',  value: t?.battery?.value ?? '—',  color: G.g600 },
              { label: 'Speed',    value: t?.speed?.value ?? '—',    color: G.textPrimary },
              { label: 'LIDAR',    value: t?.lidar?.value ?? '—',    color: t?.lidar?.color ?? G.g600 },
              { label: 'Encoder',  value: t?.encoder?.value ?? '—',  color: t?.encoder?.color ?? G.g600 },
              { label: 'GPS',      value: t?.gps?.value ?? '—',      color: G.textPrimary },
              { label: 'Mission',  value: t?.mission?.value ?? '—',  color: t?.mission?.color ?? G.y600 },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center border-b border-[#e8f4c4] pb-2 last:border-0">
                <span className="text-sm text-[#6a8c4a]">{item.label}</span>
                <span className="text-sm font-bold" style={{ color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>
          {/* Battery bar */}
          <div className="mb-4">
            <ProgressBar pct={t?.battery?.pct ?? 0} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => handleCommand('pause')} className="py-2 rounded-xl text-xs font-bold transition-colors border border-[#f0c800]"
              style={{ background: G.y50, color: G.y700 }}>PAUSE</button>
            <button onClick={() => handleCommand('base')} className="py-2 rounded-xl text-xs font-bold text-white transition-colors"
              style={{ background: G.g700 }}>TO BASE</button>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-bold text-[#1a3a0e] mb-4">Mission queue</h3>
        <div className="space-y-3">
          {(missionsData?.missions ?? []).map((m: any) => (
            <div key={m.id ?? m.name} className="flex items-center gap-4 p-3 rounded-xl border border-[#e8f4c4]"
              style={{ background: G.g50 }}>
              <span className="flex-1 text-sm font-semibold text-[#1a3a0e]">{m.name}</span>
              <Badge variant={(m.variant as BadgeVariant) ?? 'ghost'}>{m.status_label}</Badge>
              {m.progress_pct > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-[#e8f4c4] rounded-full overflow-hidden">
                    <div className="h-full bar-animated rounded-full" style={{ width: `${m.progress_pct}%`, background: G.g500 }} />
                  </div>
                  <span className="text-xs font-bold text-[#3d8620]">{m.progress_pct}%</span>
                </div>
              ) : <span className="text-sm text-[#a0bc7a] w-24 text-right">—</span>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ─── Alerts & Events (LIVE) ───────────────────────────────────────────────────

function AlertsEvents() {
  const { data: summaryData } = useFetch(() => alertsApi.getSummary(), [], { interval: 15000 })
  const { data: alertsData, refetch: refetchAlerts } = useFetch(() => alertsApi.getAll({ resolved: false }), [], { interval: 15000 })
  const { data: eventsData } = useFetch(() => alertsApi.getEvents(), [], { interval: 15000 })

  const handleResolve = useCallback(async (id: number) => {
    try {
      await alertsApi.resolve(id)
      refetchAlerts()
    } catch { /* ignore */ }
  }, [refetchAlerts])

  return (
    <div className="p-5 md:p-7 animate-fade-in-up space-y-5">
      <PageHeader title="Alerts & Events" sub="Prioritized alerts from crop, environment, soil, robot, and connectivity systems." badge={`${summaryData?.summary?.[0]?.value ?? '0'} NEED ATTENTION`} variant="yellow" />

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {(summaryData?.summary ?? []).map((s: any) => (
          <div key={s.label} className="rounded-2xl border p-4 text-center"
            style={{ background: s.bg, borderColor: s.border }}>
            <p className="text-4xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-sm text-[#6a8c4a] mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <h3 className="font-bold text-[#1a3a0e] mb-4">Active alerts</h3>
          <div className="space-y-3">
            {(alertsData?.alerts ?? []).map((a: any) => (
              <div key={a.id} className="rounded-xl p-4 border flex items-center gap-4"
                style={{ background: a.bg, borderColor: a.border }}>
                <Badge variant={(a.variant as BadgeVariant) ?? 'blue'}>{a.level}</Badge>
                <p className="flex-1 text-sm font-semibold text-[#1a3a0e]">{a.title}</p>
                <button onClick={() => handleResolve(a.id)} className="text-xs font-semibold text-[#3d8620] hover:text-[#1a3a0e] transition-colors flex-shrink-0 whitespace-nowrap">
                  {a.action_label ?? 'Resolve'} →
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-[#1a3a0e] mb-4">Event history</h3>
          <div className="space-y-3">
            {(eventsData?.events ?? []).slice(0, 6).map((e: any, i: number) => (
              <div key={e.id ?? i} className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: e.dot }} />
                <div>
                  <p className="text-sm text-[#1a3a0e]">{e.message}</p>
                  <p className="text-xs text-[#6a8c4a]">{e.time_formatted}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}



// ─── History (LIVE) ───────────────────────────────────────────────────────────

function History() {
  const { data: healthTrends } = useFetch(() => cropsApi.getHealthTrends(), [])
  const { data: waterData } = useFetch(() => irrigationApi.getWaterEfficiency(), [])
  const { data: pestData } = useFetch(() => robotApi.getPestIncidents(), [])

  return (
    <div className="p-5 md:p-7 animate-fade-in-up space-y-5 pb-24">
      <PageHeader title="History" sub="Long-term trends across crop health, resources, and risks." badge="6 MONTHS" variant="blue" />

      <Card className="p-5">
        <h3 className="font-bold text-[#1a3a0e] mb-1">Crop Health Trends</h3>
        <p className="text-xs text-[#6a8c4a] mb-4">Overall field vitality index</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={healthTrends?.trends ?? []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorHealthHistory" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={G.g500} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={G.g500} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={G.borderLight} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: G.textMuted }} tickLine={false} axisLine={false} />
              <YAxis domain={[60, 100]} tick={{ fontSize: 11, fill: G.textMuted }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#fff', border: `1px solid ${G.border}`, borderRadius: 10, fontSize: 12 }} />
              <Area type="monotone" dataKey="value" stroke={G.g600} strokeWidth={3} fillOpacity={1} fill="url(#colorHealthHistory)" name="Health %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 pt-4 border-t border-[#e8f4c4]">
          <p className="text-sm text-[#3d5c28] leading-relaxed">
            <strong>Insight:</strong> Health stabilized &gt;90% since May following spring nutrient adjustments.
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-bold text-[#1a3a0e] mb-1">Water Efficiency</h3>
          <p className="text-xs text-[#6a8c4a] mb-4">Water consumed vs delivery efficiency (%)</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterData?.data ?? []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={G.borderLight} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: G.textMuted }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: G.textMuted }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#fff', border: `1px solid ${G.border}`, borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="efficiency" fill={G.blue} radius={[4, 4, 0, 0]} name="Efficiency %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 pt-4 border-t border-[#e8f4c4]">
            <p className="text-sm text-[#3d5c28] leading-relaxed">
              <strong>Insight:</strong> Efficiency improved by 14% after fixing Zone B drip lines in March.
            </p>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-[#1a3a0e] mb-1">Pest Incidents</h3>
          <p className="text-xs text-[#6a8c4a] mb-4">Recorded pest & disease outbreaks</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pestData?.data ?? []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={G.borderLight} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: G.textMuted }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: G.textMuted }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#fff', border: `1px solid ${G.border}`, borderRadius: 10, fontSize: 12 }} />
                <Line type="monotone" dataKey="incidents" stroke={G.y600} strokeWidth={3} dot={{ fill: G.y600, r: 4 }} name="Incidents" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 pt-4 border-t border-[#e8f4c4]">
            <p className="text-sm text-[#3d5c28] leading-relaxed">
              <strong>Insight:</strong> Outbreaks dropped to historical lows after introducing early AI drone scanning.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── Settings (LIVE) ──────────────────────────────────────────────────────────

function Settings() {
  const { data: farmData } = useFetch(() => settingsApi.getFarm(), [])
  const { data: devicesData } = useFetch(() => settingsApi.getDevices(), [], { interval: 30000 })
  const { data: prefsData, refetch: refetchPrefs } = useFetch(() => settingsApi.getPreferences(), [])
  const { data: systemData } = useFetch(() => settingsApi.getSystem(), [])

  const handleTogglePref = useCallback(async (key: string, currentValue: boolean) => {
    try {
      await settingsApi.updatePreferences({ [key]: !currentValue })
      refetchPrefs()
    } catch { /* ignore */ }
  }, [refetchPrefs])

  const handleSaveProfile = useCallback(async () => {
    // Collect values from form inputs
    const inputs = document.querySelectorAll<HTMLInputElement>('[data-farm-field]')
    const data: Record<string, string> = {}
    inputs.forEach(input => {
      const key = input.dataset.farmField!
      data[key] = input.value
    })
    try {
      await settingsApi.updateFarm(data)
      window.alert('✅ Farm profile saved!')
    } catch {
      window.alert('❌ Failed to save profile')
    }
  }, [])

  return (
    <div className="p-5 md:p-7 animate-fade-in-up space-y-5">
      <PageHeader title="Settings" sub="Configure ARIS, sensors, farm profile, AI behavior, and notifications." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-bold text-[#1a3a0e] mb-4">Farm profile</h3>
          <div className="space-y-3">
            {(farmData?.profile ?? []).map((f: any) => (
              <div key={f.key}>
                <label className="text-xs font-semibold text-[#6a8c4a] uppercase tracking-wide mb-1 block">{f.label}</label>
                <input defaultValue={f.value}
                  data-farm-field={f.key}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#d4e8a0] text-sm text-[#1a3a0e] focus:outline-none focus:border-[#70c040] transition-colors"
                  style={{ background: G.surfaceAlt }} />
              </div>
            ))}
            <button onClick={handleSaveProfile} className="w-full py-2.5 rounded-xl text-sm font-bold text-white mt-2 transition-colors"
              style={{ background: `linear-gradient(135deg, ${G.g700}, ${G.g500})` }}>
              Save Profile
            </button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-[#1a3a0e] mb-4">Connected devices</h3>
          <div className="grid grid-cols-1 gap-3">
            {(devicesData?.devices ?? []).map((d: any) => (
              <div key={d.name} className="flex items-center justify-between p-3 rounded-xl border border-[#d4e8a0]"
                style={{ background: G.g50 }}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${d.status === 'CONNECTED' ? 'animate-pulse-dot' : ''}`} style={{ background: d.variant === 'green' ? G.g500 : d.variant === 'yellow' ? G.y400 : G.red }} />
                  <span className="text-sm font-medium text-[#1a3a0e]">{d.name}</span>
                </div>
                <Badge variant={(d.variant as BadgeVariant) ?? 'green'}>{d.status}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-[#1a3a0e] mb-4">AI & notification preferences</h3>
          <div className="space-y-4">
            {(prefsData?.preferences ?? []).map((p: any) => (
              <div key={p.key} className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#1a3a0e]">{p.label}</span>
                <button onClick={() => handleTogglePref(p.key, p.enabled)}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                  style={{ background: p.enabled ? G.g500 : '#d4e8a0' }}>
                  <span className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
                    style={{ transform: p.enabled ? 'translateX(1.5rem)' : 'translateX(0.2rem)' }} />
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5" yellow>
          <h3 className="font-bold text-[#1a3a0e] mb-4">System</h3>
          <div className="space-y-3 mb-5">
            {(systemData?.system ?? []).map((s: any) => (
              <div key={s.label} className="flex justify-between border-b border-[#f0d060] pb-2.5 last:border-0">
                <span className="text-sm text-[#8c6c00]">{s.label}</span>
                <span className="text-sm font-bold text-[#1a3a0e]">{s.value}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="px-4 py-2 rounded-xl text-sm font-bold transition-colors"
              style={{ background: G.g800, color: '#fff' }}>
              RUN DIAGNOSTICS
            </button>
            <button className="px-4 py-2 rounded-xl text-sm font-semibold border border-[#d4a800] transition-colors"
              style={{ background: G.y100, color: G.y700 }}>
              EXPORT LOGS
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [active, setActive] = useState('dashboard')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isSystemOnline, setIsSystemOnline] = useState(true)

  const toggleOnline = useCallback(async () => {
    try {
      const result = await settingsApi.toggleOnline()
      setIsSystemOnline(result.online)
    } catch {
      setIsSystemOnline(prev => !prev)
    }
  }, [])

  const PANELS: Record<string, React.ReactNode> = {
    dashboard:   <Dashboard isSystemOnline={isSystemOnline} toggleOnline={toggleOnline} />,
    crop:        <CropIntelligence />,
    environment: <Environment />,
    soil:        <SoilNutrients />,
    irrigation:  <Irrigation />,
    robot:       <RobotOperations isSystemOnline={isSystemOnline} />,
    history:     <History />,
    alerts:      <AlertsEvents />,
    settings:    <Settings />,
  }

  return (
    <div className="min-h-screen" style={{ background: G.bg }}>
      {/* Mobile header */}
      <MobileHeader active={active} onMenu={() => setDrawerOpen(true)} />

      {/* Mobile drawer */}
      <MobileDrawer open={drawerOpen} active={active} setActive={setActive} onClose={() => setDrawerOpen(false)} />

      {/* Desktop: sidebar + content */}
      <div className="hidden md:flex h-screen">
        <Sidebar active={active} setActive={setActive} />
        <main className="flex-1 overflow-y-auto" style={{ background: G.bg }}>
          {PANELS[active]}
        </main>
      </div>

      {/* Mobile: stacked content */}
      <div className="md:hidden pb-20">
        {PANELS[active]}
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav active={active} setActive={setActive} />
    </div>
  )
}
