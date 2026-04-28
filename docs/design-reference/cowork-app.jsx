// Darwin Lab — IJOS dental radiology research UI
// 1280x900, dark/light dual theme

const { useState, useEffect, useMemo, useRef } = React;

/* ---------- FDI tooth numbering (mandibular arch, viewer L→R) ---------- */
// Patient's lower right (Q4) → midline → patient's lower left (Q3)
const FDI_ROW = [48,47,46,45,44,43,42,41, 31,32,33,34,35,36,37,38];

/* ---------- Status palette ---------- */
const STATUS = {
  PRES: { label: "Present",   abbr: "PRS", color: "#2c7a4a" },
  CAR:  { label: "Caries",    abbr: "CAR", color: "#c0392b" },
  END:  { label: "Endo",      abbr: "END", color: "#7e3f8c" },
  CRN:  { label: "Crowned",   abbr: "CRN", color: "#b8860b" },
  RST:  { label: "Restored",  abbr: "RST", color: "#2c7a7a" },
  IMP:  { label: "Implant",   abbr: "IMP", color: "#34495e" },
  MIS:  { label: "Missing",   abbr: "MIS", color: "#6b6b6b" },
  IMC:  { label: "Impacted",  abbr: "IMC", color: "#8a4a20" },
  ATT:  { label: "Attrition", abbr: "ATT", color: "#a89e58" },
  UNC:  { label: "Uncertain", abbr: "UNC", color: "#c0a83a" },
  BRG:  { label: "Bridge",    abbr: "BRG", color: "#7a7a7a" },
};

/* ---------- Sample data: 4 rows × 16 cells ----------
   Row 0 = Ground Truth (ETALON) — mostly missing, implants in mandibular molars
   Row 1 = Algo A — 2 mismatches vs row 0
   Row 2 = Algo B — mostly matches
   Row 3 = Algo C — mixed                                              */
const r = (k) => k; // alias for readability

// FDI:        48   47   46   45   44   43   42   41   31   32   33   34   35   36   37   38
const ROW_GT  = ["MIS","IMP","IMP","MIS","MIS","PRES","PRES","PRES","PRES","PRES","PRES","MIS","MIS","IMP","IMP","MIS"];
const ROW_A   = ["MIS","IMP","IMP","MIS","MIS","PRES","PRES","PRES","PRES","PRES","PRES","MIS","RST","IMP","IMP","UNC"];   // 2 mismatches: idx 12 (35), idx 15 (38)
const ROW_B   = ["MIS","IMP","IMP","MIS","MIS","PRES","PRES","PRES","PRES","PRES","PRES","MIS","MIS","IMP","IMP","MIS"];   // perfect match
const ROW_C   = ["MIS","IMP","IMP","MIS","CAR","PRES","PRES","PRES","PRES","PRES","ATT","CRN","MIS","IMP","IMP","MIS"];   // some annotation differences

const ROWS = [
  { id: "gt",   label: "ETALON · Ground Truth", sub: "Sr. Radiologist · Verified",  cells: ROW_GT, isGT: true,  conf: 1.00 },
  { id: "algA", label: "Model · Darwin-Net v3.2", sub: "Inference 12.4s · GPU",     cells: ROW_A,  isGT: false, conf: 0.94 },
  { id: "algB", label: "Model · OrthoPanoR4",     sub: "Inference 8.1s · GPU",      cells: ROW_B,  isGT: false, conf: 0.97 },
  { id: "algC", label: "Resident · J. Tabatadze",  sub: "Manual annotation",         cells: ROW_C,  isGT: false, conf: 0.81 },
];

/* ---------- Tooth diagram: 5-zone (occlusal centre + 4 cardinal surfaces) ---------- */
// Zones: M (mesial/left), D (distal/right), B (buccal/top), L (lingual/bottom), O (occlusal/centre)
function ToothDiagram({ status, size = 36, theme }) {
  const s = STATUS[status] || STATUS.PRES;
  const stroke = theme === "light" ? "#1d4f8c" : "#6dc4d8";
  const baseFill = theme === "light" ? "#ffffff" : "#0f1117";
  const dim = size;
  const c = dim / 2;
  // Diamond split into 4 triangles + centre square
  const isMissing = status === "MIS";
  const isImplant = status === "IMP";

  if (isMissing) {
    return (
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} aria-hidden="true">
        <line x1={c-10} y1={c-10} x2={c+10} y2={c+10} stroke={stroke} strokeWidth="1.4" opacity="0.55"/>
        <line x1={c+10} y1={c-10} x2={c-10} y2={c+10} stroke={stroke} strokeWidth="1.4" opacity="0.55"/>
        <circle cx={c} cy={c} r={dim*0.42} stroke={stroke} strokeWidth="0.8" fill="none" strokeDasharray="2 2" opacity="0.5"/>
      </svg>
    );
  }

  if (isImplant) {
    // Screw-style implant icon
    const w = dim*0.36, h = dim*0.66;
    const x = c - w/2, y = c - h/2;
    return (
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} aria-hidden="true">
        <rect x={x} y={y} width={w} height={h*0.18} rx="1" fill={s.color} opacity="0.85"/>
        {[0,1,2,3,4].map(i => (
          <path key={i}
            d={`M${x} ${y + h*0.22 + i*h*0.14} L${x+w} ${y + h*0.22 + i*h*0.14 + 2}`}
            stroke={s.color} strokeWidth="1.6" opacity="0.85"/>
        ))}
        <path d={`M${x+w*0.15} ${y+h} L${c} ${y+h+3} L${x+w*0.85} ${y+h} Z`} fill={s.color} opacity="0.85"/>
      </svg>
    );
  }

  // 5-zone surfaces
  const fill = s.color;
  return (
    <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} aria-hidden="true">
      {/* outer tooth shape (rounded square) */}
      <rect x="3" y="3" width={dim-6} height={dim-6} rx="6" fill={baseFill} stroke={stroke} strokeWidth="1"/>
      {/* 4 triangles meeting at centre */}
      <polygon points={`3,3 ${dim-3},3 ${c},${c}`} fill={fill} fillOpacity={status==="PRES"?0.10:0.55}/> {/* B top */}
      <polygon points={`${dim-3},3 ${dim-3},${dim-3} ${c},${c}`} fill={fill} fillOpacity={status==="PRES"?0.10:0.45}/> {/* D right */}
      <polygon points={`${dim-3},${dim-3} 3,${dim-3} ${c},${c}`} fill={fill} fillOpacity={status==="PRES"?0.10:0.55}/> {/* L bot */}
      <polygon points={`3,${dim-3} 3,3 ${c},${c}`} fill={fill} fillOpacity={status==="PRES"?0.10:0.45}/> {/* M left */}
      {/* zone separators */}
      <line x1="3" y1="3" x2={dim-3} y2={dim-3} stroke={stroke} strokeWidth="0.6" opacity="0.45"/>
      <line x1={dim-3} y1="3" x2="3" y2={dim-3} stroke={stroke} strokeWidth="0.6" opacity="0.45"/>
      {/* occlusal centre square */}
      <rect x={c-5} y={c-5} width="10" height="10" fill={fill} fillOpacity={status==="PRES"?0.18:0.85} stroke={stroke} strokeWidth="0.8"/>
    </svg>
  );
}

/* ---------- Cell ---------- */
function ToothCell({ fdi, status, isGT, mismatch, selected, onClick, theme }) {
  const s = STATUS[status] || STATUS.PRES;
  return (
    <button
      role="gridcell"
      aria-label={`Tooth ${fdi}, status ${s.label}${mismatch ? ", mismatch with ground truth" : ""}`}
      onClick={onClick}
      className={`tcell ${selected ? "is-selected" : ""} ${mismatch ? "is-mismatch" : ""} ${isGT ? "is-gt" : ""}`}
      style={{
        "--cell-bg": `color-mix(in oklab, ${s.color} 15%, var(--surface))`,
      }}
    >
      <span className="tcell-fdi">{fdi}</span>
      <ToothDiagram status={status} theme={theme}/>
      <span className="tcell-abbr">{s.abbr}</span>
    </button>
  );
}

/* ---------- OPG X-ray placeholder (synthetic) ---------- */
function PanoramicXray({ filter }) {
  // Synthetic OPG approximation using SVG — radiopaque structures on black
  return (
    <div className="xray-stage" data-filter={filter}>
      <svg viewBox="0 0 520 280" className="xray-svg" preserveAspectRatio="xMidYMid slice" aria-label="Synthetic panoramic radiograph">
        <defs>
          <radialGradient id="bone" cx="50%" cy="55%" r="60%">
            <stop offset="0%" stopColor="#d8d2c4" stopOpacity="0.85"/>
            <stop offset="55%" stopColor="#8a7f6b" stopOpacity="0.55"/>
            <stop offset="100%" stopColor="#1a1a1a" stopOpacity="0"/>
          </radialGradient>
          <linearGradient id="jaw" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#e8e0cd" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#5a5042" stopOpacity="0.4"/>
          </linearGradient>
          <filter id="grain">
            <feTurbulence baseFrequency="0.9" numOctaves="2" seed="3"/>
            <feColorMatrix values="0 0 0 0 0.7  0 0 0 0 0.65  0 0 0 0 0.55  0 0 0 0.18 0"/>
            <feComposite in2="SourceGraphic" operator="in"/>
          </filter>
        </defs>
        <rect width="520" height="280" fill="#020203"/>
        {/* skull/sinus shadow */}
        <ellipse cx="260" cy="120" rx="220" ry="70" fill="url(#bone)" opacity="0.6"/>
        {/* maxilla arch */}
        <path d="M60,140 Q260,60 460,140" stroke="url(#jaw)" strokeWidth="38" fill="none" opacity="0.85"/>
        {/* mandible arch */}
        <path d="M60,170 Q260,260 460,170" stroke="url(#jaw)" strokeWidth="44" fill="none" opacity="0.95"/>
        {/* mandibular canal */}
        <path d="M90,200 Q260,250 430,200" stroke="#3a342a" strokeWidth="2" fill="none" opacity="0.6"/>
        {/* condyles */}
        <ellipse cx="55" cy="95" rx="22" ry="14" fill="#c8bfa8" opacity="0.7"/>
        <ellipse cx="465" cy="95" rx="22" ry="14" fill="#c8bfa8" opacity="0.7"/>
        {/* vertebra */}
        <rect x="248" y="170" width="24" height="100" fill="#8a7f6b" opacity="0.5" rx="3"/>

        {/* Maxillary teeth (16 across) */}
        {Array.from({length:16}).map((_,i) => {
          const x = 70 + i*25.6;
          const arch = Math.sin((i/15)*Math.PI);
          const y = 145 - arch*32;
          return <ellipse key={`u${i}`} cx={x} cy={y} rx="9" ry="13" fill="#f0e8d2" opacity={0.9}/>;
        })}
        {/* Mandibular teeth — sparse to match GT (mostly missing + implants) */}
        {FDI_ROW.map((fdi, i) => {
          const status = ROW_GT[i];
          const x = 70 + i*25.6;
          const arch = Math.sin((i/15)*Math.PI);
          const y = 175 + arch*30;
          if (status === "MIS") return null;
          if (status === "IMP") {
            return (
              <g key={`l${i}`}>
                <rect x={x-3} y={y-12} width="6" height="20" fill="#e8e8ee" opacity="0.95"/>
                <rect x={x-5} y={y+8} width="10" height="6" fill="#e8e8ee" opacity="0.95" rx="1"/>
              </g>
            );
          }
          return <ellipse key={`l${i}`} cx={x} cy={y} rx="8" ry="12" fill="#ece4ce" opacity="0.92"/>;
        })}
        {/* grain overlay */}
        <rect width="520" height="280" filter="url(#grain)" opacity="0.35"/>
        {/* vignette */}
        <radialGradient id="vig" cx="50%" cy="50%" r="70%">
          <stop offset="60%" stopColor="#000" stopOpacity="0"/>
          <stop offset="100%" stopColor="#000" stopOpacity="0.85"/>
        </radialGradient>
        <rect width="520" height="280" fill="url(#vig)"/>
      </svg>

      {/* overlay: ruler + L/R markers + scan line */}
      <div className="xray-overlay">
        <span className="xray-marker xray-marker--l" aria-label="Patient right">R</span>
        <span className="xray-marker xray-marker--r" aria-label="Patient left">L</span>
        <div className="xray-ruler" aria-hidden="true">
          {Array.from({length:11}).map((_,i)=>(<span key={i} style={{left:`${i*10}%`}}/>))}
        </div>
        <div className="xray-meta">
          <span>PT-00482 · F · 47</span>
          <span>2026-04-12 · 70 kVp · 8 mA</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Filter toolbar ---------- */
const FILTERS = [
  { id: "original", label: "Original" },
  { id: "clahe",    label: "CLAHE" },
  { id: "contrast", label: "Contrast" },
  { id: "bone",     label: "Bone" },
  { id: "invert",   label: "Invert" },
];

/* ---------- Topbar ---------- */
const NAV = ["Patients","Clinical","Monitor","Evolution","Evaluate","Metrics","Implant","Arena"];
const ACTIVE_NAV = "Evolution";

function Topbar({ theme, onToggleTheme }) {
  return (
    <header className="topbar" role="banner">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 22 22"><path d="M11 2 L18 6 V13 Q18 18 11 20 Q4 18 4 13 V6 Z" fill="none" stroke="currentColor" strokeWidth="1.6"/><circle cx="11" cy="11" r="3" fill="currentColor"/></svg>
        </span>
        <span className="brand-name">Darwin&nbsp;Lab</span>
        <span className="brand-sep">/</span>
        <span className="brand-app">IJOS · Panoramic Annotation Console</span>
      </div>
      <nav className="topnav" aria-label="Primary">
        {NAV.map(n => (
          <button key={n} className={`navlink ${n===ACTIVE_NAV?"is-active":""}`} aria-current={n===ACTIVE_NAV?"page":undefined}>
            {n}
          </button>
        ))}
      </nav>
      <div className="top-actions">
        <button className="iconbtn" aria-label="Toggle theme" onClick={onToggleTheme} title={theme==="dark"?"Switch to light":"Switch to dark"}>
          {theme==="dark" ? (
            <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="3.2" fill="currentColor"/><g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">{[0,45,90,135,180,225,270,315].map(a=>(<line key={a} x1="8" y1="1.5" x2="8" y2="3" transform={`rotate(${a} 8 8)`}/>))}</g></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M12.5 9.6 A5.5 5.5 0 1 1 6.4 3.5 a4.4 4.4 0 0 0 6.1 6.1 z" fill="currentColor"/></svg>
          )}
        </button>
      </div>
    </header>
  );
}

/* ---------- Sandbox bar ---------- */
function SandboxBar() {
  return (
    <div className="sandbox" role="status">
      <span className="sb-dot" aria-hidden="true"/>
      <span className="sb-label">SANDBOX</span>
      <span className="sb-text">Working set <b>EVOL-2026-Q2</b> · synthetic cohort N=128 · revision <b>r4711</b></span>
      <span className="sb-spacer"/>
      <span className="sb-kbd">⌘ K</span>
      <span className="sb-text">command palette</span>
    </div>
  );
}

/* ---------- Right sidebar ---------- */
function ToothDetail({ fdi, status, theme }) {
  const s = STATUS[status] || STATUS.PRES;
  const surfaces = [
    { k:"O", v:"Occlusal", t: status==="CAR"?"Caries":status==="RST"?"Composite":"—" },
    { k:"M", v:"Mesial",   t: status==="RST"?"Composite":"Sound" },
    { k:"D", v:"Distal",   t: status==="CAR"?"Caries":"Sound" },
    { k:"B", v:"Buccal",   t: "Sound" },
    { k:"L", v:"Lingual",  t: "Sound" },
  ];
  return (
    <aside className="rail" aria-label="Tooth detail">
      <section className="rail-sec">
        <header className="rail-head">
          <span className="rail-eyebrow">Selected · FDI</span>
          <span className="rail-title">{fdi}</span>
        </header>
        <div className="rail-tooth">
          <ToothDiagram status={status} size={88} theme={theme}/>
          <div className="rail-tooth-meta">
            <span className="rail-chip" style={{"--c": s.color}}>{s.abbr}</span>
            <span className="rail-status">{s.label}</span>
          </div>
        </div>
      </section>

      <section className="rail-sec">
        <header className="rail-head"><span className="rail-eyebrow">Surfaces</span></header>
        <ul className="surf-list">
          {surfaces.map(x => (
            <li key={x.k}><span className="surf-k">{x.k}</span><span className="surf-v">{x.v}</span><span className="surf-t">{x.t}</span></li>
          ))}
        </ul>
      </section>

      <section className="rail-sec">
        <header className="rail-head"><span className="rail-eyebrow">Provenance</span></header>
        <dl className="prov">
          <div><dt>Annotator</dt><dd>Sr. Radiologist</dd></div>
          <div><dt>Last edit</dt><dd>2026-04-26 14:02</dd></div>
          <div><dt>Confidence</dt><dd>0.97</dd></div>
          <div><dt>Iteration</dt><dd>r4711 · #3</dd></div>
        </dl>
      </section>

      <section className="rail-sec">
        <header className="rail-head"><span className="rail-eyebrow">Notes</span></header>
        <p className="rail-note">No periapical lesion. Crown margin acceptable. Recheck at 6mo recall.</p>
      </section>

      <div className="rail-actions">
        <button className="btn btn--primary" aria-label="Save ground truth annotation">Save Ground Truth</button>
        <button className="btn btn--ghost" aria-label="Discard changes">Discard</button>
      </div>
    </aside>
  );
}

/* ---------- Center: formula table ---------- */
function FormulaTable({ rows, gt, selected, setSelected, theme }) {
  return (
    <section className="formula" aria-label="Dental formula comparison">
      <header className="formula-head">
        <div>
          <span className="form-eyebrow">Mandibular arch · FDI</span>
          <h2 className="form-title">Annotation matrix</h2>
        </div>
        <div className="formula-legend" aria-label="Legend">
          {[["PRES","Present"],["MIS","Missing"],["IMP","Implant"],["CAR","Caries"],["RST","Restored"],["CRN","Crown"],["ATT","Attrition"],["UNC","Uncertain"]].map(([k,l])=>(
            <span key={k} className="lg"><span className="lg-sw" style={{background:`color-mix(in oklab, ${STATUS[k].color} 70%, transparent)`}}/>{l}</span>
          ))}
        </div>
      </header>

      {/* FDI header row */}
      <div className="fdi-header" role="row" aria-hidden="true">
        <div className="row-label-spacer"/>
        <div className="fdi-cells">
          {FDI_ROW.map((f,i)=>(
            <span key={f} className={`fdi-h ${i===7?"is-mid":""}`}>{f}</span>
          ))}
        </div>
      </div>

      <div className="rows" role="grid" aria-rowcount={rows.length}>
        {rows.map((row, ri) => (
          <div key={row.id} className={`row ${row.isGT?"is-gt":""}`} role="row">
            <div className="row-label">
              <div className="row-label-main">
                {row.isGT && <span className="gt-tag">GT</span>}
                <span className="row-name">{row.label}</span>
              </div>
              <span className="row-sub">{row.sub}</span>
              <div className="row-stats">
                <span className="row-stat"><span className="rs-k">conf</span><span className="rs-v">{row.conf.toFixed(2)}</span></span>
                <span className="row-stat"><span className="rs-k">Δ</span><span className="rs-v">{ri===0 ? "—" : row.cells.filter((c,i)=>c!==gt[i]).length}</span></span>
              </div>
            </div>
            <div className="cells" role="rowgroup">
              {row.cells.map((status, ci) => {
                const fdi = FDI_ROW[ci];
                const mismatch = !row.isGT && status !== gt[ci];
                const isSel = selected.row === row.id && selected.col === ci;
                return (
                  <ToothCell
                    key={fdi}
                    fdi={fdi}
                    status={status}
                    isGT={row.isGT}
                    mismatch={mismatch}
                    selected={isSel}
                    onClick={() => setSelected({ row: row.id, col: ci })}
                    theme={theme}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <footer className="formula-foot">
        <div className="ff-metric"><span className="ffm-k">Cohen's κ (vs GT)</span><span className="ffm-v">0.92</span></div>
        <div className="ff-metric"><span className="ffm-k">Macro F1</span><span className="ffm-v">0.948</span></div>
        <div className="ff-metric"><span className="ffm-k">Mismatches</span><span className="ffm-v">2 / 48</span></div>
        <div className="ff-metric"><span className="ffm-k">Agreement</span><span className="ffm-v">95.8 %</span></div>
      </footer>
    </section>
  );
}

/* ---------- Left column: viewer ---------- */
function Viewer({ filter, setFilter }) {
  return (
    <section className="viewer" aria-label="Panoramic radiograph viewer">
      <header className="v-head">
        <div>
          <span className="v-eyebrow">Study · OPG</span>
          <h2 className="v-title">PT-00482 · synthetic</h2>
        </div>
        <div className="v-meta">
          <span className="v-chip">DICOM</span>
          <span className="v-chip">2 048 × 1 024</span>
          <span className="v-chip">12-bit</span>
        </div>
      </header>

      <div className="v-canvas">
        <PanoramicXray filter={filter}/>
      </div>

      <div className="v-toolbar" role="toolbar" aria-label="Image filters">
        {FILTERS.map(f => (
          <button
            key={f.id}
            className={`fbtn ${filter===f.id?"is-active":""}`}
            onClick={() => setFilter(f.id)}
            aria-pressed={filter===f.id}
          >
            {f.label}
          </button>
        ))}
        <span className="v-tb-spacer"/>
        <button className="iconbtn iconbtn--sm" aria-label="Zoom in">+</button>
        <button className="iconbtn iconbtn--sm" aria-label="Zoom out">−</button>
        <button className="iconbtn iconbtn--sm" aria-label="Reset view">⤾</button>
      </div>

      <dl className="v-stats">
        <div><dt>Mean HU</dt><dd>412</dd></div>
        <div><dt>SNR</dt><dd>38.6 dB</dd></div>
        <div><dt>Region</dt><dd>Mandible</dd></div>
        <div><dt>Source</dt><dd>OrthoScan-X1</dd></div>
      </dl>
    </section>
  );
}

/* ---------- Footer ---------- */
function Footer() {
  return (
    <footer className="footer" role="contentinfo">
      <div className="foot-left">
        <span className="badge badge--privacy" aria-label="Synthetic data, no PII">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1 L10 3 V6.2 Q10 9 6 11 Q2 9 2 6.2 V3 Z" fill="none" stroke="currentColor" strokeWidth="1.2"/><path d="M4.4 6.2 L5.6 7.4 L7.8 5" fill="none" stroke="currentColor" strokeWidth="1.2"/></svg>
          SYNTHETIC · NO PII
        </span>
        <span className="foot-text">All images and identifiers in this view are procedurally generated. IRB-exempt research workspace.</span>
      </div>
      <div className="foot-right">
        <span className="foot-text">build 2026.04.27 · r4711</span>
        <span className="foot-text">© Darwin Lab</span>
      </div>
    </footer>
  );
}

/* ---------- App ---------- */
function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("djos.theme") || "dark");
  const [filter, setFilter] = useState("original");
  const [selected, setSelected] = useState({ row: "gt", col: 1 }); // 47 — implant

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("djos.theme", theme);
  }, [theme]);

  const sel = useMemo(() => {
    const row = ROWS.find(r => r.id === selected.row) || ROWS[0];
    return { fdi: FDI_ROW[selected.col], status: row.cells[selected.col] };
  }, [selected]);

  return (
    <div className="app">
      <Topbar theme={theme} onToggleTheme={() => setTheme(t => t==="dark"?"light":"dark")}/>
      <SandboxBar/>
      <main className="grid" role="main">
        <Viewer filter={filter} setFilter={setFilter}/>
        <FormulaTable rows={ROWS} gt={ROW_GT} selected={selected} setSelected={setSelected} theme={theme}/>
        <ToothDetail fdi={sel.fdi} status={sel.status} theme={theme}/>
      </main>
      <Footer/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
