import { Img, staticFile } from "remotion"
import { BEAN_COPIES, BEAN_NAMES, COLORS, DISPLAY, type BeanKey } from "../theme"

// A bean card drawn the way the game draws it: white border, inked art frame,
// the name in gold lettering and the card count in the corner.
export const Card: React.FC<{ bean: BeanKey; width: number; back?: boolean; style?: React.CSSProperties }> = ({ bean, width, back = false, style }) => {
  const unit = width / 190
  return (
    <div
      style={{
        width,
        aspectRatio: "63 / 88",
        background: "#fff",
        borderRadius: 14 * unit,
        padding: 6 * unit,
        display: "flex",
        boxShadow: `0 ${18 * unit}px ${30 * unit}px -${10 * unit}px rgba(0,0,0,.75)`,
        ...style,
      }}
    >
      <div style={{ position: "relative", flex: 1, border: `${2 * unit}px solid ${COLORS.ink}`, borderRadius: 8 * unit, overflow: "hidden" }}>
        <Img src={staticFile(`art/${back ? "coin_back" : bean}.webp`)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        {!back && (
          <>
            <Lettering size={15 * unit} stroke={4 * unit} style={{ top: 7 * unit, left: 8 * unit, right: 8 * unit, textTransform: "uppercase" }}>
              {BEAN_NAMES[bean]} Bean
            </Lettering>
            <Lettering size={32 * unit} stroke={5 * unit} style={{ bottom: 6 * unit, right: 9 * unit }}>
              {BEAN_COPIES[bean]}
            </Lettering>
          </>
        )}
      </div>
    </div>
  )
}

const Lettering: React.FC<{ size: number; stroke: number; style: React.CSSProperties; children: React.ReactNode }> = ({ size, stroke, style, children }) => (
  <div
    style={{
      position: "absolute",
      fontFamily: DISPLAY,
      fontWeight: 900,
      fontSize: size,
      lineHeight: 1,
      color: COLORS.gold,
      WebkitTextStroke: `${stroke}px ${COLORS.ink}`,
      paintOrder: "stroke fill",
      ...style,
    }}
  >
    {children}
  </div>
)
