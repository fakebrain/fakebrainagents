import { ReactNode, useEffect, useRef, useState } from "react";
import { cls, FileKind, KIND_META } from "../lib/types";
import { ICheck, ICopy } from "./icons";

/* ---------- scroll reveal ---------- */

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          ob.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={cls("reveal", inView && "is-in", className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ---------- quality ring ---------- */

export function Ring({
  value,
  color,
  size = 84,
}: {
  value: number;
  color: string;
  size?: number;
}) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setV(value)));
    return () => cancelAnimationFrame(id);
  }, [value]);
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#1c2940" strokeWidth={7} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          style={{ transition: "stroke-dashoffset 1.15s cubic-bezier(.2,.7,.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono font-bold leading-none" style={{ color, fontSize: size / 4 }}>
          {value}
        </span>
        <span className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-fog-faint">/100</span>
      </div>
    </div>
  );
}

/* ---------- kind badge ---------- */

export function KindBadge({ kind, big }: { kind: FileKind; big?: boolean }) {
  if (kind === "binary")
    return (
      <span
        className={cls(
          "inline-flex items-center rounded border font-mono font-semibold uppercase",
          big ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-px text-[10px]"
        )}
        style={{ color: "#ff7a6b", borderColor: "rgba(255,122,107,.4)", background: "rgba(255,122,107,.08)" }}
      >
        BIN
      </span>
    );
  const m = KIND_META[kind];
  return (
    <span
      className={cls(
        "inline-flex items-center rounded border font-mono font-semibold uppercase",
        big ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-px text-[10px]"
      )}
      style={{ color: m.color, borderColor: `${m.color}55`, background: `${m.color}14` }}
    >
      {m.label}
    </span>
  );
}

/* ---------- code block with copy ---------- */

export function CodeBlock({
  label,
  lang,
  code,
}: {
  label: string;
  lang: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-abyss-900/90 transition-colors hover:border-abyss-700">
      <div className="flex items-center justify-between gap-3 border-b border-line-soft bg-abyss-850 px-3.5 py-2">
        <span className="truncate font-mono text-[11px] text-fog-dim">{label}</span>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-fog-faint">
            {lang}
          </span>
          <button
            onClick={copy}
            className={cls(
              "inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[10.5px] uppercase tracking-wide transition-all",
              copied
                ? "bg-limex/10 text-limex"
                : "bg-abyss-750 text-fog-dim hover:bg-abyss-700 hover:text-fog"
            )}
          >
            {copied ? <ICheck size={12} /> : <ICopy size={12} />}
            {copied ? "готово" : "копировать"}
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-fog/90">
        {code}
      </pre>
    </div>
  );
}

/* ---------- stat chip ---------- */

export function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: ReactNode;
  color?: string;
}) {
  return (
    <div className="group rounded-lg border border-line-soft bg-abyss-850/80 px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-line hover:bg-abyss-800">
      <div className="text-[10.5px] uppercase tracking-[0.14em] text-fog-faint">{label}</div>
      <div
        className="mt-1 font-mono text-lg font-semibold leading-tight"
        style={{ color: color ?? "#d9e3f1" }}
      >
        {value}
      </div>
    </div>
  );
}
