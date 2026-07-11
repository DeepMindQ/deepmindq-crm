import { useState } from "react";
import { C, CONTACTS, KNOWLEDGE } from "./data";
import { Card, SectionHeader, Btn, Badge } from "./components";

export function EmailGen({ nav }: { nav: (view: string, id?: string) => void }) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState("professional");
  const [generated, setGenerated] = useState(false);

  const textareaStyle: React.CSSProperties = {
    width: "100%", minHeight: 160, padding: 12, borderRadius: C.radius,
    border: "1px solid " + C.border, fontSize: 13, fontFamily: C.font,
    color: C.text, resize: "vertical", lineHeight: 1.6, outline: "none",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: C.radius,
    border: "1px solid " + C.border, fontSize: 13, fontFamily: C.font,
    color: C.text, outline: "none", marginBottom: 16,
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6, display: "block" };
  const selectStyle: React.CSSProperties = {
    padding: "8px 12px", borderRadius: C.radius, border: "1px solid " + C.border,
    fontSize: 13, fontFamily: C.font, color: C.text, outline: "none", background: C.surface,
  };
  const tones = ["professional", "friendly", "formal", "casual"];
  const toneRow: React.CSSProperties = { display: "flex", gap: 8, marginBottom: 16 };
  const toneBtn = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
    fontSize: 12, fontWeight: 600, fontFamily: C.font,
    background: active ? C.primary : C.surface,
    color: active ? "#fff" : C.textSec,
    border: active ? "none" : "1px solid " + C.border,
  });

  const handleGenerate = () => {
    const contact = CONTACTS.find((c) => c.email === to);
    const name = contact ? contact.name.split(" ")[0] : "there";
    setSubject(subject || "Following up on our conversation");
    setBody("Hi " + name + ",\n\nI hope this message finds you well. I wanted to follow up " +
      "on our recent discussion and explore how we can help drive results for your team.\n\n" +
      "I believe there is a strong alignment between our solution and your goals. " +
      "Would you be available for a brief call this week?\n\nLooking forward to connecting.\n\nBest regards");
    setGenerated(true);
  };

  return (
    <div>
      <SectionHeader title="Email Generator" action={<Btn label="Use Template" onClick={() => nav("knowledge")} />} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={labelStyle}>Recipient</div>
          <input style={inputStyle} placeholder="email@example.com" value={to} onChange={(e) => setTo(e.target.value)} />
          <div style={labelStyle}>Subject</div>
          <input style={inputStyle} placeholder="Email subject..." value={subject} onChange={(e) => setSubject(e.target.value)} />
          <div style={labelStyle}>Tone</div>
          <div style={toneRow}>
            {tones.map((t) => (
              <button key={t} style={toneBtn(tone === t)} onClick={() => setTone(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <Btn label="Generate with AI" onClick={handleGenerate} />
        </Card>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={labelStyle}>Preview</div>
            {generated && <Badge label="Generated" color={C.success} bg={C.successLight} />}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>{subject || "No subject"}</div>
          <textarea style={textareaStyle} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Generated email will appear here..." />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn label="Send Email" onClick={() => {}} />
            <Btn label="Save Draft" onClick={() => {}} variant="secondary" />
          </div>
        </Card>
      </div>
    </div>
  );
}