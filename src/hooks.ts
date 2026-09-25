// ─── React Hooks for Backend Data ───────────────────────────────────────────
// Generic data fetching hook + specialized hooks for each domain

import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Generic fetch hook ─────────────────────────────────────────────────────

type UseFetchState<T> = {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useFetch<T>(
  fetcher: () => Promise<T>,
  deps: any[] = [],
  options?: { interval?: number; enabled?: boolean }
): UseFetchState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const fetchData = useCallback(async () => {
    if (options?.enabled === false) return
    try {
      setLoading(prev => prev || !data) // Only show loading on first load
      const result = await fetcherRef.current()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch')
    } finally {
      setLoading(false)
    }
  }, [options?.enabled, ...deps])

  useEffect(() => {
    fetchData()

    // Auto-refresh interval
    if (options?.interval) {
      const timer = setInterval(fetchData, options.interval)
      return () => clearInterval(timer)
    }
  }, [fetchData, options?.interval])

  return { data, loading, error, refetch: fetchData }
}

// ─── useSocket hook ─────────────────────────────────────────────────────────
// Lightweight WebSocket hook using EventSource / polling fallback
// (Socket.IO client would be added as a dependency for full WS support)

type SocketCallback = (data: any) => void

export function useRealtimeUpdates(callbacks?: {
  onSensorUpdate?: SocketCallback
  onAlertNew?: SocketCallback
  onRobotPosition?: SocketCallback
  onSystemStatus?: SocketCallback
}) {
  useEffect(() => {
    // Poll for updates every 30 seconds as a lightweight alternative to Socket.IO
    // For full WebSocket support, install socket.io-client and connect to the backend
    const interval = setInterval(async () => {
      try {
        // Health check doubles as heartbeat
        const res = await fetch('/api/health')
        if (res.ok) {
          callbacks?.onSystemStatus?.({ online: true, timestamp: new Date().toISOString() })
        }
      } catch {
        callbacks?.onSystemStatus?.({ online: false, timestamp: new Date().toISOString() })
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [])
}
