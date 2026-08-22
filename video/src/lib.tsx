import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

// ─── Design tokens, matched to the product ──────────────────────────────────

export const C = {
  bg: '#020408',
  panel: 'rgba(10,18,32,0.92)',
  border: 'rgba(22,42,72,0.9)',
  cyan: '#00d4ff',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#a78bfa',
  text: '#e2e8f0',
  bright: '#f1f6fc',
  muted: '#54708f',
}

export const SANS = "'Space Grotesk', system-ui, -apple-system, sans-serif"
export const MONO = "'JetBrains Mono', ui-monospace, monospace"

// ─── Timing helpers ─────────────────────────────────────────────────────────

/** Eased 0→1 over [from, from+len), clamped. */
export const ease = (frame: number, from: number, len: number) =>
  interpolate(frame, [from, from + len], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  })

/** Springy entrance value. */
export const pop = (frame: number, fps: number, delay = 0) =>
  spring({ frame: frame - delay, fps, config: { damping: 18, mass: 0.7, stiffness: 120 } })

/** Fade + rise wrapper. */
export const Rise: React.FC<{
  delay?: number
  y?: number
  children: React.ReactNode
  style?: React.CSSProperties
}> = ({ delay = 0, y = 26, children, style }) => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = pop(f, fps, delay)
  return (
    <div
      style={{
        position: 'relative',
        zIndex: 1,
        opacity: interpolate(p, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(p, [0, 1], [y, 0])}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── Number that counts up ──────────────────────────────────────────────────

export const Count: React.FC<{
  to: number
  from?: number
  delay?: number
  dur?: number
  decimals?: number
  suffix?: string
  prefix?: string
  style?: React.CSSProperties
}> = ({ to, from = 0, delay = 0, dur = 34, decimals = 0, suffix = '', prefix = '', style }) => {
  const f = useCurrentFrame()
  const t = ease(f, delay, dur)
  const v = from + (to - from) * t
  return (
    <span style={style}>
      {prefix}
      {v.toFixed(decimals)}
      {suffix}
    </span>
  )
}

// ─── Chrome ─────────────────────────────────────────────────────────────────

export const Backdrop: React.FC<{ hue?: string }> = ({ hue = C.cyan }) => {
  const f = useCurrentFrame()
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, zIndex: 0 }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          background: `radial-gradient(ellipse 70% 55% at 50% ${42 + Math.sin(f / 70) * 4}%, ${hue}14, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(0,212,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.045) 1px, transparent 1px)',
          backgroundSize: '68px 68px',
          zIndex: 0,
          maskImage: 'radial-gradient(ellipse 78% 68% at 50% 50%, #000 35%, transparent 78%)',
        }}
      />
    </>
  )
}

export const Eyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = C.cyan,
}) => (
  <div
    style={{
      fontFamily: MONO,
      fontSize: 21,
      letterSpacing: '0.34em',
      color,
      textTransform: 'uppercase',
      marginBottom: 26,
    }}
  >
    {children}
  </div>
)

export const Title: React.FC<{ children: React.ReactNode; size?: number }> = ({
  children,
  size = 82,
}) => (
  <div
    style={{
      fontFamily: SANS,
      fontSize: size,
      fontWeight: 600,
      color: C.bright,
      lineHeight: 1.1,
      letterSpacing: '-0.022em',
      maxWidth: 1500,
    }}
  >
    {children}
  </div>
)

export const Sub: React.FC<{ children: React.ReactNode; size?: number }> = ({
  children,
  size = 33,
}) => (
  <div
    style={{
      fontFamily: SANS,
      fontSize: size,
      color: '#9db2c9',
      lineHeight: 1.5,
      maxWidth: 1320,
      fontWeight: 300,
    }}
  >
    {children}
  </div>
)

export const Card: React.FC<{
  children: React.ReactNode
  accent?: string
  style?: React.CSSProperties
}> = ({ children, accent = C.border, style }) => (
  <div
    style={{
      background: C.panel,
      border: `1px solid ${accent}`,
      borderRadius: 18,
      padding: '26px 30px',
      ...style,
    }}
  >
    {children}
  </div>
)

/** Scene-corner label so the viewer always knows where they are. */
export const Chapter: React.FC<{ n: string; label: string }> = ({ n, label }) => (
  <div
    style={{
      position: 'absolute',
      left: 84,
      top: 66,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      fontFamily: MONO,
      fontSize: 17,
      letterSpacing: '0.2em',
      color: C.muted,
    }}
  >
    <span style={{ color: C.cyan }}>{n}</span>
    <span style={{ width: 40, height: 1, background: C.border }} />
    {label.toUpperCase()}
  </div>
)
