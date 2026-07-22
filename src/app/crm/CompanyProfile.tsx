import { C, COMPANIES, CONTACTS, OPPS, TIMELINE } from "./data";
import { Card, SectionHeader, StatusBadge, ScoreBar, Badge, StageBadge, Btn } from "./components";

function fmtMoney(n: number): string {
  if (n >= 1000000) return "$" + (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return "$" + (n / 1000).toFixed(0) + "K";
  return "$" + n;
}

export function CompanyProfile({ nav, id }: { nav: (view: string, id?: string) => void; id: string }) {
  const company = COMPANIES.find((c) => c.id === id);
  if (!company) return <div style={{ padding: 40, color: C.textSec }}>Company not found</div>;

  const contacts = CONTACTS.filter((t) => t.companyId === id);
  const opps = OPPS.filter((o) => o.companyId === id);
  const timeline = TIMELINE.filter((t) => t.companyId === id);
  const headerBg: React.CSSProperties = {
    background: "linear-gradient(135deg, " + C.primary + ", " + C.info + ")",
    borderRadius: C.radius, padding: 24, marginBottom: 16, color: "#fff",
  };
  const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 };
  const rowStyle: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 0", borderBottom: "1px solid " + C.border,
  };

  return (
    <div>
      <Btn label="&larr; Back" onClick={() => nav("companies")} />
      <div style={headerBg}>
        <div style={{ fontSize: 24, fontWeight: 800 }}>{company.name}</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
          {company.industry} &middot; {company.city} &middot; {company.website}
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 12 }}>
          <div><span style={{ fontSize: 20, fontWeight: 700 }}>{company.revenue}</span><span style={{ fontSize: 11, opacity: 0.75, marginLeft: 4 }}>revenue</span></div>
          <div><span style={{ fontSize: 20, fontWeight: 700 }}>{company.employees}</span><span style={{ fontSize: 11, opacity: 0.75, marginLeft: 4 }}>employees</span></div>
          <div><span style={{ fontSize: 20, fontWeight: 700 }}>{company.score}</span><span style={{ fontSize: 11, opacity: 0.75, marginLeft: 4 }}>score</span></div>
        </div>
      </div>
      <div style={grid2}>
        <Card>
          <SectionHeader title="Contacts" action={<Btn label="Add" onClick={() => {}} />} />
          {contacts.map((t) => (
            <div key={t.id} style={rowStyle} onClick={() => nav("contact", t.id)}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, cursor: "pointer" }}>{t.name}</div>
                <div style={{ fontSize: 11, color: C.textSec }}>{t.role} &middot; {t.email}</div>
              </div>
              <Badge label={String(t.score)} color={t.score >= 80 ? C.success : C.accent} bg={t.score >= 80 ? C.successLight : C.accentLight} />
            </div>
          ))}
          {contacts.length === 0 && <div style={{ padding: 20, textAlign: "center", color: C.textSec, fontSize: 13 }}>No contacts yet</div>}
        </Card>
        <Card>
          <SectionHeader title="Opportunities" action={<Btn label="Add" onClick={() => {}} />} />
          {opps.map((o) => (
            <div key={o.id} style={rowStyle}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{o.title}</div>
                <div style={{ fontSize: 11, color: C.textSec }}>{o.probability}% probability</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmtMoney(o.value)}</div>
                <StageBadge stage={o.stage} />
              </div>
            </div>
          ))}
          {opps.length === 0 && <div style={{ padding: 20, textAlign: "center", color: C.textSec, fontSize: 13 }}>No opportunities</div>}
        </Card>
      </div>
      <Card style={{ marginTop: 16 }}>
        <SectionHeader title="Activity Timeline" />
        {timeline.map((t) => (
          <div key={t.id} style={rowStyle}>
            <div style={{ fontSize: 13, color: C.text }}>{t.description}</div>
            <div style={{ fontSize: 11, color: C.textSec }}>{t.date}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}