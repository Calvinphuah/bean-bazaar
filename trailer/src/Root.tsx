import { Composition } from "remotion"
import { Trailer } from "./Trailer"
import { DURATION, FPS, HEIGHT, WIDTH } from "./timeline"

export const Root: React.FC = () => (
  <Composition id="Trailer" component={Trailer} durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
)
