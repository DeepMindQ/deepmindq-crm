// @ts-nocheck
import { useState } from "react";
import { C } from "./data";
import { Card, SectionHeader, Btn } from "./components";

export function Settings({ nav }: { nav: (view: string, id?: string) => void }) {
  const [name, setName] = useState("John Doe");
  const [email, setEmail] = useState("john@company.com");
  const [theme, setTheme] = useState("light");

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: C.radius,
    border: "1px solid " + C.border, fontSize: 13, fontFamily: C.font,
    color: C.text, outline: "none", marginBottom: 12,
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6, display: "block" };
  const selectStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: C.radius,
    border: "1px solid " + C.border, fontSize: 13, fontFamily: C.font,
    color: C.text, outline: "none", background: C.surface, marginBottom: 12,
  };
  const toggleRow: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "14px 0", borderBottom: "1px solid " + C.border,
  };
  const toggleTrack: React.CSSProperties = (on: boolean): React.CSSProperties => ({
    width: 44, height: 24, borderRadius: 12, cursor: "pointer", position: "relative",
    background: on ? C.primary : C.border, transition: "background 0.2s ease",
  });
  const toggleKnob: React.CSSProperties = (on: boolean): React.CSSProperties => ({
    width: 20, height: 20, borderRadius: "50%", background: "#fff",
    position: "absolute", top: 2, left: on ? 22 : 2,
    transition: "left 0.2s ease", boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
  });

  const [notifications, setNotifications] = useState(true);
  const [autoScore, setAutoScore] = useState(true);
  const [emailTracking, setEmailTracking] = useState(false);

  return (
    <div>
      <SectionHeader title="Settings" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16 }}>Profile</div>
          <div style={labelStyle}>Full Name</div>
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
          <div style={labelStyle}>Email</div>
          <input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} />
          <div style={labelStyle}>Theme</div>
          <select style={selectStyle} value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
          <Btn label="Save Changes" onClick={() => {}} />
        </Card>

        <Card>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16 }}>Preferences</div>
          <div style={toggleRow}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Email Notifications</div>
              <div style={{ fontSize: 11, color: C.textSec }}>Receive email alerts for tasks</div>
            </div>
            <div style={toggleTrack(notifications)} onClick={() => setNotifications(!notifications)}>
              <div style={toggleKnob(notifications)} />
            </div>
          </div>
          <div style={toggleRow}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Auto Lead Scoring</div>
              <div style={{ fontSize: 11, color: C.textSec }}>Automatically score new leads</div>
            </div>
            <div style={toggleTrack(autoScore)} onClick={() => setAutoScore(!autoScore)}>
              <div style={toggleKnob(autoScore)} />
            </div>
          </div>
          <div style={{ ...toggleRow, borderBottom: "none" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Email Tracking</div>
              <div style={{ fontSize: 11, color: C.textSec }}>Track email opens and clicks</div>
            </div>
            <div style={toggleTrack(emailTracking)} onClick={() => setEmailTracking(!emailTracking)}>
              <div style={toggleKnob(emailTracking)} />
            </div>
          </div>
        </Card>
      </div>

      <Card style={{ marginTop: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16 }}>Danger Zone</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Reset All Data</div>
            <div style={{ fontSize: 11, color: C.textSec }}>This will permanently delete all CRM data</div>
          </div>
          <Btn label="Reset Data" onClick={() => {}} />
        </div>
      </Card>
    </div>
  );
}