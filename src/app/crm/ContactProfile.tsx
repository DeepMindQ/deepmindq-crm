import { C, CONTACTS, COMPANIES, OPPS, TASKS } from "./data";
import { Card, SectionHeader, ScoreBar, Badge, Btn, PriorityBadge } from "./components";

export function ContactProfile({ nav, id }: { nav: (view: string, id?: string) => void; id: string }) {
  const contact = CONTACTS.find((t) => t.id === id);
  if (!contact) return <div style={{ padding: 40, color: C.textSec }}>Contact not found</div>;

  const company = COMPANIES.find((c) => c.id === contact.companyId);
  const opps = OPPS.filter((o) => o.contactId === id);
  const tasks = TASKS.filter((t) => t.contactId === id);

  const headerBg: React.CSSProperties = {
    background: "linear-gradient(135deg, " + C.purple + ", " + C.info + ")",
    borderRadius: C.radius, padding: 24, marginBottom: 16, color: "#fff",
  };
  const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 };
  const rowStyle: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 0", borderBottom: "1px solid " + C.border,
  };

  return (
    <div>
      <Btn label="&larr; Back" onClick={() => nav("contacts")} />
      <div style={headerBg}>
        <div style={{ fontSize: 24, fontWeight: 800 }}>{contact.name}</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
          {contact.role} at {company?.name || "Unknown"}
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.9 }}>&#9993; {contact.email}</div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>&#9742; {contact.phone}</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.textSec, fontWeight: 500 }}>Lead Score</div>
        <div style={{ width: 200 }}><ScoreBar score={contact.score} /></div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{contact.score}/100</div>
      </div>

      <div style={grid2}>
        <Card>
          <SectionHeader title="Opportunities" />
          {opps.map((o) => (
            <div key={o.id} style={rowStyle}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{o.title}</div>
              <Badge label={"$" + (o.value / 1000) + "K"} color={C.success} bg={C.successLight} />
            </div>
          ))}
          {opps.length === 0 && <div style={{ padding: 20, textAlign: "center", color: C.textSec, fontSize: 13 }}>No opportunities</div>}
        </Card>
        <Card>
          <SectionHeader title="Tasks" />
          {tasks.map((t) => (
            <div key={t.id} style={rowStyle}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{t.title}</div>
                <div style={{ fontSize: 11, color: C.textSec }}>Due: {t.dueDate}</div>
              </div>
              <PriorityBadge priority={t.priority} />
            </div>
          ))}
          {tasks.length === 0 && <div style={{ padding: 20, textAlign: "center", color: C.textSec, fontSize: 13 }}>No tasks</div>}
        </Card>
      </div>

      {company && (
        <Card style={{ marginTop: 16 }}>
          <SectionHeader title="Company" action={<Btn label="View Company" onClick={() => nav("company", company.id)} />} />
          <div style={rowStyle}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, cursor: "pointer" }}>{company.name}</div>
              <div style={{ fontSize: 12, color: C.textSec }}>{company.industry} &middot; {company.city}</div>
            </div>
            <Badge label={company.revenue} color={C.text} bg={C.bg} />
          </div>
        </Card>
      )}
    </div>
  );
}