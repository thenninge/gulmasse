import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { indexToTargetAngle, pickRandomIndex } from "@/lib/pickerMath";

export type Participant = { id: string; name: string; selected: boolean };

export type PickerWheelProps = {
  participants: Participant[];
  onPick: (picked: Participant) => void;
  disabled?: boolean;
  spinDurationMs?: number;
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

export function PickerWheel({
  participants,
  onPick,
  disabled,
  spinDurationMs = 3500,
}: PickerWheelProps) {
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const announceRef = useRef<HTMLDivElement | null>(null);
  const list = participants;
  // Ensure an even number of display slices by appending a ghost slice if needed
  const displayList = useMemo(() => {
    if (list.length % 2 === 1) {
      return [...list, { id: "__ghost__", name: "", selected: true } as Participant];
    }
    return list;
  }, [list]);
  const n = Math.max(1, displayList.length);
  const available = useMemo(() => list.filter(p => !p.selected), [list]);
  const slice = 360 / n;
  const radius = 140;
  const cx = 160, cy = 160;
  const labelFont = n > 10 ? "text-[10px]" : "text-xs";

  function vibrate(ms: number) {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      // @ts-ignore
      navigator.vibrate?.(ms);
    }
  }

  function handlePick() {
    if (disabled || spinning || available.length === 0) return;
    const visibleOrder = list; // logical order for picking (no ghost)
    const candidates = visibleOrder.filter(p => !p.selected);
    const localIdx = pickRandomIndex(candidates.length);
    const picked = candidates[localIdx];
    // compute index within display list (which may include a ghost at the end)
    const idxInVisible = displayList.findIndex(p => p.id === picked.id);
    // compute absolute target from current angle
    const base = ((angle % 360) + 360) % 360;
    const turns = Math.max(5, Math.min(8, 5 + Math.floor(n / 8)));
    const jitter = (Math.random() * 4) - 2;
    const absoluteTarget = indexToTargetAngle(idxInVisible, n, turns, jitter);
    const deltaToAlign = ((absoluteTarget - base) + 360 * 16) % 360 + (absoluteTarget >= 360 ? Math.floor(absoluteTarget / 360) * 360 : 0);
    const target = angle + deltaToAlign;
    setSpinning(true);
    setAngle(target);
    setTimeout(() => {
      setSpinning(false);
      onPick(picked);
      if (announceRef.current) {
        announceRef.current.textContent = `Valgt: ${picked.name}`;
      }
      vibrate(30);
    }, spinDurationMs);
  }

  return (
    <div className="w-full">
      <div className="relative mx-auto h-80 w-80">
        {/* Pointer */}
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
          <div className="h-0 w-0 border-l-8 border-r-8 border-t-[14px] border-l-transparent border-r-transparent border-t-red-600" />
        </div>
        <svg viewBox="0 0 320 320" className="absolute inset-0">
          <defs>
            <linearGradient id="segGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#86efac" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
            <linearGradient id="segRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fca5a5" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
            <linearGradient id="sel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e5e7eb" />
              <stop offset="100%" stopColor="#f3f4f6" />
            </linearGradient>
          </defs>
          <g transform={`translate(${cx},${cy})`}>
            <circle cx={0} cy={0} r={radius + 2} fill="#10b98122" />
          </g>
          <motion.g
            animate={{ rotate: angle }}
            transition={{ duration: spinDurationMs / 1000, ease: "easeInOut" }}
            // rotate around center
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          >
            {displayList.map((p, i) => {
              const start = i * slice;
              const end = (i + 1) * slice;
              const path = arcPath(cx, cy, radius, start, end);
              const mid = start + slice / 2;
              const label = (
                <text
                  x={cx}
                  y={cy}
                  transform={`rotate(${mid}, ${cx}, ${cy}) translate(0, -${radius - 20}) rotate(${-mid}, ${cx}, ${cy})`}
                  textAnchor="middle"
                  className={`fill-emerald-900 ${labelFont} ${p.selected ? "font-normal" : "font-bold"}`}
                  style={{ paintOrder: "stroke", stroke: "white", strokeWidth: 3 }}
                >
                  {p.name}
                </text>
              );
              return (
                <g key={p.id}>
                  <path d={path}
                        fill={i % 2 === 0 ? "url(#segGreen)" : "url(#segRed)"}
                        opacity={p.id === "__ghost__" ? 0.35 : 1}
                        stroke="rgba(0,0,0,0.08)"
                        strokeWidth={1} />
                  {p.id !== "__ghost__" ? label : null}
                </g>
              );
            })}
          </motion.g>
          {/* Center cover */}
          <g transform={`translate(${cx},${cy})`}>
            <circle cx={0} cy={0} r={58} fill="white" stroke="#e5e7eb" />
          </g>
        </svg>
        <button
          aria-live="polite"
          className={`absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full px-6 py-3 text-white shadow ${disabled || available.length === 0 ? "bg-zinc-400" : "bg-emerald-600 hover:bg-emerald-700"} ${spinning ? "opacity-80" : ""}`}
          onClick={handlePick}
          disabled={disabled || spinning || available.length === 0}
        >
          {available.length === 0 ? "Alle er trukket" : spinning ? "The chosen one is.." : "Spin!"}
        </button>
      </div>
      <div ref={announceRef} className="sr-only" aria-live="polite" />
    </div>
  );
}

export default PickerWheel;


