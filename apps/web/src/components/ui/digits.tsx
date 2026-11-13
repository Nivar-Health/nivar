/**
 * A number whose digits each sit in a fixed-width cell (.nv-digits in globals.css), so a centred
 * countdown or live reading does not shift sideways as it changes. The brand font has no tabular
 * figures. Separators (":", "/", ".") keep their natural width. Screen readers get the plain text,
 * not one digit at a time.
 */
function Digits({ value, className }: { value: string | number; className?: string }) {
  const text = String(value)
  return (
    <span data-slot="digits" className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="nv-digits">
        {Array.from(text, (ch, i) => (/\d/.test(ch) ? <span key={i}>{ch}</span> : ch))}
      </span>
    </span>
  )
}

export { Digits }
