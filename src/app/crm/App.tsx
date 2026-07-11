import { useState } from "react";
import { C } from "./data";
import { Dashboard } from "./Dashboard";
import { Companies } from "./Companies";
import { CompanyProfile } from "./CompanyProfile";
import { Contacts } from "./Contacts";
import { ContactProfile } from "./ContactProfile";
import { Tasks } from "./Tasks";
import { Opportunities } from "./Opportunities";
import { EmailGen } from "./EmailGen";
import { Knowledge } from "./Knowledge";
import { Settings } from "./Settings";

const NAV_ITEMS = [
  { key: "dashboard", icon: "\u{1F4CA}", label: "Dashboard" },
  { key: "companies", icon: "\u{1F3E2}", label: "Companies" },
  { key: "contacts", icon: "\u{1F465}", label: "Contacts" },
  { key: "opportunities", icon: "\u{1F3AF}", label: "Opportunities" },
  { key: "tasks", icon: "\u2705", label: "Tasks" },
  { key: "email", icon: "\u2709", label: "Email AI" },
  { key: "knowledge", icon: "\u{1F4DA}", label: "Knowledge" },
  { key: "settings", icon: "\u2699", label: "Settings" },
];

export function App() {
  const [view, setView] = useState("dashboard");
  const [detailId, setDetailId] = useState("");

  function nav(v: string, id?: string) {
    setView(v);
    if (id) setDetailId(id);
  }

  const sidebar: React.CSSProperties = {
    width: 240, minHeight: "100vh", background: C.sidebar,
    display: "flex", flexDirection: "column", flexShrink: 0,
  };
  const brand: React.CSSProperties = {
    padding: "24px 20px 20px", fontSize: 18, fontWeight: 800, color: "#fff",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  };
  const navItem = (active: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 10, padding: "10px 20px",
    fontSize: 13, fontWeight: 500, cursor: "pointer", color: active ? "#fff" : C.sidebarText,
    background: active ? "rgba(13,148,136,0.2)" : "transparent",
    borderLeft: active ? "3px solid " + C.sidebarActive : "3px solid transparent",
    transition: "all 0.15s ease",
  });
  const main: React.CSSProperties = {
    flex: 1, padding: 24, overflow: "auto", minHeight: "100vh", background: C.bg,
  };
  const header: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24,
  };
  const titleStyle: React.CSSProperties = { fontSize: 22, fontWeight: 800, color: C.text };
  const avatar: React.CSSProperties = {
    width: 36, height: 36, borderRadius: "50%", background: C.primary,
    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: 14,
  };

  function renderView() {
    switch (view) {
      case "company": return <CompanyProfile nav={nav} id={detailId} />;
      case "contact": return <ContactProfile nav={nav} id={detailId} />;
      case "companies": return <Companies nav={nav} />;
      case "contacts": return <Contacts nav={nav} />;
      case "tasks": return <Tasks nav={nav} />;
      case "opportunities": return <Opportunities nav={nav} />;
      case "email": return <EmailGen nav={nav} />;
      case "knowledge": return <Knowledge nav={nav} />;
      case "settings": return <Settings nav={nav} />;
      default: return <Dashboard nav={nav} />;
    }
  }

  const currentNav = NAV_ITEMS.find((n) => n.key === view) || NAV_ITEMS.find((n) => view === "company" || view === "contact") || NAV_ITEMS[0];

  return (
    <div style={{ display: "flex" }}>
      <aside style={sidebar}>
        <div style={brand}>DeepMindQ CRM</div>
        <nav style={{ flex: 1, padding: "8px 0" }}>
          {NAV_ITEMS.map((item) => (
            <div key={item.key} style={navItem(view === item.key || (item.key === "companies" && view === "company") || (item.key === "contacts" && view === "contact"))}
              onClick={() => nav(item.key)}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </nav>
        <div style={{ padding: 16, borderTop: "1px solid rgba(255,255,255,0.08)", color: C.sidebarText, fontSize: 11 }}>
          DeepMindQ CRM v1.0
        </div>
      </aside>
      <div style={main}>
        <div style={header}>
          <div style={titleStyle}>{currentNav.label}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: C.textSec }}>John Doe</span>
            <div style={avatar}>JD</div>
          </div>
        </div>
        {renderView()}
      </div>
    </div>
  );
}