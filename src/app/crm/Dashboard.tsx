import { C, COMPANIES, OPPS, TASKS, CONTACTS, TIMELINE } from "./data";
import { StatCard, Card, SectionHeader, Badge, StageBadge, StatusBadge, Btn } from "./components";

function fmtMoney(n: number): string {
  if (n >= 1000000) return "$" + (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return "$" + (n / 1000).toFixed(0) + "K";
  return "$" + n;
}

function TimelineItem({ item }: { item: typeof TIMELINE[0] }) {
  const row: React.CSSProperties = {
    display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid " + C.border,
  };
  const iconWrap: React.CSSProperties = {
    width: 32, height: 32, borderRadius: "50%", display: "flex",
    alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0,
    background: C.infoLight, color: C.info,
  };
  const icons: Record<string, string> = { call: "\u260E", email: "\u2709", note: "\u{1F4DD}", meeting: "\u{1F4BC}" };
  return (
    <div style={row}>
      <div style={iconWrap}>{icons[item.type] || "?"}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{item.description}</div>
        <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>{item.date}</div>
      </div>
    </div>
  );
}

function PipelineRow({ opp }: { opp: typeof OPPS[0] }) {
  const row: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "10px 0", borderBottom: "1px solid " + C.border,
  };
  return (
    <div style={row}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{opp.title}</div>
        <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>
          {COMPANIES.find((c) => c.id === opp.companyId)?.name}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{fmtMoney(opp.value)}</span>
        <StageBadge stage={opp.stage} />
      </div>
    </div>
  );
}

export function Dashboard({ nav }: { nav: (view: string, id?: string) => void }) {
  const activeComps = COMPANIES.filter((c) => c.status === "active").length;
  const totalPipeline = OPPS.filter((o) => o.stage !== "closed-won").reduce((s, o) => s + o.value, 0);
  const pendingTasks = TASKS.filter((t) => t.status !== "completed").length;

  const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 };
  const companyRow: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "10px 0", borderBottom: "1px solid " + C.border, cursor: "pointer",
  };

  return (
    <div>
      <SectionHeader title="Dashboard" />
      <div style={grid}>
        <StatCard label="Active Companies" value={String(activeComps)} sub="+2 this week" />
        <StatCard label="Pipeline Value" value={fmtMoney(totalPipeline)} sub="5 active deals" />
        <StatCard label="Open Tasks" value={String(pendingTasks)} sub="2 high priority" />
        <StatCard label="Contacts" value={String(CONTACTS.length)} sub="avg score 76" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <SectionHeader title="Pipeline" action={<Btn label="View All" onClick={() => nav("opportunities")} />} />
          {OPPS.slice(0, 4).map((o) => (
            <PipelineRow key={o.id} opp={o} />
          ))}
        </Card>
        <Card>
          <SectionHeader title="Recent Activity" action={<Btn label="View All" onClick={() => nav("knowledge")} />} />
          {TIMELINE.slice(0, 5).map((t) => (
            <TimelineItem key={t.id} item={t} />
          ))}
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <SectionHeader title="Top Companies" action={<Btn label="View All" onClick={() => nav("companies")} />} />
          {COMPANIES.slice(0, 4).map((c) => (
            <div key={c.id} style={companyRow} onClick={() => nav("company", c.id)}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{c.name}</div>
                <div style={{ fontSize: 11, color: C.textSec }}>{c.industry} &middot; {c.city}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Badge label={"Score " + c.score} color={c.score >= 80 ? C.success : C.accent} bg={c.score >= 80 ? C.successLight : C.accentLight} />
                <StatusBadge status={c.status} />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

