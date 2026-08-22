import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, SANS, MONO, ease, pop, Rise, Count, Backdrop, Eyebrow, Title, Sub, Card, Chapter } from './lib'

const centre: React.CSSProperties = {
  justifyContent: 'center',
  paddingLeft: 130,
  paddingRight: 130,
}

// ═══════════════════════════════════════════════════════════════════════════
// 01 · HOOK
// ═══════════════════════════════════════════════════════════════════════════

export const Hook: React.FC = () => {
  const f = useCurrentFrame()
  const grow = ease(f, 14, 60)
  return (
    <AbsoluteFill style={{ ...centre, background: C.bg }}>
      <Backdrop />
      {/* Expanding ring, like a signal leaving the planet */}
      {[0, 1, 2].map((i) => {
        const t = ease(f, 20 + i * 26, 95)
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 300 + t * 1500,
              height: 300 + t * 1500,
              marginLeft: -(150 + t * 750),
              marginTop: -(150 + t * 750),
              borderRadius: '50%',
              border: `1px solid rgba(0,212,255,${0.3 * (1 - t)})`,
            }}
          />
        )
      })}
      <Rise delay={6}>
        <Eyebrow>Orbital CDN</Eyebrow>
      </Rise>
      <Rise delay={16}>
        <Title size={102}>
          Two thirds of the planet
          <br />
          is <span style={{ color: C.cyan }}>far from a cloud region</span>.
        </Title>
      </Rise>
      <Rise delay={44} style={{ marginTop: 42 }}>
        <Sub size={37}>
          Every request they make crosses thousands of kilometres of undersea fibre
          <br />
          before anything begins to happen.
        </Sub>
      </Rise>
      <div
        style={{
          position: 'absolute',
          left: 130,
          bottom: 120,
          height: 3,
          width: grow * 1660,
          background: `linear-gradient(90deg, ${C.cyan}, ${C.purple})`,
          borderRadius: 2,
        }}
      />
    </AbsoluteFill>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 02 · THE PHYSICAL OPENING
// ═══════════════════════════════════════════════════════════════════════════

export const Physics: React.FC = () => {
  const f = useCurrentFrame()
  const fibre = ease(f, 34, 78)
  const vac = ease(f, 34, 53)   // reaches the end sooner — that is the point
  return (
    <AbsoluteFill style={{ ...centre, background: C.bg }}>
      <Backdrop hue={C.purple} />
      <Chapter n="01" label="Why orbit can win" />
      <Rise delay={4}>
        <Title size={72}>
          Light travels <span style={{ color: C.cyan }}>47% faster</span> through
          <br />
          empty space than through glass.
        </Title>
      </Rise>

      <div style={{ marginTop: 76, width: 1600, position: 'relative', zIndex: 1 }}>
        {[
          { label: 'Terrestrial fibre', p: fibre, col: C.muted, note: '204,190 km/s in silica' },
          { label: 'Vacuum laser crosslink', p: vac, col: C.cyan, note: '299,792 km/s' },
        ].map((r, i) => (
          <Rise key={r.label} delay={24 + i * 12} style={{ marginBottom: 40 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: MONO,
                fontSize: 22,
                color: r.col,
                marginBottom: 12,
                letterSpacing: '0.06em',
              }}
            >
              <span>{r.label.toUpperCase()}</span>
              <span style={{ opacity: 0.7 }}>{r.note}</span>
            </div>
            <div
              style={{
                height: 16,
                background: 'rgba(0,0,0,0.5)',
                borderRadius: 8,
                overflow: 'hidden',
                border: `1px solid ${C.border}`,
              }}
            >
              <div
                style={{
                  width: `${r.p * 100}%`,
                  height: '100%',
                  background:
                    r.col === C.cyan ? `linear-gradient(90deg, ${C.cyan}, ${C.purple})` : '#33506f',
                  borderRadius: 8,
                }}
              />
            </div>
          </Rise>
        ))}
      </div>

      <Rise delay={92} style={{ marginTop: 34 }}>
        <Sub size={35}>
          So a request that goes <b style={{ color: C.text }}>up</b>, crosses by laser and comes back
          down can arrive sooner — <b style={{ color: C.text }}>if the distance is far enough to
          repay the climb.</b>
        </Sub>
      </Rise>
    </AbsoluteFill>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 03 · THE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

const HopNode: React.FC<{ label: string; sub: string; on: number; i: number }> = ({
  label,
  sub,
  on,
  i,
}) => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = pop(f, fps, on)
  return (
    <div style={{ textAlign: 'center', opacity: p, transform: `scale(${0.86 + p * 0.14})` }}>
      <div
        style={{
          width: 92,
          height: 92,
          borderRadius: '50%',
          border: `2px solid ${i === 2 ? C.amber : C.cyan}`,
          background: `radial-gradient(circle, ${i === 2 ? 'rgba(245,158,11,0.18)' : 'rgba(0,212,255,0.14)'}, transparent 70%)`,
          display: 'grid',
          placeItems: 'center',
          fontFamily: MONO,
          fontSize: 27,
          color: i === 2 ? C.amber : C.cyan,
          margin: '0 auto 16px',
        }}
      >
        {i + 1}
      </div>
      <div style={{ fontFamily: SANS, fontSize: 25, color: C.bright, fontWeight: 500 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 17, color: C.muted, marginTop: 6 }}>{sub}</div>
    </div>
  )
}

export const System: React.FC = () => {
  const f = useCurrentFrame()
  const line = ease(f, 26, 96)
  const hops = [
    ['Origin', 'city'],
    ['Uplink', '550 km'],
    ['Orbital DC', '640 km · compute'],
    ['Downlink', 'teleport'],
    ['Delivered', 'user'],
  ]
  return (
    <AbsoluteFill style={{ ...centre, background: C.bg }}>
      <Backdrop />
      <Chapter n="02" label="The system" />
      <Rise delay={2}>
        <Title size={70}>
          <span style={{ color: C.cyan }}>180 satellites</span>, propagated from real orbital
          elements.
        </Title>
      </Rise>
      <Rise delay={16} style={{ marginTop: 24 }}>
        <Sub>
          Four orbital data centres. Eight ground stations at their real teleport coordinates.
        </Sub>
      </Rise>

      <div style={{ position: 'relative', zIndex: 1, marginTop: 96, width: 1660 }}>
        <div
          style={{
            position: 'absolute',
            top: 46,
            left: 46,
            height: 2,
            width: `calc((100% - 92px) * ${line})`,
            background: `linear-gradient(90deg, ${C.cyan}, ${C.amber}, ${C.cyan})`,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
          {hops.map(([l, s], i) => (
            <HopNode key={l} label={l} sub={s} on={30 + i * 15} i={i} />
          ))}
        </div>
      </div>

      <Rise delay={116} style={{ marginTop: 84 }}>
        <div style={{ display: 'flex', gap: 22 }}>
          {[
            ['Eclipse', 'data centres go dark', C.amber],
            ['Radiation', 'the South Atlantic Anomaly', C.red],
            ['Rain fade', 'ground stations close', C.cyan],
          ].map(([t, s, col], i) => (
            <Card key={t as string} accent={`${col}44`} style={{ flex: 1 }}>
              <div style={{ fontFamily: SANS, fontSize: 28, color: col as string, fontWeight: 600 }}>
                {t}
              </div>
              <div style={{ fontFamily: SANS, fontSize: 22, color: '#9db2c9', marginTop: 8 }}>{s}</div>
            </Card>
          ))}
        </div>
      </Rise>
      <Rise delay={140} style={{ marginTop: 30 }}>
        <Sub size={31}>Three constraints with no equivalent on the ground.</Sub>
      </Rise>
    </AbsoluteFill>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 04 · THE LINE — where orbital wins, and where it does not
// ═══════════════════════════════════════════════════════════════════════════

const CITIES: [string, number, number][] = [
  ['São Paulo', 7626, 100],
  ['Lagos', 4873, 89],
  ['Delhi', 4145, 90],
  ['Tokyo', 5322, 73],
  ['Sydney', 6305, 71],
  ['London', 637, 0],
  ['New York', 325, 0],
]

export const TheLine: React.FC = () => {
  const f = useCurrentFrame()
  return (
    <AbsoluteFill style={{ ...centre, background: C.bg }}>
      <Backdrop hue={C.green} />
      <Chapter n="03" label="The finding" />
      <Rise delay={2}>
        <Title size={68}>
          It wins where cloud regions are far away.
          <br />
          <span style={{ color: C.muted }}>It loses where they are close.</span>
        </Title>
      </Rise>

      <div style={{ marginTop: 62, width: 1620, position: 'relative', zIndex: 1 }}>
        {CITIES.map(([city, km, win], i) => {
          const t = ease(f, 26 + i * 8, 40)
          const col = win > 50 ? C.green : C.red
          return (
            <div
              key={city}
              style={{
                display: 'grid',
                gridTemplateColumns: '260px 190px 1fr 110px',
                alignItems: 'center',
                gap: 22,
                marginBottom: 17,
                opacity: ease(f, 22 + i * 8, 16),
              }}
            >
              <span style={{ fontFamily: SANS, fontSize: 30, color: C.bright }}>{city}</span>
              <span style={{ fontFamily: MONO, fontSize: 21, color: C.muted }}>
                {km.toLocaleString()} km
              </span>
              <div
                style={{
                  height: 22,
                  background: 'rgba(0,0,0,0.45)',
                  borderRadius: 11,
                  overflow: 'hidden',
                  border: `1px solid ${C.border}`,
                }}
              >
                <div
                  style={{
                    width: `${win * t}%`,
                    height: '100%',
                    background: col,
                    borderRadius: 11,
                    boxShadow: `0 0 18px ${col}66`,
                  }}
                />
              </div>
              <span style={{ fontFamily: MONO, fontSize: 27, color: col, textAlign: 'right' }}>
                <Count to={win} delay={26 + i * 8} dur={40} suffix="%" />
              </span>
            </div>
          )
        })}
      </div>

      <Rise delay={104} style={{ marginTop: 46 }}>
        <Card accent="rgba(16,185,129,0.4)">
          <div style={{ fontFamily: SANS, fontSize: 30, color: '#b8c7db', lineHeight: 1.5 }}>
            Published research puts the break-even distance at{' '}
            <b style={{ color: C.green, fontFamily: MONO }}>4,472 km</b>. We never fitted to that
            number — <b style={{ color: C.bright }}>our simulator found the same line on its own.</b>
          </div>
        </Card>
      </Rise>
    </AbsoluteFill>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 05 · RIGOUR — the standards implementation
// ═══════════════════════════════════════════════════════════════════════════

export const Rigour: React.FC = () => {
  const f = useCurrentFrame()
  const rows = [
    ['1 GHz', '0.0000259', '0.0000259'],
    ['12 GHz', '0.02386', '0.02386'],
    ['20 GHz', '0.09164', '0.09164'],
    ['30 GHz', '0.2403', '0.2403'],
  ]
  return (
    <AbsoluteFill style={{ ...centre, background: C.bg }}>
      <Backdrop hue={C.amber} />
      <Chapter n="04" label="Rigour" />
      <Rise delay={2}>
        <Title size={68}>
          We did not invent the physics.
          <br />
          <span style={{ color: C.amber }}>We implemented the standard — and tested it.</span>
        </Title>
      </Rise>
      <Rise delay={16} style={{ marginTop: 22 }}>
        <Sub>
          Rain fade is specified by the International Telecommunication Union. We built P.838-3,
          P.618-13 and P.839-4 exactly, then checked our code against the published tables.
        </Sub>
      </Rise>

      <Rise delay={38} style={{ marginTop: 54, width: 1400 }}>
        <Card>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 130px',
              fontFamily: MONO,
              fontSize: 19,
              color: C.muted,
              letterSpacing: '0.12em',
              paddingBottom: 16,
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <span>FREQUENCY</span>
            <span>ITU PUBLISHED</span>
            <span>OUR CODE</span>
            <span style={{ textAlign: 'right' }}>MATCH</span>
          </div>
          {rows.map((r, i) => (
            <div
              key={r[0]}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 130px',
                fontFamily: MONO,
                fontSize: 26,
                color: C.text,
                padding: '15px 0',
                borderBottom: i < rows.length - 1 ? `1px solid rgba(22,42,72,0.5)` : 'none',
                opacity: ease(f, 46 + i * 9, 16),
              }}
            >
              <span style={{ color: C.amber }}>{r[0]}</span>
              <span>{r[1]}</span>
              <span>{r[2]}</span>
              <span style={{ textAlign: 'right', color: C.green, fontSize: 24 }}>PASS</span>
            </div>
          ))}
        </Card>
      </Rise>

      <Rise delay={98} style={{ marginTop: 40 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
          <span style={{ fontFamily: MONO, fontSize: 76, color: C.green, fontWeight: 700 }}>
            <Count to={28} delay={98} dur={30} />/28
          </span>
          <span style={{ fontFamily: SANS, fontSize: 33, color: '#9db2c9' }}>
            published coefficients reproduced. A mistyped constant cannot pass silently.
          </span>
        </div>
      </Rise>
    </AbsoluteFill>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 06 · MEMORY + PREDICTION
// ═══════════════════════════════════════════════════════════════════════════

export const Predict: React.FC = () => {
  const f = useCurrentFrame()
  const risks = [
    ['+1h', 12],
    ['+3h', 97],
    ['+6h', 88],
    ['+12h', 64],
  ] as [string, number][]
  return (
    <AbsoluteFill style={{ ...centre, background: C.bg }}>
      <Backdrop hue={C.purple} />
      <Chapter n="05" label="It sees what is coming" />
      <Rise delay={2}>
        <Title size={68}>
          It learns from every request it has served —
          <br />
          then <span style={{ color: C.purple }}>forecasts what breaks next</span>.
        </Title>
      </Rise>
      <Rise delay={16} style={{ marginTop: 22 }}>
        <Sub>
          Four months of real NASA rainfall for the eight actual ground-station sites. The model only
          ever sees the past.
        </Sub>
      </Rise>

      <div style={{ display: 'flex', gap: 26, marginTop: 62, width: 1660, position: 'relative', zIndex: 1 }}>
        <Card accent="rgba(245,158,11,0.45)" style={{ flex: 1.1 }}>
          <div style={{ fontFamily: MONO, fontSize: 19, color: C.muted, letterSpacing: '0.14em' }}>
            MUMBAI GATEWAY · FADE RISK
          </div>
          <div style={{ display: 'flex', gap: 22, alignItems: 'flex-end', height: 210, marginTop: 26 }}>
            {risks.map(([lab, v], i) => {
              const t = ease(f, 40 + i * 10, 34)
              const col = v > 60 ? C.red : v > 30 ? C.amber : C.green
              return (
                <div key={lab} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontFamily: MONO, fontSize: 25, color: col, marginBottom: 10 }}>
                    <Count to={v} delay={40 + i * 10} dur={34} suffix="%" />
                  </div>
                  <div
                    style={{
                      height: 150,
                      background: 'rgba(0,0,0,0.4)',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'flex-end',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: `${v * t}%`,
                        background: col,
                        boxShadow: `0 0 20px ${col}55`,
                      }}
                    />
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 19, color: C.muted, marginTop: 10 }}>
                    {lab}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <div style={{ flex: 1.35, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {[
            [30, 'DETECT', 'Mumbai — 97% risk at +3h', C.amber],
            [58, 'DECIDE', 'Reroute Mumbai → Tokyo · saves 334 ms', C.purple],
            [86, 'VERIFY', 'Three hours later: fade hit 19.3 dB', C.green],
          ].map(([d, tag, txt, col]) => (
            <Rise key={tag as string} delay={d as number}>
              <Card accent={`${col}55`} style={{ padding: '22px 26px' }}>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 18,
                    letterSpacing: '0.16em',
                    color: col as string,
                    marginBottom: 9,
                  }}
                >
                  {tag}
                </div>
                <div style={{ fontFamily: SANS, fontSize: 29, color: C.bright }}>{txt}</div>
              </Card>
            </Rise>
          ))}
          <Rise delay={112}>
            <div style={{ fontFamily: SANS, fontSize: 27, color: '#9db2c9', marginTop: 6 }}>
              Every decision is scored against what actually happened.{' '}
              <b style={{ color: C.bright }}>A prediction nobody checks is just a claim.</b>
            </div>
          </Rise>
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 07 · THE EXPERIMENT
// ═══════════════════════════════════════════════════════════════════════════

export const Experiment: React.FC = () => {
  const f = useCurrentFrame()
  const arms: [string, number, string][] = [
    ['No weather awareness', 80, C.red],
    ['Sees current weather', 2, C.amber],
    ['Sees the forecast', 0, C.green],
    ['Forecast + autopilot', 0, C.green],
  ]
  return (
    <AbsoluteFill style={{ ...centre, background: C.bg }}>
      <Backdrop hue={C.green} />
      <Chapter n="06" label="Controlled experiment" />
      <Rise delay={2}>
        <Title size={68}>5,600 requests. 2,800 hours of real weather.</Title>
      </Rise>
      <Rise delay={14} style={{ marginTop: 20 }}>
        <Sub>Four strategies, identical conditions. Failed requests:</Sub>
      </Rise>

      <div style={{ marginTop: 56, width: 1620, position: 'relative', zIndex: 1 }}>
        {arms.map(([label, v, col], i) => {
          const t = ease(f, 30 + i * 13, 38)
          return (
            <div
              key={label}
              style={{
                display: 'grid',
                gridTemplateColumns: '520px 1fr 150px',
                alignItems: 'center',
                gap: 26,
                marginBottom: 24,
                opacity: ease(f, 26 + i * 13, 14),
              }}
            >
              <span style={{ fontFamily: SANS, fontSize: 31, color: C.bright }}>{label}</span>
              <div style={{ height: 30, background: 'rgba(0,0,0,0.4)', borderRadius: 15 }}>
                <div
                  style={{
                    width: `${(v / 80) * 100 * t}%`,
                    height: '100%',
                    background: col,
                    borderRadius: 15,
                    minWidth: v === 0 ? 0 : 6,
                    boxShadow: `0 0 20px ${col}55`,
                  }}
                />
              </div>
              <span
                style={{ fontFamily: MONO, fontSize: 42, color: col, textAlign: 'right', fontWeight: 700 }}
              >
                <Count to={v} delay={30 + i * 13} dur={38} />
              </span>
            </div>
          )
        })}
      </div>

      <Rise delay={104} style={{ marginTop: 40 }}>
        <Card accent="rgba(0,212,255,0.45)">
          <div style={{ fontFamily: SANS, fontSize: 31, color: '#b8c7db', lineHeight: 1.55 }}>
            We could have said <i>“prediction eliminated 100% of failures.”</i> True — and
            misleading.{' '}
            <b style={{ color: C.bright }}>
              Most of the gain comes from simply looking: 78 of 80. Forecasting removes the last two.
            </b>{' '}
            That decomposition is on screen in the product, because the honest number is the useful
            one.
          </div>
        </Card>
      </Rise>
    </AbsoluteFill>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 08 · CLOSE
// ═══════════════════════════════════════════════════════════════════════════

export const Close: React.FC = () => {
  const f = useCurrentFrame()
  const stats: [string, string][] = [
    ['28/28', 'ITU coefficients verified'],
    ['16', 'real defects found and fixed'],
    ['0', 'numbers we could not source'],
  ]
  return (
    <AbsoluteFill style={{ ...centre, background: C.bg, alignItems: 'center', textAlign: 'center' }}>
      <Backdrop />
      {[0, 1].map((i) => {
        const t = ease(f, 8 + i * 30, 100)
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 400 + t * 1500,
              height: 400 + t * 1500,
              marginLeft: -(200 + t * 750),
              marginTop: -(200 + t * 750),
              borderRadius: '50%',
              border: `1px solid rgba(0,212,255,${0.22 * (1 - t)})`,
            }}
          />
        )
      })}
      <Rise delay={4}>
        <Title size={92}>
          Not <span style={{ color: C.muted }}>“space is faster.”</span>
        </Title>
      </Rise>
      <Rise delay={22} style={{ marginTop: 18 }}>
        <Title size={92}>
          <span style={{ color: C.cyan }}>Exactly where the line falls</span> — and why.
        </Title>
      </Rise>

      <Rise delay={52} style={{ marginTop: 74 }}>
        <div style={{ display: 'flex', gap: 26 }}>
          {stats.map(([v, l], i) => (
            <Card key={l} style={{ minWidth: 340 }}>
              <div style={{ fontFamily: MONO, fontSize: 56, color: C.cyan, fontWeight: 700 }}>{v}</div>
              <div style={{ fontFamily: SANS, fontSize: 23, color: '#9db2c9', marginTop: 10 }}>{l}</div>
            </Card>
          ))}
        </div>
      </Rise>

      <Rise delay={84} style={{ marginTop: 76 }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 44,
            color: C.bright,
            letterSpacing: '0.05em',
            padding: '22px 48px',
            border: `1px solid rgba(0,212,255,0.45)`,
            borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(124,58,237,0.12))',
          }}
        >
          orbital-cdn.vercel.app
        </div>
      </Rise>
      <Rise delay={104} style={{ marginTop: 26 }}>
        <div style={{ fontFamily: SANS, fontSize: 25, color: C.muted }}>
          Live. No sign-up. Analytics and autopilot on screen the moment it loads.
        </div>
      </Rise>
    </AbsoluteFill>
  )
}
