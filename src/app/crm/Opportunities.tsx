import { C, OPPS, COMPANIES, CONTACTS } from "./data";
import { Card, SectionHeader, StageBadge, Btn, Badge } from "./components";

function fmtMoney(n: number): string {
  if (n >= 1000000) return "$" + (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return "$" + (n / 1000).toFixed(0) + "K";
  return "$" + n;
}

export function Opportunities({ nav }: { nav: (view: string, id?: string) => void }) {
  const stages = ["discovery", "proposal", "negotiation", "closed-won"];
  const stageColors: Record<string, string> = {
    discovery: C.info, proposal: C.purple, negotiation: C.accent, "closed-won": C.success,
  };

  const rowStyle: React.CSSProperties = {
    padding: "14px 20px", borderBottom: "1px solid " + C.border,
  };
  const totalValue = OPPS.filter((o) => o.stage !== "closed-won").reduce((s, o) => s + o.value, 0);
  const wonValue = OPPS.filter((o) => o.stage === "closed-won").reduce((s, o) => s + o.value, 0);

  return (
    <div>
      <SectionHeader title="Opportunities" action={<Btn label="Add Opportunity" onClick={() => {}} />} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>{OPPS.length}</div>
          <div style={{ fontSize: 12, color: C.textSec }}>Total Deals</div>
        </Card>
        <Card style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.primary }}>{fmtMoney(totalValue)}</div>
          <div style={{ fontSize: 12, color: C.textSec }}>Pipeline Value</div>
        </Card>
        <Card style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.success }}>{fmtMoney(wonValue)}</div>
          <div style={{ fontSize: 12, color: C.textSec }}>Closed Won</div>
        </Card>
      </div>

      {stages.map((stage) => {
        const stageOpps = OPPS.filter((o) => o.stage === stage);
        if (stageOpps.length === 0) return null;
        const color = stageColors[stage] || C.textSec;
        const stageHeader: React.CSSProperties = {
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 0", borderBottom: "1px solid " + C.border,
        };
        return (
          <Card key={stage} style={{ marginTop: 16 }}>
            <div style={stageHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 4, height: 24, borderRadius: 2, background: color }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{stage.charAt(0).toUpperCase() + stage.slice(1)}</span>
                <Badge label={String(stageOpps.length) + " deals"} color={color} bg={C.bg} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                {fmtMoney(stageOpps.reduce((s, o) => s + o.value, 0))}
              </span>
            </div>
            {stageOpps.map((o) => {
              const company = COMPANIES.find((c) => c.id === o.companyId);
              const contact = CONTACTS.find((t) => t.id === o.contactId);
              return (
                <div key={o.id} style={rowStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, cursor: "pointer" }}
                      onClick={() => company && nav("company", company.id)}>
                      {o.title}
                    </div>
                    <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>
                      {company?.name} &middot; {contact?.name} &middot; {o.probability}% prob.
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{fmtMoney(o.value)}</span>
                    <StageBadge stage={o.stage} />
                  </div>
                </div>
              );
            })}
          </Card>
        );
      })}
    </div>
  );
}