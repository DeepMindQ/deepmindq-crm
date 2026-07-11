import { useState } from "react";
import { C, CONTACTS, COMPANIES } from "./data";
import { SearchInput, Card, SectionHeader, ScoreBar, Badge, Btn } from "./components";

export function Contacts({ nav }: { nav: (view: string, id?: string) => void }) {
  const [q, setQ] = useState("");
  const filtered = CONTACTS.filter(
    (t) => t.name.toLowerCase().includes(q.toLowerCase()) || t.email.toLowerCase().includes(q.toLowerCase())
  );

  const rowStyle: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 0", borderBottom: "1px solid " + C.border, cursor: "pointer",
  };
  const colStyle: React.CSSProperties = { flex: 1, minWidth: 0 };
  const scoreWrap: React.CSSProperties = { width: 100, marginRight: 16 };
  const scoreLabel: React.CSSProperties = { fontSize: 11, color: C.textSec, marginBottom: 4, textAlign: "right" };
  const avatarBg: React.CSSProperties = {
    width: 36, height: 36, borderRadius: "50%", background: C.primaryLight,
    color: C.primary, display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: 14, marginRight: 12, flexShrink: 0,
  };

  return (
    <div>
      <SectionHeader title="Contacts" action={<Btn label="Add Contact" onClick={() => {}} />} />
      <SearchInput value={q} onChange={setQ} />
      <Card style={{ padding: "4px 20px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: C.textSec }}>No contacts found</div>
        ) : (
          filtered.map((t) => {
            const company = COMPANIES.find((c) => c.id === t.companyId);
            return (
              <div key={t.id} style={rowStyle} onClick={() => nav("contact", t.id)}>
                <div style={avatarBg}>{t.name.charAt(0)}</div>
                <div style={colStyle}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: C.textSec }}>{t.role} &middot; {company?.name || "Unknown"}</div>
                </div>
                <div style={scoreWrap}>
                  <div style={scoreLabel}>{t.score}/100</div>
                  <ScoreBar score={t.score} />
                </div>
                <div style={{ textAlign: "right", minWidth: 80 }}>
                  <div style={{ fontSize: 11, color: C.textSec }}>{t.email}</div>
                  <Badge label={t.phone} color={C.textSec} bg={C.bg} />
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}