// App-Logomarke: aufgeschlagenes Berichtsheft mit drei Textzeilen
// (= die drei Ausgabeblöcke). Brandfarbe Eis-Cyan, Zeilen als Negativraum.
export default function Logo({ size = 16, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
    >
      {/* Linke Seite (beschrieben) */}
      <path
        d="M 4 6.7 L 15.3 9.3 L 15.3 26.2 L 4 23.6 Z"
        fill="#6CC9DE"
        stroke="#6CC9DE"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Rechte Seite (leer, gedämpft) */}
      <path
        d="M 28 6.7 L 16.7 9.3 L 16.7 26.2 L 28 23.6 Z"
        fill="#6CC9DE"
        stroke="#6CC9DE"
        strokeWidth="1.6"
        strokeLinejoin="round"
        opacity="0.45"
      />
      {/* Textzeilen als Aussparung */}
      <path d="M 6.7 12.4 L 12.7 13.8" stroke="#10161C" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M 6.7 15.9 L 12.7 17.3" stroke="#10161C" strokeWidth="1.9" strokeLinecap="round" opacity="0.75" />
      <path d="M 6.7 19.4 L 10.7 20.3" stroke="#10161C" strokeWidth="1.9" strokeLinecap="round" opacity="0.55" />
    </svg>
  )
}
