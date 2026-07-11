import { useState } from "react";
import { C, KNOWLEDGE } from "./data";
import { SearchInput, Card, SectionHeader, Btn, Badge } from "./components";

export function Knowledge({ nav }: { nav: (view: string, id?: string) => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  const categories = ["all", ...Array.from(new Set(KNOWLEDGE.map((k) => k.category)))];
  const filtered = KNOWLEDGE.filter((k) => {
    const matchQ = k.title.toLowerCase().includes(q.toLowerCase()) || k.content.toLowerCase().includes(q.toLowerCase());
    const matchCat = cat === "all" || k.category === cat;
    return matchQ && matchCat;
  });

  const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 };
  const catRow: React.CSSProperties = { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" };
  const catBtn = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
    fontSize: 12, fontWeight: 600, fontFamily: C.font,
    background: active ? C.primary : C.surface,
    color: active ? "#fff" : C.textSec,
    border: active ? "none" : "1px solid " + C.border,
  });

  return (
    <div>
      <SectionHeader title="Knowledge Base" action={<Btn label="Add Article" onClick={() => {}} />} />
      <SearchInput value={q} onChange={setQ} />
      <div style={catRow}>
        {categories.map((c) => (
          <button key={c} style={catBtn(cat === c)} onClick={() => setCat(c)}>
            {c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 40, color: C.textSec }}>No articles found</Card>
      ) : (
        <div style={gridStyle}>
          {filtered.map((k) => {
            const catColors: Record<string, { color: string; bg: string }> = {
              Research: { color: C.info, bg: C.infoLight },
              Competitive: { color: C.danger, bg: C.dangerLight },
              Templates: { color: C.purple, bg: C.purpleLight },
              Playbook: { color: C.accent, bg: C.accentLight },
            };
            const cc = catColors[k.category] || { color: C.textSec, bg: C.bg };
            const cardInner: React.CSSProperties = {
              padding: 20, cursor: "pointer", transition: "box-shadow 0.15s ease",
            };
            return (
              <Card key={k.id} style={cardInner}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, flex: 1 }}>{k.title}</div>
                  <Badge label={k.category} color={cc.color} bg={cc.bg} />
                </div>
                <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.6, marginBottom: 12, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {k.content}
                </div>
                <div style={{ fontSize: 11, color: C.textSec }}>{k.date}</div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}