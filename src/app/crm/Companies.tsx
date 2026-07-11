import { useState } from "react";
import { C, COMPANIES, CONTACTS } from "./data";
import { SearchInput, StatusBadge, ScoreBar, Card, SectionHeader, Btn } from "./components";

export function Companies({ nav }: { nav: (view: string, id?: string) => void }) {
  const [q, setQ] = useState("");

  const filtered = COMPANIES.filter(
    (c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.industry.toLowerCase().includes(q.toLowerCase())
  );

  const rowStyle: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 0", borderBottom: "1px solid " + C.border, cursor: "pointer",
  };
  const colStyle: React.CSSProperties = { flex: 1, minWidth: 0 };
  const nameStyle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: C.text };
  const subStyle: React.CSSProperties = { fontSize: 12, color: C.textSec, marginTop: 2 };
  const scoreWrap: React.CSSProperties = { width: 100, marginRight: 16 };
  const scoreLabel: React.CSSProperties = { fontSize: 11, color: C.textSec, marginBottom: 4, textAlign: "right" };
  const metaStyle: React.CSSProperties = { width: 100, textAlign: "right" };

  return (
    <div>
      <SectionHeader title="Companies" action={<Btn label="Add Company" onClick={() => {}} />} />
      <SearchInput value={q} onChange={setQ} />
      <Card style={{ padding: "4px 20px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: C.textSec }}>No companies found</div>
        ) : (
          filtered.map((c) => {
            const contactCount = CONTACTS.filter((t) => t.companyId === c.id).length;
            return (
              <div key={c.id} style={rowStyle} onClick={() => nav("company", c.id)}>
                <div style={colStyle}>
                  <div style={nameStyle}>{c.name}</div>
                  <div style={subStyle}>{c.industry} &middot; {c.city} &middot; {contactCount} contacts</div>
                </div>
                <div style={scoreWrap}>
                  <div style={scoreLabel}>{c.score}/100</div>
                  <ScoreBar score={c.score} />
                </div>
                <div style={metaStyle}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{c.revenue}</div>
                  <div style={subStyle}>{c.employees} employees</div>
                </div>
                <div style={{ marginLeft: 16 }}>
                  <StatusBadge status={c.status} />
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}