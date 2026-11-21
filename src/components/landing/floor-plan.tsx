/*
 * Architectural floor plan for the sample investor post on the landing page:
 * six 1-bed units in two rows on a central corridor, drawn as crisp vector
 * linework (walls, doors with swing arcs, windows, a dimension line, north
 * arrow and title block). One unit is picked out in brand lime.
 */

const W = 600;
const H = 250;
// building footprint
const BX = 26;
const BY = 34;
const BW = 452;
const BH = 196;
const CORR = 24; // corridor depth
const ROW = (BH - CORR) / 2; // unit depth
const COLS = 3;
const UW = BW / COLS; // unit width

const INK = "#18181B";

type Unit = { n: number; x: number; y: number; top: boolean };

const UNITS: Unit[] = Array.from({ length: 6 }, (_, i) => {
  const top = i < COLS;
  const c = i % COLS;
  return { n: i + 1, x: BX + c * UW, y: top ? BY : BY + ROW + CORR, top };
});

function UnitPlan({ u, lit }: { u: Unit; lit: boolean }) {
  const { x, y, top } = u;
  const bedW = UW * 0.52;
  // the wall facing the corridor
  const corrY = top ? y + ROW : y;
  const outY = top ? y : y + ROW;
  const bathW = 30;
  const bathD = 28;
  const bathX = x + bedW - bathW;
  const bathY = top ? y + ROW - bathD : y;
  const doorX = x + bedW + 14; // entrance from the corridor into the living room
  const doorW = 16;
  return (
    <g>
      {lit && <rect x={x} y={y} width={UW} height={ROW} fill="#ACFA68" fillOpacity="0.38" />}
      {/* partition: bedroom | living */}
      <line x1={x + bedW} y1={y} x2={x + bedW} y2={y + ROW} stroke={INK} strokeWidth="1.4" />
      {/* bathroom box */}
      <rect x={bathX} y={bathY} width={bathW} height={bathD} fill="none" stroke={INK} strokeWidth="1.1" />
      {/* bedroom door (into the living room) */}
      <line x1={x + bedW} y1={top ? y + 18 : y + ROW - 18} x2={x + bedW} y2={top ? y + 30 : y + ROW - 30} stroke="white" strokeWidth="2.6" />
      <path
        d={top ? `M${x + bedW} ${y + 30} A12 12 0 0 1 ${x + bedW + 12} ${y + 18}` : `M${x + bedW} ${y + ROW - 30} A12 12 0 0 0 ${x + bedW + 12} ${y + ROW - 18}`}
        fill="none"
        stroke={INK}
        strokeWidth="0.7"
      />
      {/* entrance door from the corridor */}
      <line x1={doorX} y1={corrY} x2={doorX + doorW} y2={corrY} stroke="white" strokeWidth="3.4" />
      <path
        d={top ? `M${doorX} ${corrY} A${doorW} ${doorW} 0 0 1 ${doorX + doorW} ${corrY - doorW}` : `M${doorX} ${corrY} A${doorW} ${doorW} 0 0 0 ${doorX + doorW} ${corrY + doorW}`}
        fill="none"
        stroke={INK}
        strokeWidth="0.7"
      />
      <line x1={doorX + doorW} y1={corrY} x2={doorX + doorW} y2={top ? corrY - doorW : corrY + doorW} stroke={INK} strokeWidth="0.9" />
      {/* windows on the outer wall: bedroom and living */}
      {[x + 14, x + bedW + 20].map((wx, i) => (
        <g key={wx}>
          <rect x={wx} y={outY - 2} width={i ? UW - bedW - 40 : bedW - 30} height="4" fill="white" stroke={INK} strokeWidth="0.7" />
          <line x1={wx} y1={outY} x2={wx + (i ? UW - bedW - 40 : bedW - 30)} y2={outY} stroke={INK} strokeWidth="0.5" />
        </g>
      ))}
      {/* kitchen counter along the partition */}
      <rect x={x + bedW + 4} y={top ? y + 40 : y + ROW - 56} width="9" height="16" fill="none" stroke={INK} strokeWidth="0.6" />
      {/* labels */}
      <text x={x + 8} y={top ? y + 16 : y + ROW - 9} fontSize="7.5" fill={INK} fontWeight="600">
        Unit {u.n}
      </text>
      <text x={x + 8} y={top ? y + 26 : y + ROW - 19} fontSize="6.5" fill="#52525B">
        Bedroom
      </text>
      <text x={x + bedW + 16} y={top ? y + 26 : y + ROW - 19} fontSize="6.5" fill="#52525B">
        Living · kitchen
      </text>
      <text x={bathX + 4} y={bathY + bathD / 2 + 2.5} fontSize="5.5" fill="#71717A">
        Bath
      </text>
      <text x={x + UW - 8} y={top ? y + ROW - 8 : y + 14} fontSize="6" fill="#71717A" textAnchor="end">
        48 m²
      </text>
    </g>
  );
}

export function FloorPlan({ className = "" }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="Floor plan: six 1-bed units on a central corridor">
      <defs>
        <pattern id="fp-grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M10 0H0V10" fill="none" stroke="#18181B" strokeOpacity="0.05" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="#FAFAFA" />
      <rect width={W} height={H} fill="url(#fp-grid)" />

      {/* units */}
      {UNITS.map((u) => (
        <UnitPlan key={u.n} u={u} lit={u.n === 2} />
      ))}

      {/* corridor */}
      <text x={BX + BW / 2} y={BY + ROW + CORR / 2 + 2.5} fontSize="6.5" fill="#71717A" textAnchor="middle" letterSpacing="1.5">
        CORRIDOR
      </text>
      <line x1={BX} y1={BY + ROW} x2={BX + BW} y2={BY + ROW} stroke={INK} strokeWidth="1.6" />
      <line x1={BX} y1={BY + ROW + CORR} x2={BX + BW} y2={BY + ROW + CORR} stroke={INK} strokeWidth="1.6" />

      {/* party walls between units */}
      {[1, 2].map((c) => (
        <line key={c} x1={BX + c * UW} y1={BY} x2={BX + c * UW} y2={BY + BH} stroke={INK} strokeWidth="2" />
      ))}
      {/* outer walls, open at both corridor ends */}
      <rect x={BX} y={BY} width={BW} height={BH} fill="none" stroke={INK} strokeWidth="3" />
      <line x1={BX} y1={BY + ROW + 5} x2={BX} y2={BY + ROW + CORR - 5} stroke="#FAFAFA" strokeWidth="4" />
      <line x1={BX + BW} y1={BY + ROW + 5} x2={BX + BW} y2={BY + ROW + CORR - 5} stroke="#FAFAFA" strokeWidth="4" />

      {/* dimension line */}
      <g stroke={INK} strokeWidth="0.7">
        <line x1={BX} y1={BY - 16} x2={BX + BW} y2={BY - 16} />
        <line x1={BX} y1={BY - 21} x2={BX} y2={BY - 11} />
        <line x1={BX + BW} y1={BY - 21} x2={BX + BW} y2={BY - 11} />
        {[1, 2].map((c) => (
          <line key={c} x1={BX + c * UW} y1={BY - 19} x2={BX + c * UW} y2={BY - 13} />
        ))}
      </g>
      {[0, 1, 2].map((c) => (
        <text key={c} x={BX + c * UW + UW / 2} y={BY - 20} fontSize="6.5" fill="#52525B" textAnchor="middle">
          8.8 m
        </text>
      ))}

      {/* north arrow */}
      <g transform={`translate(${BX + BW + 60} 64)`}>
        <circle r="15" fill="none" stroke={INK} strokeWidth="0.8" />
        <path d="M0 -12 L5 6 L0 2 L-5 6 Z" fill={INK} />
        <text y="-19" fontSize="7" fill={INK} textAnchor="middle" fontWeight="600">
          N
        </text>
      </g>

      {/* title block */}
      <g transform={`translate(${BX + BW + 16} 128)`}>
        <rect width="92" height="102" fill="white" stroke={INK} strokeWidth="0.9" />
        <line x1="0" y1="30" x2="92" y2="30" stroke={INK} strokeWidth="0.6" />
        <line x1="0" y1="58" x2="92" y2="58" stroke={INK} strokeWidth="0.6" />
        <line x1="0" y1="80" x2="92" y2="80" stroke={INK} strokeWidth="0.6" />
        <text x="7" y="13" fontSize="6" fill="#71717A">
          Project
        </text>
        <text x="7" y="24" fontSize="8" fill={INK} fontWeight="600">
          Noord rentals
        </text>
        <text x="7" y="41" fontSize="6" fill="#71717A">
          Ground floor
        </text>
        <text x="7" y="52" fontSize="7.5" fill={INK}>
          6 × 1-bed · 288 m²
        </text>
        <text x="7" y="72" fontSize="7" fill={INK}>
          A-101
        </text>
        <text x="85" y="72" fontSize="7" fill={INK} textAnchor="end">
          1:200
        </text>
        <rect x="7" y="87" width="9" height="7" fill="#ACFA68" fillOpacity="0.6" stroke={INK} strokeWidth="0.5" />
        <text x="20" y="93" fontSize="6" fill="#52525B">
          Show unit
        </text>
      </g>
    </svg>
  );
}
