/**
 * MLogo — The one and only MyStore OS logo.
 * Gradient pink→purple rounded square with bold "M".
 * Use this everywhere. Never use <img src="/logo.png">.
 *
 * Props:
 *   size   — number, pixel size of the square (default 34)
 *   radius — number, border-radius px (default 9)
 */
export default function MLogo({ size = 34, radius = 9, style = {} }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: radius,
      background: 'linear-gradient(135deg, #4F46E5, #818CF8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 900,
      color: '#fff',
      fontSize: Math.round(size * 0.42),
      letterSpacing: '-0.03em',
      flexShrink: 0,
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      boxShadow: `0 0 ${Math.round(size * 0.5)}px rgba(79, 70, 229, 0.25)`,
      userSelect: 'none',
      ...style,
    }}>
      M
    </div>
  );
}
