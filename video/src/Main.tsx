import React from 'react'
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from 'remotion'
import { Hook, Physics, System, TheLine, Rigour, Predict, Experiment, Close } from './Scenes'
import { C, MONO } from './lib'

// Scene plan — 30 fps, 2790 frames total (93 s).
// Durations overlap by CROSSFADE frames so cuts breathe rather than snap.
const CROSSFADE = 14

const SCENES: [React.FC, number][] = [
  [Hook, 240],        //  0.0 –  8.0
  [Physics, 300],     //  8.0 – 18.0
  [System, 390],      // 18.0 – 31.0
  [TheLine, 420],     // 31.0 – 45.0
  [Rigour, 390],      // 45.0 – 58.0
  [Predict, 450],     // 58.0 – 73.0
  [Experiment, 390],  // 73.0 – 86.0
  [Close, 210],       // 86.0 – 93.0
]

/** Fades a scene in and out at its own boundaries. */
const Fade: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const f = useCurrentFrame()
  const o = interpolate(
    f,
    [0, CROSSFADE, dur - CROSSFADE, dur],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>
}

/** Thin progress line so the viewer feels the 93 seconds moving. */
const Progress: React.FC<{ total: number }> = ({ total }) => {
  const f = useCurrentFrame()
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, zIndex: 50 }}>
      <div
        style={{
          height: '100%',
          width: `${(f / total) * 100}%`,
          background: `linear-gradient(90deg, ${C.cyan}, ${C.purple})`,
        }}
      />
    </div>
  )
}

export const Main: React.FC = () => {
  let at = 0
  const total = SCENES.reduce((s, [, d]) => s + d, 0)
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {SCENES.map(([Comp, dur], i) => {
        const from = at
        at += dur
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <Fade dur={dur}>
              <Comp />
            </Fade>
          </Sequence>
        )
      })}

      {/* Persistent wordmark, small, bottom-right */}
      <div
        style={{
          position: 'absolute',
          right: 56,
          bottom: 40,
          fontFamily: MONO,
          fontSize: 17,
          letterSpacing: '0.24em',
          color: 'rgba(84,112,143,0.75)',
          zIndex: 40,
        }}
      >
        ORBITAL CDN
      </div>

      <Progress total={total} />
    </AbsoluteFill>
  )
}
