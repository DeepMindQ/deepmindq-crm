export const COMPANIES = [
  { id: "c1", name: "Acme Corp", industry: "SaaS", revenue: "$12M", employees: 120, status: "active", score: 85, website: "acme.com", city: "San Francisco" },
  { id: "c2", name: "Globex Inc", industry: "FinTech", revenue: "$8M", employees: 65, status: "active", score: 72, website: "globex.io", city: "New York" },
  { id: "c3", name: "Initech", industry: "HealthTech", revenue: "$3M", employees: 30, status: "prospect", score: 58, website: "initech.co", city: "Austin" },
  { id: "c4", name: "Umbrella Corp", industry: "Biotech", revenue: "$45M", employees: 350, status: "active", score: 91, website: "umbrella.com", city: "Boston" },
  { id: "c5", name: "Wayne Enterprises", industry: "Defense", revenue: "$200M", employees: 2000, status: "churned", score: 40, website: "wayne.co", city: "Gotham" },
  { id: "c6", name: "Stark Industries", industry: "CleanTech", revenue: "$500M", employees: 5000, status: "active", score: 95, website: "stark.com", city: "Los Angeles" },
];

export const CONTACTS = [
  { id: "t1", name: "Alice Johnson", email: "alice@acme.com", role: "CEO", companyId: "c1", phone: "+1-555-0101", score: 90 },
  { id: "t2", name: "Bob Smith", email: "bob@acme.com", role: "CTO", companyId: "c1", phone: "+1-555-0102", score: 82 },
  { id: "t3", name: "Carol White", email: "carol@globex.io", role: "VP Sales", companyId: "c2", phone: "+1-555-0201", score: 75 },
  { id: "t4", name: "Dave Brown", email: "dave@initech.co", role: "Founder", companyId: "c3", phone: "+1-555-0301", score: 60 },
  { id: "t5", name: "Eve Davis", email: "eve@umbrella.com", role: "CRO", companyId: "c4", phone: "+1-555-0401", score: 88 },
  { id: "t6", name: "Frank Miller", email: "frank@wayne.co", role: "Director", companyId: "c5", phone: "+1-555-0501", score: 45 },
  { id: "t7", name: "Grace Lee", email: "grace@stark.com", role: "Head of Ops", companyId: "c6", phone: "+1-555-0601", score: 93 },
  { id: "t8", name: "Hank Pym", email: "hank@stark.com", role: "Lead Engineer", companyId: "c6", phone: "+1-555-0602", score: 78 },
];

export const OPPS = [
  { id: "o1", title: "Enterprise License Deal", companyId: "c1", value: 150000, stage: "negotiation", probability: 75, contactId: "t1" },
  { id: "o2", title: "Platform Migration", companyId: "c2", value: 80000, stage: "proposal", probability: 50, contactId: "t3" },
  { id: "o3", title: "Annual Renewal", companyId: "c4", value: 250000, stage: "closed-won", probability: 100, contactId: "t5" },
  { id: "o4", title: "POC Expansion", companyId: "c6", value: 500000, stage: "discovery", probability: 30, contactId: "t7" },
  { id: "o5", title: "Re-engagement Campaign", companyId: "c5", value: 60000, stage: "discovery", probability: 20, contactId: "t6" },
];

export const TASKS = [
  { id: "tk1", title: "Follow up with Alice", dueDate: "2025-01-20", priority: "high", status: "pending", contactId: "t1" },
  { id: "tk2", title: "Send proposal to Globex", dueDate: "2025-01-22", priority: "medium", status: "pending", contactId: "t3" },
  { id: "tk3", title: "Prepare demo for Stark", dueDate: "2025-01-25", priority: "high", status: "in-progress", contactId: "t7" },
  { id: "tk4", title: "Update CRM records", dueDate: "2025-01-18", priority: "low", status: "completed", contactId: "t2" },
  { id: "tk5", title: "Schedule Q1 review", dueDate: "2025-01-30", priority: "medium", status: "pending", contactId: "t5" },
];

export const EMAILS = [
  { id: "e1", to: "alice@acme.com", subject: "Following up on our call", body: "Hi Alice, great speaking with you...", date: "2025-01-15", status: "sent" },
  { id: "e2", to: "carol@globex.io", subject: "Proposal for Platform Migration", body: "Dear Carol, please find attached...", date: "2025-01-16", status: "draft" },
  { id: "e3", to: "grace@stark.com", subject: "Demo Invitation", body: "Hi Grace, we'd love to show you...", date: "2025-01-17", status: "sent" },
];

export const KNOWLEDGE = [
  { id: "k1", title: "SaaS Buyer Personas", category: "Research", content: "Key buyer personas in SaaS include CTO, VP Engineering...", date: "2025-01-10" },
  { id: "k2", title: "Competitive Analysis Q1", category: "Competitive", content: "Main competitors: Salesforce, HubSpot, Pipedrive...", date: "2025-01-12" },
  { id: "k3", title: "Cold Email Best Practices", category: "Templates", content: "Keep subject lines under 40 chars. Personalize opening...", date: "2025-01-14" },
  { id: "k4", title: "Objection Handling Guide", category: "Playbook", content: "Price objection: anchor value, not cost. Timing objection...", date: "2025-01-13" },
];

export const TIMELINE = [
  { id: "tl1", type: "call", description: "Discovery call with Alice at Acme", date: "2025-01-15", companyId: "c1" },
  { id: "tl2", type: "email", description: "Sent proposal to Carol at Globex", date: "2025-01-14", companyId: "c2" },
  { id: "tl3", type: "note", description: "Umbrella renewed annual contract", date: "2025-01-12", companyId: "c4" },
  { id: "tl4", type: "meeting", description: "Demo with Stark Industries team", date: "2025-01-10", companyId: "c6" },
  { id: "tl5", type: "call", description: "Left voicemail for Frank at Wayne", date: "2025-01-08", companyId: "c5" },
];

export const C = {
  bg: "#F7F6F3",
  surface: "#FFFFFF",
  text: "#1A1A1A",
  textSec: "#6B7280",
  border: "#E5E5E0",
  primary: "#0D9488",
  primaryLight: "#CCFBF1",
  accent: "#F59E0B",
  accentLight: "#FEF3C7",
  danger: "#EF4444",
  dangerLight: "#FEE2E2",
  success: "#22C55E",
  successLight: "#DCFCE7",
  info: "#3B82F6",
  infoLight: "#DBEAFE",
  purple: "#8B5CF6",
  purpleLight: "#EDE9FE",
  sidebar: "#1E293B",
  sidebarText: "#CBD5E1",
  sidebarActive: "#0D9488",
  radius: 10,
  font: "'Inter', -apple-system, sans-serif",
  shadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  shadowLg: "0 4px 12px rgba(0,0,0,0.08)",
};