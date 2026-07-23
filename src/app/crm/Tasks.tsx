// @ts-nocheck
import { useState } from "react";
import { C, TASKS, CONTACTS, COMPANIES } from "./data";
import { SearchInput, Card, SectionHeader, PriorityBadge, Btn, Badge } from "./components";

export function Tasks({ nav }: { nav: (view: string, id?: string) => void }) {
  const [filter, setFilter] = useState("all");

  const filtered = TASKS.filter((t) => {
    if (filter === "all") return true;
    return t.status === filter;
  });

  const rowStyle: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 0", borderBottom: "1px solid " + C.border,
  };
  const checkStyle: React.CSSProperties = {
    width: 20, height: 20, borderRadius: "50%", border: "2px solid " + C.border,
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
    marginRight: 12, flexShrink: 0,
  };
  const doneCheck: React.CSSProperties = { ...checkStyle, background: C.success, borderColor: C.success, color: "#fff" };

  const filters = ["all", "pending", "in-progress", "completed"];
  const filterRow: React.CSSProperties = { display: "flex", gap: 8, marginBottom: 16 };
  const filterBtn: React.CSSProperties = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
    fontSize: 12, fontWeight: 600, fontFamily: C.font,
    background: active ? C.primary : C.surface,
    color: active ? "#fff" : C.textSec,
    border: active ? "none" : "1px solid " + C.border,
  });

  return (
    <div>
      <SectionHeader title="Tasks" action={<Btn label="Add Task" onClick={() => {}} />} />
      <div style={filterRow}>
        {filters.map((f) => (
          <button key={f} style={filterBtn(filter === f)} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span style={{ marginLeft: 4, opacity: 0.7 }}>({TASKS.filter((t) => f === "all" || t.status === f).length})</span>
          </button>
        ))}
      </div>
      <Card style={{ padding: "4px 20px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: C.textSec }}>No tasks match filter</div>
        ) : (
          filtered.map((t) => {
            const contact = CONTACTS.find((c) => c.id === t.contactId);
            const company = contact ? COMPANIES.find((c) => c.id === contact.companyId) : null;
            return (
              <div key={t.id} style={rowStyle}>
                <div style={t.status === "completed" ? doneCheck : checkStyle}>
                  {t.status === "completed" && <span style={{ fontSize: 12 }}>&#10003;</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: t.status === "completed" ? C.textSec : C.text,
                    textDecoration: t.status === "completed" ? "line-through" : "none",
                  }}>
                    {t.title}
                  </div>
                  <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>
                    {contact?.name} &middot; {company?.name || ""} &middot; {t.dueDate}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <PriorityBadge priority={t.priority} />
                  <Badge
                    label={t.status}
                    color={t.status === "completed" ? C.success : t.status === "in-progress" ? C.info : C.textSec}
                    bg={t.status === "completed" ? C.successLight : t.status === "in-progress" ? C.infoLight : C.bg}
                  />
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}