import { useId, useState } from "react";

export interface ChartDatum {
  label: string;
  value: number;
  color?: string;
}

export const CHART_PALETTE = [
  "#2a7fa3",
  "#f2892f",
  "#2e9e6b",
  "#c44536",
  "#7a5aa0",
  "#3aa6a0",
  "#e8848a",
  "#8a8f3f",
];

export const LIGHT_PALETTE = [
  "#d96a2b",
  "#b08a3e",
  "#c44536",
  "#7a5aa0",
  "#2a7fa3",
  "#2e9e6b",
  "#e8848a",
  "#8a8f3f",
];

export function chartPalette(theme: "light" | "dark"): string[] {
  return theme === "dark" ? CHART_PALETTE : LIGHT_PALETTE;
}

export function fmtMinutes(total: number): string {
  if (total <= 0) return "0m";
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function BarChart({
  data,
  color = "var(--chart-primary)",
  valueFormatter = fmtMinutes,
}: {
  data: ChartDatum[];
  color?: string;
  valueFormatter?: (v: number) => string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [hover, setHover] = useState<number | null>(null);

  return (
    <div className="chart">
      <svg viewBox="0 0 720 200" className="chart-svg" role="img">
        <defs>
          <linearGradient id={`bar-grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: color, stopOpacity: 1 }} />
            <stop
              offset="100%"
              style={{ stopColor: color, stopOpacity: 0.45 }}
            />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = 16 + f * 158;
          return (
            <line
              key={f}
              x1={44}
              x2={704}
              y1={y}
              y2={y}
              className="chart-gridline"
            />
          );
        })}
        {data.map((d, i) => {
          const bottle = 704 - 44;
          const slot = bottle / Math.max(1, data.length);
          const w = Math.min(48, slot * 0.52);
          const max = Math.max(1, ...data.map((x) => x.value));
          const h = max ? (d.value / max) * 158 : 0;
          const cx = 44 + slot * i + slot / 2;
          const cy = 174 - h;
          return (
            <rect
              key={`${d.label}-${i}`}
              x={cx - w / 2}
              y={cy}
              width={w}
              height={Math.max(2, h)}
              rx={Math.min(8, w / 3)}
              fill={`url(#bar-grad-${id})`}
              className={`chart-bar${hover === i ? " active" : ""}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`${d.label} — ${valueFormatter(d.value)}`}</title>
            </rect>
          );
        })}
        {data.map((d, i) => {
          const slot = (704 - 44) / Math.max(1, data.length);
          const cx = 44 + slot * i + slot / 2;
          return (
            <text
              key={`lbl-${i}`}
              x={cx}
              y={190}
              textAnchor="middle"
              className="chart-xlabel"
            >
              {d.label}
            </text>
          );
        })}
        <text x={44} y={14} className="chart-gridmax">
          {valueFormatter(Math.max(1, ...data.map((x) => x.value)))}
        </text>
        {hover !== null && data[hover] && (
          <text x={704} y={14} textAnchor="end" className="chart-hover-val">
            {data[hover].label}: {valueFormatter(data[hover].value)}
          </text>
        )}
      </svg>
    </div>
  );
}

export function DonutChart({
  data,
  size = 188,
  thickness = 24,
  centerValue,
  centerLabel = "min",
}: {
  data: ChartDatum[];
  size?: number;
  thickness?: number;
  centerValue?: number;
  centerLabel?: string;
}) {
  const total = Math.max(0, data.reduce((a, b) => a + b.value, 0));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  let accDeg = 0;
  const segs = data.map((d) => {
    const deg = total ? (d.value / total) * 360 : 0;
    const gap = deg > 0 ? Math.min(3, deg / 4) : 0;
    const arc = total ? (deg / 360) * c : 0;
    const start = accDeg;
    accDeg += deg;
    return {
      ...d,
      start,
      arc: Math.max(0, arc - (gap / 360) * c),
      color: d.color ?? CHART_PALETTE[0],
    };
  });

  return (
    <div
      className="donut-wrap"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="donut-svg" role="img">
        {total === 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--border)"
            strokeWidth={thickness}
          />
        )}
        {segs.map((s, i) => (
          <circle
            key={`${s.label}-${i}`}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={`${s.arc} ${c - s.arc}`}
            transform={`rotate(${s.start - 90} ${cx} ${cy})`}
            className="donut-seg"
          >
            <title>{`${s.label} — ${fmtMinutes(s.value)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="donut-center">
        <span className="donut-total">
          {centerValue !== undefined ? fmtMinutes(centerValue) : fmtMinutes(total)}
        </span>
        <span className="donut-unit">{centerLabel}</span>
      </div>
    </div>
  );
}

export function AreaChart({
  data,
  color = "var(--chart-primary)",
  height = 200,
  valueFormatter = fmtMinutes,
}: {
  data: ChartDatum[];
  color?: string;
  height?: number;
  valueFormatter?: (v: number) => string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const W = 720;
  const padL = 44;
  const padR = 14;
  const padT = 16;
  const padB = 26;
  const iw = W - padL - padR;
  const ih = height - padT - padB;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(1, data.length);

  const pts = data.map((d, i) => {
    const x = padL + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = padT + ih - (d.value / max) * ih;
    return { x, y };
  });

  const line =
    pts.length > 1
      ? pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
      : pts.length === 1
        ? `M${pts[0].x},${pts[0].y}`
        : "";
  const area =
    pts.length > 1
      ? `${line} L${pts[pts.length - 1].x.toFixed(1)},${padT + ih} L${pts[0].x.toFixed(1)},${padT + ih} Z`
      : pts.length === 1
        ? `M${padL},${padT + ih} L${pts[0].x},${pts[0].y} L${pts[0].x},${padT + ih} Z`
        : "";

  const last = data[data.length - 1];
  const lastPt = pts[pts.length - 1];

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${height}`} className="chart-svg" role="img">
        <defs>
          <linearGradient id={`area-grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.35 }} />
            <stop
              offset="100%"
              style={{ stopColor: color, stopOpacity: 0.02 }}
            />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = padT + f * ih;
          return (
            <line
              key={f}
              x1={padL}
              x2={W - padR}
              y1={y}
              y2={y}
              className="chart-gridline"
            />
          );
        })}
        {area && <path d={area} fill={`url(#area-grad-${id})`} />}
        {line && (
          <path d={line} fill="none" className="chart-line" style={{ stroke: color }} />
        )}
        {lastPt && (
          <circle
            cx={lastPt.x}
            cy={lastPt.y}
            r={4.5}
            className="chart-dot"
            style={{ fill: color }}
          />
        )}
        {last && lastPt && (
          <text
            x={lastPt.x}
            y={Math.max(14, lastPt.y - 10)}
            textAnchor="end"
            className="chart-hover-val"
          >
            {last.label} · {valueFormatter(last.value)}
          </text>
        )}
        {data[0] && (
          <text x={padL} y={height - 8} className="chart-xlabel">
            {data[0].label}
          </text>
        )}
        {last && n > 1 && (
          <text x={W - padR} y={height - 8} textAnchor="end" className="chart-xlabel">
            {last.label}
          </text>
        )}
      </svg>
    </div>
  );
}