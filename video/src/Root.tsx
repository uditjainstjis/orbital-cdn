import { Composition } from 'remotion'
import { Main } from './Main'

export const FPS = 30
export const DURATION = 2790   // 93 s

export const RemotionRoot: React.FC = () => (
  <Composition
    id="OrbitalCDN"
    component={Main}
    durationInFrames={DURATION}
    fps={FPS}
    width={1920}
    height={1080}
  />
)
