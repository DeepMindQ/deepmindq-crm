import { C } from "./data";

export function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  const s: React.CSSProperties = {
    display: "inline-block", padding: "2px 10px", borderRadius: 20,
    fontSize: 11, fontWeight: 600, color: color, background: bg,
  };
  return <span style={s}>{label}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    active: { color: C.success, bg: C.successLight },
    prospect: { color: C.info, bg: C.infoLight },
    churned: { color: C.danger, bg: C.dangerLight },
  };
  const m = map[status] || { color: C.textSec, bg: C.bg };
  return <Badge label={status} color={m.color} bg={m.bg} />;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    high: { color: C.danger, bg: C.dangerLight },
    medium: { color: C.accent, bg: C.accentLight },
    low: { color: C.textSec, bg: C.bg },
  };
  const m = map[priority] || map.low;
  return <Badge label={priority} color={m.color} bg={m.bg} />;
}

export function StageBadge({ stage }: { stage: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    discovery: { color: C.info, bg: C.infoLight },
    proposal: { color: C.purple, bg: C.purpleLight },
    negotiation: { color: C.accent, bg: C.accentLight },
    "closed-won": { color: C.success, bg: C.successLight },
  };
  const m = map[stage] || { color: C.textSec, bg: C.bg };
  return <Badge label={stage} color={m.color} bg={m.bg} />;
}

export function ScoreBar({ score }: { score: number }) {
  const barBg: React.CSSProperties = {
    width: "100%", height: 6, borderRadius: 3, background: C.border,
  };
  const fillBg: React.CSSProperties = {
    width: score + "%", height: "100%", borderRadius: 3,
    background: score >= 80 ? C.success : score >= 50 ? C.accent : C.danger,
    transition: "width 0.3s ease",
  };
  return (
    <div style={barBg}>
      <div style={fillBg} />
    </div>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const base: React.CSSProperties = {
    background: C.surface, borderRadius: C.radius, border: "1px solid " + C.border,
    boxShadow: C.shadow, padding: 20, ...style,
  };
  return <div style={base}>{children}</div>;
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  const row: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16,
  };
  const h2: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: C.text };
  return (
    <div style={row}>
      <h2 style={h2}>{title}</h2>
      {action}
    </div>
  );
}

export function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const wrap: React.CSSProperties = { position: "relative", marginBottom: 16 };
  const inp: React.CSSProperties = {
    width: "100%", padding: "10px 12px 10px 36px", borderRadius: C.radius,
    border: "1px solid " + C.border, background: C.surface, fontSize: 14,
    color: C.text, outline: "none", fontFamily: C.font,
  };
  return (
    <div style={wrap}>
      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textSec, fontSize: 14 }}>&#128269;</span>
      <input style={inp} placeholder="Search..." value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function Btn({ label, onClick, variant }: { label: string; onClick: () => void; variant?: string }) {
  const isPrimary = variant !== "secondary";
  const s: React.CSSProperties = {
    padding: "8px 18px", borderRadius: C.radius, border: "none",
    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: C.font,
    background: isPrimary ? C.primary : C.surface,
    color: isPrimary ? "#fff" : C.text,
    border: isPrimary ? "none" : "1px solid " + C.border,
  };
  return <button style={s} onClick={onClick}>{label}</button>;
}

export function EmptyState({ message }: { message: string }) {
  const wrap: React.CSSProperties = {
    textAlign: "center", padding: "60px 20px", color: C.textSec, fontSize: 14,
  };
  return <div style={wrap}>{message}</div>;
}

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const card: React.CSSProperties = {
    background: C.surface, borderRadius: C.radius, border: "1px solid " + C.border,
    boxShadow: C.shadow, padding: 20,
  };
  const valStyle: React.CSSProperties = { fontSize: 28, fontWeight: 800, color: C.text, marginBottom: 4 };
  const labStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: C.textSec, textTransform: "uppercase", letterSpacing: 0.5 };
  const subStyle: React.CSSProperties = { fontSize: 12, color: C.success, fontWeight: 600, marginTop: 2 };
  return (
    <div style={card}>
      <div style={valStyle}>{value}</div>
      <div style={labStyle}>{label}</div>
      {sub && <div style={subStyle}>{sub}</div>}
    </div>
  );
}