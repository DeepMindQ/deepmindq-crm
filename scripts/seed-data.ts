import { db } from '../src/lib/db';

const DAY = 86400000;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY);
}

// ─── Company Data ────────────────────────────────────────────────────────────

interface CompanySeed {
  name: string;
  domain: string;
  website: string;
  industry: string;
  employeeSize: string;
  country: string;
  location: string;
  status: string;
  intelligenceScore: number;
}

const companiesData: CompanySeed[] = [
  { name: "NexaFlow Technologies", domain: "nexaflow.io", website: "https://nexaflow.io", industry: "SaaS", employeeSize: "51-200", country: "US", location: "San Francisco, CA", status: "researching", intelligenceScore: 78 },
  { name: "DataPulse AI", domain: "datapulse.ai", website: "https://datapulse.ai", industry: "AI/ML", employeeSize: "11-50", country: "US", location: "Austin, TX", status: "contacted", intelligenceScore: 85 },
  { name: "CloudVista Systems", domain: "cloudvista.com", website: "https://cloudvista.com", industry: "SaaS", employeeSize: "201-500", country: "UK", location: "London, UK", status: "qualified", intelligenceScore: 72 },
  { name: "FinEdge Solutions", domain: "finedge.co", website: "https://finedge.co", industry: "FinTech", employeeSize: "51-200", country: "Singapore", location: "Singapore", status: "new", intelligenceScore: 65 },
  { name: "HealthBridge Analytics", domain: "healthbridge.health", website: "https://healthbridge.health", industry: "HealthTech", employeeSize: "51-200", country: "US", location: "Boston, MA", status: "researching", intelligenceScore: 81 },
  { name: "ShopSphere Commerce", domain: "shopsphere.io", website: "https://shopsphere.io", industry: "E-commerce", employeeSize: "201-500", country: "India", location: "Bangalore, India", status: "new", intelligenceScore: 58 },
  { name: "EduSpark Learning", domain: "eduspark.com", website: "https://eduspark.com", industry: "EdTech", employeeSize: "11-50", country: "India", location: "Mumbai, India", status: "contacted", intelligenceScore: 62 },
  { name: "CyberVault Security", domain: "cybervaultsec.com", website: "https://cybervaultsec.com", industry: "Cybersecurity", employeeSize: "51-200", country: "US", location: "Washington, DC", status: "researching", intelligenceScore: 88 },
  { name: "MetricFlow Manufacturing", domain: "metricflow.co", website: "https://metricflow.co", industry: "Manufacturing", employeeSize: "501-1000", country: "Germany", location: "Munich, Germany", status: "new", intelligenceScore: 45 },
  { name: "SwiftRoute Logistics", domain: "swiftroute.io", website: "https://swiftroute.io", industry: "Logistics", employeeSize: "201-500", country: "Australia", location: "Sydney, Australia", status: "new", intelligenceScore: 55 },
  { name: "PropNest Realty", domain: "propnest.co", website: "https://propnest.co", industry: "PropTech", employeeSize: "11-50", country: "Canada", location: "Toronto, Canada", status: "researching", intelligenceScore: 60 },
  { name: "QuantumSync Labs", domain: "quantumsync.ai", website: "https://quantumsync.ai", industry: "AI/ML", employeeSize: "1-10", country: "US", location: "Palo Alto, CA", status: "contacted", intelligenceScore: 92 },
  { name: "PayGrid Financial", domain: "paygrid.com", website: "https://paygrid.com", industry: "FinTech", employeeSize: "201-500", country: "UK", location: "London, UK", status: "qualified", intelligenceScore: 76 },
  { name: "MedVista Diagnostics", domain: "medvista.io", website: "https://medvista.io", industry: "HealthTech", employeeSize: "51-200", country: "India", location: "Hyderabad, India", status: "new", intelligenceScore: 54 },
  { name: "CartMax Global", domain: "cartmax.co", website: "https://cartmax.co", industry: "E-commerce", employeeSize: "501-1000", country: "US", location: "New York, NY", status: "won", intelligenceScore: 90 },
  { name: "LearnPath Academy", domain: "learnpath.com", website: "https://learnpath.com", industry: "EdTech", employeeSize: "51-200", country: "Japan", location: "Tokyo, Japan", status: "researching", intelligenceScore: 68 },
  { name: "ShieldNet Cyber", domain: "shieldnet.io", website: "https://shieldnet.io", industry: "Cybersecurity", employeeSize: "11-50", country: "Israel", location: "Tel Aviv, Israel", status: "new", intelligenceScore: 73 },
  { name: "AutoForge Industries", domain: "autoforge.com", website: "https://autoforge.com", industry: "Manufacturing", employeeSize: "501-1000", country: "Japan", location: "Osaka, Japan", status: "contacted", intelligenceScore: 42 },
  { name: "FleetPulse Transport", domain: "fletpulse.co", website: "https://fleetpulse.co", industry: "Logistics", employeeSize: "201-500", country: "Germany", location: "Hamburg, Germany", status: "new", intelligenceScore: 48 },
  { name: "UrbanSpace Properties", domain: "urbanspace.io", website: "https://urbanspace.io", industry: "PropTech", employeeSize: "51-200", country: "Australia", location: "Melbourne, Australia", status: "researching", intelligenceScore: 63 },
  { name: "SaaSMatrix Pro", domain: "saasmatrix.com", website: "https://saasmatrix.com", industry: "SaaS", employeeSize: "11-50", country: "Canada", location: "Vancouver, Canada", status: "new", intelligenceScore: 70 },
  { name: "NeuralWave Computing", domain: "neuralwave.ai", website: "https://neuralwave.ai", industry: "AI/ML", employeeSize: "51-200", country: "US", location: "Seattle, WA", status: "contacted", intelligenceScore: 87 },
  { name: "TradeFlow Capital", domain: "tradeflow.capital", website: "https://tradeflow.capital", industry: "FinTech", employeeSize: "11-50", country: "Singapore", location: "Singapore", status: "new", intelligenceScore: 56 },
  { name: "CareSync Health", domain: "caresync.health", website: "https://caresync.health", industry: "HealthTech", employeeSize: "201-500", country: "US", location: "Chicago, IL", status: "researching", intelligenceScore: 74 },
  { name: "BazaarDirect", domain: "bazaardirect.com", website: "https://bazaardirect.com", industry: "E-commerce", employeeSize: "51-200", country: "India", location: "Delhi, India", status: "new", intelligenceScore: 52 },
  { name: "SkillForge EdTech", domain: "skillforge.io", website: "https://skillforge.io", industry: "EdTech", employeeSize: "11-50", country: "UK", location: "Manchester, UK", status: "contacted", intelligenceScore: 64 },
  { name: "ThreatGuard Solutions", domain: "threatguard.io", website: "https://threatguard.io", industry: "Cybersecurity", employeeSize: "201-500", country: "US", location: "Reston, VA", status: "qualified", intelligenceScore: 82 },
  { name: "PrecisionWorks MFG", domain: "precisionworks.co", website: "https://precisionworks.co", industry: "Manufacturing", employeeSize: "501-1000", country: "Germany", location: "Stuttgart, Germany", status: "new", intelligenceScore: 40 },
  { name: "CargoStream Networks", domain: "cargostream.io", website: "https://cargostream.io", industry: "Logistics", employeeSize: "51-200", country: "Canada", location: "Calgary, Canada", status: "new", intelligenceScore: 47 },
  { name: "EstateIQ Analytics", domain: "estateiq.co", website: "https://estateiq.co", industry: "PropTech", employeeSize: "11-50", country: "US", location: "Miami, FL", status: "researching", intelligenceScore: 59 },
  { name: "ApexSaaS Platform", domain: "apexsaas.io", website: "https://apexsaas.io", industry: "SaaS", employeeSize: "51-200", country: "India", location: "Pune, India", status: "contacted", intelligenceScore: 66 },
  { name: "DeepCore Intelligence", domain: "deepcore.ai", website: "https://deepcore.ai", industry: "AI/ML", employeeSize: "11-50", country: "US", location: "New York, NY", status: "researching", intelligenceScore: 91 },
  { name: "LendWise FinTech", domain: "lendwise.co", website: "https://lendwise.co", industry: "FinTech", employeeSize: "51-200", country: "UK", location: "Edinburgh, UK", status: "new", intelligenceScore: 61 },
  { name: "PulseMed Devices", domain: "pulsemed.io", website: "https://pulsemed.io", industry: "HealthTech", employeeSize: "201-500", country: "Japan", location: "Kyoto, Japan", status: "new", intelligenceScore: 53 },
  { name: "Vendora Marketplace", domain: "vendora.shop", website: "https://vendora.shop", industry: "E-commerce", employeeSize: "201-500", country: "Australia", location: "Sydney, Australia", status: "contacted", intelligenceScore: 57 },
  { name: "TutorCloud Global", domain: "tutorcloud.com", website: "https://tutorcloud.com", industry: "EdTech", employeeSize: "51-200", country: "India", location: "Chennai, India", status: "new", intelligenceScore: 50 },
  { name: "IronClad Security", domain: "ironcladsec.com", website: "https://ironcladsec.com", industry: "Cybersecurity", employeeSize: "11-50", country: "Canada", location: "Ottawa, Canada", status: "researching", intelligenceScore: 77 },
  { name: "SteelTech Automation", domain: "steeltech-auto.com", website: "https://steeltech-auto.com", industry: "Manufacturing", employeeSize: "501-1000", country: "US", location: "Detroit, MI", status: "new", intelligenceScore: 38 },
  { name: "NaviShip Global", domain: "naviship.io", website: "https://naviship.io", industry: "Logistics", employeeSize: "51-200", country: "Singapore", location: "Singapore", status: "new", intelligenceScore: 51 },
  { name: "RealtyPulse Data", domain: "realtypulse.com", website: "https://realtypulse.com", industry: "PropTech", employeeSize: "11-50", country: "UK", location: "Bristol, UK", status: "new", intelligenceScore: 44 },
  { name: "CloudPeak Solutions", domain: "cloudpeak.dev", website: "https://cloudpeak.dev", industry: "SaaS", employeeSize: "11-50", country: "US", location: "Denver, CO", status: "researching", intelligenceScore: 71 },
  { name: "CogniSense AI", domain: "cognisense.ai", website: "https://cognisense.ai", industry: "AI/ML", employeeSize: "51-200", country: "India", location: "Gurugram, India", status: "contacted", intelligenceScore: 83 },
  { name: "WealthBridge Digital", domain: "wealthbridge.io", website: "https://wealthbridge.io", industry: "FinTech", employeeSize: "201-500", country: "US", location: "Charlotte, NC", status: "ready", intelligenceScore: 89 },
  { name: "OmniCare Health Tech", domain: "omnicare.health", website: "https://omnicare.health", industry: "HealthTech", employeeSize: "51-200", country: "Germany", location: "Berlin, Germany", status: "new", intelligenceScore: 67 },
  { name: "MarketCart Platform", domain: "marketcart.io", website: "https://marketcart.io", industry: "E-commerce", employeeSize: "11-50", country: "Japan", location: "Tokyo, Japan", status: "lost", intelligenceScore: 55 },
  { name: "ClassRoom Connect", domain: "classroomconnect.com", website: "https://classroomconnect.com", industry: "EdTech", employeeSize: "201-500", country: "US", location: "San Diego, CA", status: "new", intelligenceScore: 63 },
  { name: "SentinelCore Systems", domain: "sentinelcore.io", website: "https://sentinelcore.io", industry: "Cybersecurity", employeeSize: "51-200", country: "UK", location: "Birmingham, UK", status: "researching", intelligenceScore: 79 },
  { name: "FormWise Industries", domain: "formwise.co", website: "https://formwise.co", industry: "Manufacturing", employeeSize: "201-500", country: "Canada", location: "Montreal, Canada", status: "archived", intelligenceScore: 35 },
  { name: "TrackFlow Supply", domain: "trackflow.co", website: "https://trackflow.co", industry: "Logistics", employeeSize: "11-50", country: "India", location: "Mumbai, India", status: "new", intelligenceScore: 43 },
  { name: "BuildSmart PropTech", domain: "buildsmart.io", website: "https://buildsmart.io", industry: "PropTech", employeeSize: "51-200", country: "Singapore", location: "Singapore", status: "new", intelligenceScore: 58 },
];

// ─── Contact Name Pool ───────────────────────────────────────────────────────

const firstNames = {
  indian: ["Rajesh", "Priya", "Arjun", "Ananya", "Vikram", "Sneha", "Amit", "Kavitha", "Suresh", "Deepa", "Karthik", "Meera", "Nikhil", "Pooja", "Rahul", "Sunita", "Aditya", "Lakshmi", "Sanjay", "Divya"],
  american: ["James", "Sarah", "Michael", "Emily", "David", "Jessica", "Robert", "Amanda", "William", "Jennifer", "Christopher", "Ashley", "Daniel", "Stephanie", "Andrew", "Nicole", "Matthew", "Rachel", "Brian", "Laura"],
  european: ["Hans", "Greta", "Lars", "Ingrid", "Klaus", "Helena", "Felix", "Anika", "Stefan", "Petra", "Wolfgang", "Martina", "Rainer", "Brigitte", "Thomas", "Susanne", "Markus", "Eva", "Jan", "Sofia"],
  asian: ["Yuki", "Kenji", "Wei", "Mei", "Jin", "Yuna", "Hiroshi", "Sakura", "Takeshi", "Lin", "Hiroshi", "Akiko", "Daichi", "Haruka", "Ryota", "Yuki", "Sho", "Aya", "Tao", "Hana"],
};

const lastNames = {
  indian: ["Sharma", "Patel", "Krishnan", "Gupta", "Reddy", "Iyer", "Nair", "Mehta", "Chopra", "Verma", "Kapoor", "Singh", "Bhat", "Deshmukh", "Joshi"],
  american: ["Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Anderson", "Taylor", "Thomas", "Moore", "Jackson", "Martin"],
  european: ["Mueller", "Schmidt", "Weber", "Fischer", "Meyer", "Schneider", "Hoffmann", "Becker", "Richter", "Wolf", "Schaefer", "Neumann", "Schwarz", "Zimmermann", "Braun"],
  asian: ["Tanaka", "Suzuki", "Takahashi", "Watanabe", "Ito", "Nakamura", "Kobayashi", "Kato", "Yoshida", "Yamada", "Sasaki", "Yamaguchi", "Matsumoto", "Kimura", "Hayashi"],
};

const jobTitles = [
  "Chief Executive Officer", "Chief Technology Officer", "Chief Revenue Officer",
  "VP of Sales", "VP of Marketing", "VP of Engineering", "VP of Product",
  "Head of Sales", "Head of Marketing", "Head of Engineering", "Head of Operations",
  "Director of Sales", "Director of Marketing", "Director of Engineering", "Director of Product",
  "Senior Product Manager", "Product Manager", "Senior Software Engineer",
  "Sales Director", "Marketing Director", "Business Development Manager",
  "Enterprise Account Executive", "Senior Account Executive", "Account Manager",
  "Solutions Architect", "Technical Lead", "Engineering Manager",
  "Growth Lead", "Demand Generation Manager", "Revenue Operations Manager",
  "Customer Success Manager", "Head of Partnerships", "Strategic Alliance Manager",
  "Chief Information Security Officer", "VP of Customer Success",
  "Director of Data Science", "Head of AI/ML", "Principal Engineer",
  "Chief Operating Officer", "Chief Financial Officer",
];

const roleBuckets: Array<"decision-maker" | "influencer" | "champion" | "blocker" | "end-user"> = [
  "decision-maker", "influencer", "champion", "blocker", "end-user",
];

const emailHealthOptions = ["valid", "risky", "invalid", "unknown"] as const;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickWeighted<T extends string>(arr: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
}

const ethnicityByCountry: Record<string, string[]> = {
  "US": ["american", "indian", "asian"],
  "India": ["indian"],
  "UK": ["european", "american", "indian"],
  "Germany": ["european"],
  "Singapore": ["asian", "indian", "american"],
  "Australia": ["american", "european", "asian"],
  "Canada": ["american", "european", "asian"],
  "Japan": ["asian"],
  "Israel": ["european", "american"],
};

function generateContactsForCompany(company: CompanySeed, index: number): Array<{
  name: string;
  email: string;
  jobTitle: string;
  roleBucket: string;
  linkedinUrl: string;
  phone: string;
  location: string;
  status: string;
  emailHealth: string;
  emailHealthScore: number;
  lastValidatedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
}> {
  const numContacts = 4 + Math.floor(Math.random() * 3); // 4-6
  const ethnicities = ethnicityByCountry[company.country] || ["american"];
  const contacts = [];

  // Pick unique job titles
  const shuffledTitles = [...jobTitles].sort(() => Math.random() - 0.5);

  for (let i = 0; i < numContacts; i++) {
    const ethnicity = pick(ethnicities);
    const fn = pick(firstNames[ethnicity as keyof typeof firstNames]);
    const ln = pick(lastNames[ethnicity as keyof typeof lastNames]);
    const fullName = `${fn} ${ln}`;
    const emailLocal = `${fn.toLowerCase()}.${ln.toLowerCase()}`;
    const email = `${emailLocal}@${company.domain}`;

    // First contact is usually decision-maker
    let roleBucket: string;
    if (i === 0) {
      roleBucket = "decision-maker";
    } else if (i === 1) {
      roleBucket = pickWeighted(roleBuckets, [30, 30, 20, 10, 10]);
    } else {
      roleBucket = pickWeighted(roleBuckets, [10, 25, 25, 15, 25]);
    }

    const emailHealth = pickWeighted(emailHealthOptions, [45, 20, 10, 25]);
    let emailHealthScore: number;
    switch (emailHealth) {
      case "valid": emailHealthScore = 75 + Math.floor(Math.random() * 26); break;
      case "risky": emailHealthScore = 40 + Math.floor(Math.random() * 35); break;
      case "invalid": emailHealthScore = Math.floor(Math.random() * 25); break;
      default: emailHealthScore = 50;
    }

    const lastValidatedAt = Math.random() > 0.4
      ? daysAgo(Math.floor(Math.random() * 30))
      : null;

    const archivedAt = Math.random() < 0.07
      ? daysAgo(Math.floor(Math.random() * 20))
      : null;

    const phone = `+1${Math.floor(2000000000 + Math.random() * 8000000000)}`;

    contacts.push({
      name: fullName,
      email,
      jobTitle: shuffledTitles[i % shuffledTitles.length],
      roleBucket,
      linkedinUrl: `https://linkedin.com/in/${emailLocal}`,
      phone: company.country === "India" ? `+91${Math.floor(7000000000 + Math.random() * 3000000000)}` :
             company.country === "UK" ? `+44${Math.floor(2000000000 + Math.random() * 8000000000)}` :
             company.country === "Germany" ? `+49${Math.floor(1500000000 + Math.random() * 6000000000)}` :
             company.country === "Japan" ? `+81${Math.floor(8000000000 + Math.random() * 1000000000)}` :
             company.country === "Singapore" ? `+65${Math.floor(8000000000 + Math.random() * 2000000000)}` :
             company.country === "Australia" ? `+61${Math.floor(4000000000 + Math.random() * 1000000000)}` :
             company.country === "Canada" ? `+1${Math.floor(2000000000 + Math.random() * 8000000000)}` :
             phone,
      location: company.location,
      status: company.status === "new" ? "new" : pick(["new", "contacted", "engaged"]),
      emailHealth,
      emailHealthScore,
      lastValidatedAt,
      archivedAt,
      createdAt: daysAgo(30 + Math.floor(Math.random() * 60)),
    });
  }

  return contacts;
}

// ─── Main Seed Function ──────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Starting DeepMindQ seed data generation...\n");

  // ── 1. Clear existing data ────────────────────────────────────────────────
  console.log("🗑️  Clearing existing data...");
  await db.emailHealthCheck.deleteMany();
  await db.draft.deleteMany();
  await db.timelineEntry.deleteMany();
  await db.contactNote.deleteMany();
  await db.companyNote.deleteMany();
  await db.capabilitySnippet.deleteMany();
  await db.capabilityDocument.deleteMany();
  await db.companyResearchSource.deleteMany();
  await db.companyResearchCard.deleteMany();
  await db.opportunity.deleteMany();
  await db.contact.deleteMany();
  await db.company.deleteMany();
  await db.customFieldValue.deleteMany();
  await db.customFieldDefinition.deleteMany();
  await db.importBatch.deleteMany();
  await db.userPreferences.deleteMany();
  console.log("✅ All data cleared.\n");

  // ── 2. UserPreferences ────────────────────────────────────────────────────
  console.log("👤 Creating UserPreferences...");
  await db.userPreferences.create({
    data: {
      tone: "professional-casual",
      emailLength: "medium",
      openerStyle: "Hi [First Name]",
      signOff: "Best, Ravi",
      avoidPhrases: "synergy, leverage, paradigm shift, circle back, touch base",
      exampleEmail: "Hi [First Name],\n\nI noticed [Company] is expanding its sales operations. We've helped similar teams increase pipeline coverage by 40% using AI-driven prospecting.\n\nWould love to share some insights if you're open to a quick chat.\n\nBest, Ravi",
      ctaStyle: "soft",
      aiProvider: "openai",
      aiModel: "gpt-4o-mini",
      scoringWeights: JSON.stringify({
        industry: 0.15,
        companySize: 0.10,
        engagement: 0.25,
        techFit: 0.20,
        decisionMakerAccess: 0.15,
        timing: 0.15,
      }),
    },
  });
  console.log("✅ UserPreferences created.\n");

  // ── 3. Companies ──────────────────────────────────────────────────────────
  console.log("🏢 Creating 50 companies...");
  const companyRecords: Map<string, { id: string; data: CompanySeed }> = new Map();
  const createdCompanies = [];

  for (let i = 0; i < companiesData.length; i++) {
    const c = companiesData[i];
    const record = await db.company.create({
      data: {
        name: c.name,
        domain: c.domain,
        linkedinUrl: `https://linkedin.com/company/${c.domain.split('.')[0]}`,
        website: c.website,
        industry: c.industry,
        employeeSize: c.employeeSize,
        country: c.country,
        location: c.location,
        status: c.status,
        intelligenceScore: c.intelligenceScore,
        dataFreshness: pick(["fresh", "stale", "moderate"]),
        createdAt: daysAgo(30 + Math.floor(Math.random() * 60)),
      },
    });
    companyRecords.set(record.id, { id: record.id, data: c });
    createdCompanies.push(record);
  }
  console.log(`✅ ${createdCompanies.length} companies created.\n`);

  // ── 4. Contacts ───────────────────────────────────────────────────────────
  console.log("👤 Creating contacts (4-6 per company)...");
  const contactMap: Map<string, string[]> = new Map(); // companyId -> contactId[]
  let totalContacts = 0;

  for (const [companyId, { data }] of companyRecords) {
    const contacts = generateContactsForCompany(data, 0);
    const contactIds: string[] = [];

    for (const c of contacts) {
      const record = await db.contact.create({
        data: {
          companyId,
          name: c.name,
          email: c.email,
          jobTitle: c.jobTitle,
          roleBucket: c.roleBucket,
          linkedinUrl: c.linkedinUrl,
          phone: c.phone,
          location: c.location,
          status: c.status,
          emailHealth: c.emailHealth,
          emailHealthScore: c.emailHealthScore,
          lastValidatedAt: c.lastValidatedAt,
          archivedAt: c.archivedAt,
          createdAt: c.createdAt,
        },
      });
      contactIds.push(record.id);
      totalContacts++;
    }

    contactMap.set(companyId, contactIds);
  }
  console.log(`✅ ${totalContacts} contacts created.\n`);

  // ── 5. Opportunities ──────────────────────────────────────────────────────
  console.log("💰 Creating 40 opportunities...");
  const opportunityTitles = [
    "AI Sales Intelligence Platform", "CRM Integration", "Lead Scoring Engine",
    "Predictive Pipeline Analytics", "Sales Engagement Automation", "Buyer Intent Data Platform",
    "Account-Based Marketing Suite", "Revenue Intelligence Dashboard", "Sales Conversational AI",
    "Data Enrichment API", "Prospecting Workflow Automation", "Deal Intelligence Platform",
    "Sales Forecasting Model", "Competitive Intelligence Tool", "Customer Health Score Platform",
    "Outreach Personalization Engine", "Pipeline Coverage Optimizer", "Sales Coaching AI",
    "Market Mapping Solution", "Tech Stack Analysis Tool", "Buying Committee Mapper",
    "Intent Signal Aggregator", "Revenue Operations Platform", "Sales Enablement Hub",
    "Account Prioritization Engine", "Contact Data Verification", "Sales Productivity Suite",
    "AI-Powered Lead Generation", "Pipeline Acceleration Toolkit", "B2B Contact Database",
    "Sales Territory Planner", "Win/Loss Analysis Platform", "Churn Prediction Engine",
    "Multi-Touch Attribution Model", "Sales Performance Dashboard", "Opportunity Scoring System",
    "Customer Acquisition Analytics", "Growth Intelligence Platform", "Sales Content Management",
  ];

  const opportunityStatuses = ["researching", "contacted", "qualified", "ready", "won", "lost"];
  const opportunityDescriptions = [
    "Implementing an AI-driven sales intelligence platform to enhance outbound prospecting and pipeline generation across the enterprise sales team.",
    "Deploying a comprehensive CRM integration that syncs contact data, deal stages, and activity timelines in real-time.",
    "Building a machine learning-powered lead scoring engine that prioritizes high-conversion prospects based on behavioral signals.",
    "Rolling out predictive pipeline analytics to forecast quarterly revenue with 85%+ accuracy using historical deal data.",
    "Automating the entire sales engagement workflow from initial outreach to meeting scheduling with AI-personalized sequences.",
    "Providing actionable buyer intent data to identify accounts actively researching solutions in our category.",
    "Launching an account-based marketing suite that targets key stakeholders with personalized multi-channel campaigns.",
    "Creating a centralized revenue intelligence dashboard for leadership to monitor pipeline health and team performance.",
    "Integrating conversational AI into the sales process to analyze call recordings and surface coaching insights.",
    "Connecting to a real-time data enrichment API to maintain up-to-date contact and company records.",
    "Streamlining the entire prospecting workflow with intelligent automation that reduces manual research time by 60%.",
    "Developing a deal intelligence platform that provides real-time competitive insights and risk assessment for active opportunities.",
    "Implementing advanced sales forecasting using AI models trained on win/loss patterns and market signals.",
    "Deploying a competitive intelligence tool that monitors competitor pricing, positioning, and customer movements.",
    "Building a customer health scoring platform that combines product usage, support tickets, and engagement metrics.",
    "Creating an outreach personalization engine that generates hyper-relevant email content based on prospect research.",
    "Optimizing pipeline coverage ratios using AI-driven recommendations for deal progression and risk mitigation.",
    "Launching an AI-powered sales coaching platform that provides real-time feedback on rep performance.",
    "Mapping the entire market landscape to identify whitespace opportunities and untapped verticals.",
    "Analyzing prospect tech stacks to determine integration compatibility and upsell opportunities.",
    "Visualizing and mapping buying committee dynamics to ensure comprehensive account coverage.",
    "Aggregating intent signals from multiple sources to create a unified scoring model for purchase readiness.",
    "Unifying revenue operations data across sales, marketing, and customer success for end-to-end visibility.",
    "Centralizing all sales enablement content with AI-powered recommendations for deal-stage relevance.",
    "Implementing a data-driven account prioritization engine that ranks target accounts by revenue potential and fit.",
    "Verifying and enriching contact data to maintain a 95%+ deliverability rate across all outbound campaigns.",
    "Providing a suite of productivity tools designed specifically for high-velocity B2B sales teams.",
    "Generating qualified leads at scale using AI that identifies and engages ideal customer profiles automatically.",
    "Accelerating deal velocity through intelligent stage-gate recommendations and next-best-action guidance.",
    "Maintaining a comprehensive B2B contact database with real-time verification and enrichment capabilities.",
    "Optimizing sales territory assignments using data-driven analysis of market potential and rep capacity.",
    "Analyzing won and lost deals to uncover patterns and improve overall win rates systematically.",
    "Predicting customer churn before it happens using AI models that detect early warning signals.",
    "Implementing multi-touch attribution to accurately measure the impact of each marketing and sales interaction.",
    "Creating a real-time sales performance dashboard with customizable KPIs and benchmarking capabilities.",
    "Deploying an AI-powered opportunity scoring system that predicts deal outcomes and recommends actions.",
    "Building a customer acquisition analytics platform that tracks CAC, LTV, and cohort performance.",
    "Developing a growth intelligence platform that identifies expansion opportunities within existing accounts.",
    "Managing and distributing sales content efficiently with AI-powered content recommendations.",
  ];

  const nextActions = [
    "Schedule a discovery call with the VP of Sales to discuss current pipeline challenges",
    "Send a personalized case study relevant to their industry vertical",
    "Follow up on the demo request sent last week",
    "Prepare a custom ROI analysis based on their team size and quota",
    "Connect with the CTO to discuss technical integration requirements",
    "Share a competitive comparison document highlighting key differentiators",
    "Request an introduction to the Chief Revenue Officer via the champion contact",
    "Send a product walkthrough video tailored to their use case",
    "Schedule a technical deep-dive with their engineering team",
    "Prepare a proposal with custom pricing for their enterprise plan",
    "Follow up on the RFP response submitted last month",
    "Arrange a reference call with a similar customer in their industry",
    "Send a detailed integration guide and API documentation",
    "Schedule a quarterly business review to discuss expansion opportunities",
    "Prepare a security and compliance documentation package",
  ];

  let opportunityCount = 0;
  const companyIds = Array.from(companyRecords.keys());

  for (let i = 0; i < 40; i++) {
    const companyId = companyIds[i % companyIds.length];
    const contactIds = contactMap.get(companyId) || [];
    const targetContactId = contactIds.length > 0 ? pick(contactIds) : null;
    const status = opportunityStatuses[i < 6 ? 0 : i < 14 ? 1 : i < 20 ? 2 : i < 28 ? 3 : i < 34 ? 4 : 5];

    await db.opportunity.create({
      data: {
        companyId,
        title: opportunityTitles[i % opportunityTitles.length],
        description: opportunityDescriptions[i % opportunityDescriptions.length],
        targetContactId,
        status,
        nextAction: pick(nextActions),
        createdAt: daysAgo(Math.floor(Math.random() * 90)),
      },
    });
    opportunityCount++;
  }
  console.log(`✅ ${opportunityCount} opportunities created.\n`);

  // ── 6. Research Cards ─────────────────────────────────────────────────────
  console.log("📋 Creating research cards for 18 companies...");
  const researchCompanyIndices = [0, 1, 2, 3, 4, 7, 10, 11, 12, 16, 20, 21, 26, 30, 38, 41, 44, 48];
  let researchCount = 0;

  const businessOverviews = [
    "NexaFlow Technologies is a mid-market SaaS company specializing in workflow automation for enterprise teams. They recently raised a Series B round of $35M and are aggressively expanding their go-to-market function. Their platform serves over 500 enterprise customers globally.",
    "DataPulse AI builds machine learning infrastructure tools for data science teams. Founded by former Google researchers, they've gained significant traction in the AI/ML space. They're currently scaling from 40 to 100 employees with a focus on enterprise sales.",
    "CloudVista Systems provides cloud migration and management tools for mid-to-large enterprises. With a strong presence in the European market, they're now expanding into North America. Their annual recurring revenue exceeds $20M.",
    "FinEdge Solutions offers a B2B payments platform targeting SMEs in Southeast Asia. They process over $2B in annual transaction volume and are exploring expansion into adjacent markets. Their sales team of 30 is looking to double in the next year.",
    "HealthBridge Analytics develops data analytics platforms for healthcare providers. They work with hospital systems and insurance companies to improve patient outcomes through data-driven insights. They have a strong regulatory compliance posture.",
    "CyberVault Security is a cybersecurity firm specializing in zero-trust architecture for enterprise customers. They've seen 200% revenue growth year-over-year driven by increasing demand for cloud security solutions.",
    "PropNest Realty is a PropTech startup that uses AI to streamline commercial real estate transactions. They've recently closed partnerships with three major brokerage firms and are building out their enterprise sales function.",
    "QuantumSync Labs is an early-stage AI research company developing next-generation natural language processing models for business applications. They're backed by top-tier VCs and are exploring commercialization paths.",
    "PayGrid Financial is a fast-growing FinTech company providing payment processing solutions for enterprise clients. They process $15B+ annually and are investing heavily in their sales and marketing infrastructure.",
    "ShieldNet Cyber provides managed security services and threat intelligence for mid-market companies. They're expanding from their Israeli base into European and North American markets.",
    "SaaSMatrix Pro offers a comprehensive SaaS management platform for IT leaders. They help organizations optimize their software spend and manage vendor relationships across hundreds of SaaS applications.",
    "NeuralWave Computing develops AI acceleration hardware and software for enterprise data centers. They're targeting the rapidly growing edge computing market and have secured several large enterprise contracts.",
    "ThreatGuard Solutions is an established cybersecurity company with a broad portfolio of products including SIEM, SOAR, and endpoint detection. They serve Fortune 500 companies and government agencies.",
    "CloudPeak Solutions provides cloud cost optimization and governance tools for engineering teams. They help companies reduce cloud spend by an average of 30% through intelligent resource management.",
    "DeepCore Intelligence specializes in deep learning solutions for enterprise applications including computer vision, NLP, and predictive analytics. They serve customers across financial services, healthcare, and manufacturing.",
    "CogniSense AI builds conversational AI platforms for customer service and sales automation. Their technology powers virtual assistants for several Fortune 500 companies.",
    "SentinelCore Systems offers identity and access management solutions for enterprise customers. They're experiencing strong demand driven by remote work security requirements.",
    "BuildSmart PropTech develops construction project management software with IoT integration. They serve general contractors and property developers across the Asia-Pacific region.",
  ];

  const techLandscapes = [
    "Uses Salesforce CRM with custom integrations, HubSpot for marketing automation, and a custom-built data warehouse on Snowflake. Sales team uses Outreach.io for sequences and Gong for call recording.",
    "Built on a modern tech stack: React frontend, Python/Go backend, Kubernetes on AWS. Uses Notion for internal wiki, Slack for communication, and has been evaluating AI tools for sales enablement.",
    "Primarily Microsoft stack: Dynamics 365 CRM, Azure cloud, Power BI for analytics. Sales team uses LinkedIn Sales Navigator and has recently adopted Apollo.io for prospecting.",
    "Tech-forward company using HubSpot CRM, Segment for data, and Amplitude for product analytics. Sales stack includes Salesloft and Clari for forecasting.",
    "Enterprise-grade stack: Salesforce Health Cloud, Tableau for analytics, Veeva for compliance. Heavy investment in data security with SOC 2 Type II certification.",
    "Security-first approach: uses Palo Alto Networks internally, ServiceNow for ITSM, and has built custom security dashboards. Evaluating additional sales intelligence tools.",
    "Modern PropTech stack: uses HubSpot CRM, Propertybase for real estate operations, and custom dashboards on Looker. Growing interest in AI-powered market analysis.",
    "Research-heavy environment: uses Notion, GitHub, and custom ML pipelines. Minimal traditional CRM adoption — relies on spreadsheets and personal networks for sales tracking.",
    "FinTech infrastructure: AWS with custom security layers, Salesforce Financial Services Cloud, and integrated payment processing. Compliance-driven with PCI DSS Level 1 certification.",
    "Israeli tech scene: uses Monday.com for project management, custom CRM built on Airtable, and advanced threat intelligence platforms. Strong engineering culture.",
    "SaaS management focus: uses G2 for competitive intelligence, ProductBoard for product management, and a custom-built customer health scoring system.",
    "Deep tech stack: PyTorch for ML, Kubernetes for orchestration, and custom MLOps tools. Sales function is nascent and relies heavily on founder-led selling.",
    "Enterprise security vendor: uses Salesforce extensively, Marketo for demand gen, and has a mature sales enablement program with highspot for content management.",
    "Cloud-native company: uses Datadog for monitoring, Terraform for infrastructure, and has built custom FinOps dashboards. Sales team uses Apollo and LinkedIn Sales Navigator.",
    "AI-first company: custom LLM infrastructure, vector databases, and advanced NLP pipelines. Growing commercial team is evaluating enterprise sales tools.",
    "Conversational AI platform: uses Dialogflow internally, Zendesk for support, and Salesforce for CRM. Looking to expand sales operations into new verticals.",
    "Identity security specialist: uses Okta internally, ServiceNow for operations, and has a well-established channel partner program. Salesforce is the primary CRM.",
    "Construction tech: uses Procore for project management, custom IoT platforms, and is building out enterprise sales capability. HubSpot CRM recently adopted.",
  ];

  const challengeSets = [
    "1. Scaling sales team from 15 to 40 reps while maintaining quality\n2. Long sales cycles (avg 6-8 months) in enterprise segment\n3. Difficulty identifying and reaching decision-makers at target accounts\n4. Data quality issues in existing CRM leading to wasted outreach\n5. Limited visibility into pipeline health and forecasting accuracy",
    "1. Highly competitive market with well-established players\n2. Technical sales require deep product knowledge\n3. Expanding into new geographic markets without local sales expertise\n4. Need to demonstrate clear ROI to justify premium pricing\n5. Balancing inbound lead quality with outbound volume",
    "1. Complex product requiring consultative selling approach\n2. Integrating with diverse customer tech stacks\n3. Building trust in regulated healthcare market\n4. Managing long evaluation and procurement cycles\n5. Competition from both startups and established vendors",
    "1. Rapid hiring creating onboarding and ramp-time challenges\n2. Data fragmentation across multiple tools and systems\n3. Maintaining message consistency across a growing sales team\n4. Increasing customer acquisition costs\n5. Need for better competitive intelligence and positioning",
    "1. Navigating complex security procurement processes\n2. Building credibility in a market dominated by large incumbents\n3. Shortage of qualified security-focused sales talent\n4. Long proof-of-concept cycles delaying deal closure\n5. Need to differentiate in an increasingly crowded market",
    "1. Nascent sales function relying on founder-led deals\n2. Need to build repeatable sales processes from scratch\n3. Technical complexity making it hard to communicate value proposition\n4. Limited brand recognition in target enterprise market\n5. Budget constraints for sales tool investment",
    "1. Managing multi-stakeholder sales in large enterprise accounts\n2. Maintaining deal momentum through extended evaluation cycles\n3. Competition offering similar capabilities at lower price points\n4. Need to expand into adjacent verticals for growth\n5. Sales and marketing alignment challenges impacting pipeline quality",
    "1. Channel sales model creating indirect customer relationships\n2. Measuring and demonstrating security ROI to business leaders\n3. Regulatory compliance requirements adding complexity to sales\n4. Expanding internationally while maintaining service quality\n5. Retaining top sales talent in competitive cybersecurity market",
    "1. Technical buyers requiring deep product expertise from sales\n2. Long implementation cycles impacting annual contract targets\n3. Growing market demand outpacing current sales capacity\n4. Need for specialized sales plays by industry vertical\n5. Building effective partner channel for distribution",
    "1. Educating market on new approach to an established problem\n2. Long evaluation cycles with multiple stakeholders\n3. Demonstrating clear value over DIY solutions\n4. Building enterprise-grade sales operations from startup roots\n5. Managing cash flow while scaling commercial team",
  ];

  const opportunityTexts = [
    "Strong product-market fit in a growing segment. Their expansion plans indicate budget availability and urgency. Multiple stakeholders have expressed interest in modernizing their sales stack. The recent funding round provides a clear window of opportunity for large deals.",
    "They're actively hiring sales reps which signals investment in outbound. Their current tools have known gaps that our platform addresses directly. A champion already exists within the VP Sales team. The competitive landscape favors our differentiated approach.",
    "Their industry is experiencing regulatory changes that create urgency for better data management. They've publicly discussed digital transformation initiatives. The technical team has shown interest in API-first solutions. Decision-making appears centralized with the CTO.",
    "Recent leadership changes suggest openness to new vendor relationships. Their customer churn rate indicates room for improvement in sales processes. They're investing in AI capabilities but lack sales-specific intelligence. Timing aligns with their annual budget planning cycle.",
    "Significant market tailwinds in their sector driving budget increases. Their current tech stack has integration challenges we can solve. Multiple touchpoints within the organization show awareness of our brand. They're expanding geographically which creates additional opportunity.",
  ];

  const serviceOptions = [
    "AI-Powered Lead Scoring, Predictive Pipeline Analytics, Sales Intelligence Platform, Data Enrichment Services",
    "Sales Engagement Automation, Buyer Intent Analysis, Account-Based Marketing, CRM Integration",
    "Revenue Intelligence Dashboard, Sales Coaching AI, Competitive Intelligence, Deal Acceleration",
    "Contact Data Verification, Market Mapping, Territory Planning, Sales Enablement Suite",
    "Prospecting Workflow Automation, Lead Generation, Sales Forecasting, Performance Analytics",
  ];

  const decisionMakerTexts = [
    "Primary: Sarah Chen (VP Sales) — drives sales tool decisions\nSecondary: Mark Thompson (CTO) — approves technical integrations\nInfluencer: Lisa Park (Head of Marketing) — manages demand gen budget",
    "Primary: James Müller (CEO) — hands-on with key vendor decisions\nSecondary: Priya Sharma (CRO) — owns revenue operations\nChampion: David Kim (Director of Sales Ops) — actively evaluating tools",
    "Primary: Alexandra Weber (Head of Sales) — building out new sales tech stack\nSecondary: Tom Brown (VP Engineering) — technical evaluation lead\nInfluencer: Rachel Lee (RevOps Manager) — manages sales tools budget",
    "Primary: Hans Schmidt (COO) — oversees commercial operations\nSecondary: Emily Taylor (VP of Business Development) — leads partnerships\nChampion: Michael Fischer (Sales Director) — expressed strong interest",
    "Primary: Kenji Yamamoto (CRO) — expanding sales organization\nSecondary: Yuki Tanaka (VP Product) — influences product-led growth strategy\nInfluencer: Wei Chen (Head of Growth) — manages demand generation",
  ];

  const researchNextActions = [
    "Schedule intro call with the VP of Sales through warm introduction",
    "Send a personalized insight report based on their recent growth metrics",
    "Prepare a competitive analysis showing advantages over their current stack",
    "Request a product demo with the technical evaluation committee",
    "Share an industry-specific case study relevant to their vertical",
  ];

  for (let i = 0; i < Math.min(researchCompanyIndices.length, 18); i++) {
    const companyIdx = researchCompanyIndices[i];
    const companyId = companyIds[companyIdx];
    if (!companyId) continue;

    await db.companyResearchCard.create({
      data: {
        companyId,
        businessOverview: businessOverviews[i % businessOverviews.length],
        currentTechLandscape: techLandscapes[i % techLandscapes.length],
        potentialChallenges: challengeSets[i % challengeSets.length],
        possibleOpportunities: opportunityTexts[i % opportunityTexts.length],
        relevantServices: serviceOptions[i % serviceOptions.length],
        keyDecisionMakers: decisionMakerTexts[i % decisionMakerTexts.length],
        nextAction: researchNextActions[i % researchNextActions.length],
        confidenceScore: 50 + Math.floor(Math.random() * 46),
        createdAt: daysAgo(Math.floor(Math.random() * 30)),
      },
    });
    researchCount++;
  }
  console.log(`✅ ${researchCount} research cards created.\n`);

  // ── 7. Capability Documents ───────────────────────────────────────────────
  console.log("📄 Creating 6 capability documents...");
  const documents = [
    {
      title: "AI-Powered Sales Intelligence Platform Overview",
      docType: "PDF",
      description: "Comprehensive overview of our AI-driven sales intelligence platform capabilities and architecture",
      fileName: "ai-sales-intelligence-platform.pdf",
      content: `DeepMindQ's AI-Powered Sales Intelligence Platform represents the next generation of B2B sales technology. Built on cutting-edge machine learning models, our platform ingests and analyzes millions of data points to deliver actionable intelligence to sales teams in real-time. The system continuously learns from market signals, buyer behavior patterns, and competitive dynamics to provide increasingly accurate insights over time.

Our proprietary natural language processing engine can analyze company websites, news articles, job postings, and social media activity to build comprehensive company profiles. These profiles include technology stack analysis, growth indicators, funding events, and buying intent signals that help sales teams prioritize the right accounts at the right time. The platform integrates seamlessly with existing CRM systems, ensuring that intelligence flows directly into existing workflows without disruption.

The scoring algorithms behind our platform have been trained on millions of successful B2B sales outcomes, enabling us to predict with high accuracy which accounts are most likely to convert. Our customers report an average 3x improvement in pipeline quality and a 40% reduction in time spent on research and prospecting activities. The platform supports multiple industries including SaaS, FinTech, HealthTech, and more, with industry-specific models that understand the unique dynamics of each vertical.

Advanced features include real-time buyer intent monitoring, competitive intelligence alerts, and AI-generated outreach recommendations. The platform's recommendation engine analyzes each prospect's digital footprint to suggest the most effective messaging, timing, and channel for engagement. This data-driven approach has helped our customers achieve 2.5x higher response rates compared to traditional outbound methods.`,
    },
    {
      title: "Predictive Lead Scoring & Pipeline Analytics",
      docType: "DOCX",
      description: "Detailed guide to our predictive scoring models and pipeline analytics capabilities",
      fileName: "predictive-lead-scoring-guide.docx",
      content: `Our Predictive Lead Scoring engine leverages advanced machine learning to transform how sales teams evaluate and prioritize their pipeline. Unlike traditional rule-based scoring systems, our models dynamically weigh dozens of behavioral, firmographic, and technographic signals to produce scores that accurately reflect each prospect's likelihood to convert. The system continuously recalibrates based on new data, ensuring that scores remain accurate even as market conditions evolve.

The Pipeline Analytics module provides sales leaders with unprecedented visibility into their team's performance and pipeline health. Real-time dashboards display key metrics including pipeline coverage ratios, average deal velocity, stage conversion rates, and revenue forecasts. Our AI-powered forecasting model has demonstrated 85%+ accuracy in predicting quarterly revenue outcomes, significantly outperforming traditional weighted-average methods.

Our scoring models incorporate over 50 distinct signals including website engagement patterns, content consumption behavior, technology adoption indicators, organizational growth metrics, and market timing signals. Each signal is weighted differently based on historical conversion data specific to each customer's ideal customer profile. This personalization ensures that the scoring system learns what works for each unique sales organization.

The platform also includes advanced cohort analysis capabilities that help sales teams understand which types of accounts convert at the highest rates. By identifying patterns in successful deals, the system can recommend lookalike accounts that share similar characteristics. This has proven particularly effective for account-based marketing strategies, where targeting precision directly impacts campaign ROI. Customers using our predictive scoring have reported a 45% increase in win rates and a 30% reduction in sales cycle length.`,
    },
    {
      title: "CRM Integration & Data Enrichment Services",
      docType: "PDF",
      description: "Technical documentation for CRM integrations and data enrichment APIs",
      fileName: "crm-integration-data-enrichment.pdf",
      content: `DeepMindQ's CRM Integration suite provides bi-directional, real-time synchronization with all major CRM platforms including Salesforce, HubSpot, Microsoft Dynamics 365, and Pipedrive. Our integration architecture uses event-driven webhooks and optimized batch processing to ensure that contact data, company intelligence, and engagement signals flow seamlessly between our platform and your existing systems. The setup process typically completes in under 30 minutes with no engineering resources required.

Our Data Enrichment API delivers comprehensive firmographic and technographic data for any company or contact record. The service covers over 200 million companies worldwide and provides real-time updates on key business attributes including employee count, revenue estimates, technology stack, funding history, and key personnel changes. Data freshness is maintained through continuous crawling of public sources, regulatory filings, and proprietary data partnerships.

The enrichment pipeline processes millions of records daily with a 99.5% match rate for company records and 95%+ match rate for individual contacts. Our entity resolution engine uses advanced fuzzy matching algorithms that correctly handle company name variations, mergers, acquisitions, and rebranding events. The result is a consistently clean, deduplicated, and enriched database that sales teams can trust.

For enterprise customers, we offer custom data enrichment pipelines that can incorporate proprietary data sources and company-specific attributes. Our team of data engineers works closely with customers to design enrichment schemas that align with their unique business requirements. We also provide data quality monitoring dashboards that track enrichment coverage, accuracy metrics, and data freshness over time. This transparency ensures that customers always know the quality and completeness of their enriched data.`,
    },
    {
      title: "Buyer Intent Data & Market Intelligence",
      docType: "DOCX",
      description: "How our buyer intent signals help identify purchase-ready accounts",
      fileName: "buyer-intent-market-intelligence.docx",
      content: `DeepMindQ's Buyer Intent Data engine monitors digital signals across thousands of sources to identify accounts that are actively researching solutions in your category. Our proprietary signal collection network captures intent data from content consumption platforms, review sites, community forums, job boards, social media, and technology adoption indicators. Each signal is scored and aggregated to produce a comprehensive intent profile for every tracked account.

The Market Intelligence module goes beyond individual account monitoring to provide macro-level insights about industry trends, competitive dynamics, and market opportunities. Our AI algorithms analyze patterns across millions of data points to identify emerging market segments, shifts in buyer preferences, and competitive threats before they become obvious. This forward-looking intelligence helps sales and marketing teams allocate resources to the highest-potential opportunities.

Our intent scoring model distinguishes between research-level intent, evaluation-level intent, and purchase-level intent using a combination of signal recency, frequency, and specificity. An account that visits multiple product comparison pages, downloads technical documentation, and has key decision-makers attending industry events would score as high-intent, while an account with only casual website visits would score as low-intent. This nuanced approach reduces false positives and ensures sales teams focus on genuinely qualified opportunities.

The platform delivers intent insights through multiple channels including real-time alerts, CRM integrations, weekly intelligence briefings, and interactive dashboards. Sales teams can configure custom alert rules based on their specific target criteria, ensuring they receive notifications about the accounts that matter most to their pipeline. Our customers report that intent-informed outreach achieves 3x higher engagement rates compared to traditional cold outreach, making it one of the highest-ROI capabilities in our platform.`,
    },
    {
      title: "Sales Engagement & Outreach Automation",
      docType: "PDF",
      description: "Comprehensive guide to AI-powered sales engagement and multi-channel outreach",
      fileName: "sales-engagement-automation.pdf",
      content: `DeepMindQ's Sales Engagement platform combines AI-powered personalization with multi-channel automation to help sales teams scale their outreach without sacrificing quality. The system generates uniquely crafted messages for each prospect based on their company profile, role, recent activities, and communication preferences. Our AI has been trained on millions of successful B2B sales conversations to understand what messaging resonates with different buyer personas and industry verticals.

The multi-channel orchestration engine manages outreach sequences across email, LinkedIn, phone, and other channels from a single interface. Each sequence is dynamically optimized based on real-time engagement data — if a prospect opens an email but doesn't respond, the system automatically adjusts the follow-up timing and messaging to maximize the chance of engagement. A/B testing is built into every sequence, allowing teams to continuously improve their outreach performance through data-driven optimization.

Our personalization engine goes beyond simple template variables to generate truly contextually relevant messaging. It analyzes a prospect's company news, recent funding rounds, technology stack, LinkedIn activity, and published content to craft messages that demonstrate genuine understanding of the prospect's situation. This level of personalization has proven to increase response rates by 60-80% compared to standard template-based approaches.

The platform also includes AI-powered response analysis that can categorize incoming replies as positive, neutral, or negative, suggest appropriate follow-up actions, and even draft response templates for common objections. Sales reps can review and customize AI-suggested responses before sending, maintaining the human touch while dramatically reducing response time. Integration with calendar tools enables automatic meeting scheduling when a prospect expresses interest, reducing friction in the booking process and increasing conversion from reply to meeting.`,
    },
    {
      title: "Enterprise Security & Compliance",
      docType: "TXT",
      description: "Security architecture, compliance certifications, and data protection policies",
      fileName: "enterprise-security-compliance.txt",
      content: `DeepMindQ is built with enterprise-grade security at its foundation. Our platform architecture follows a zero-trust security model with defense-in-depth layers protecting all data and systems. All data is encrypted at rest using AES-256 encryption and in transit using TLS 1.3. Our infrastructure is hosted on AWS with data residency options in the United States, European Union, and Asia-Pacific regions, allowing customers to meet their specific data sovereignty requirements.

We maintain SOC 2 Type II certification, demonstrating our commitment to rigorous security controls and continuous compliance. Our security program includes regular penetration testing by independent third parties, automated vulnerability scanning, and a comprehensive bug bounty program. We undergo annual security audits and maintain detailed documentation of all security controls, policies, and procedures for customer review.

Access control is managed through role-based access control (RBAC) with support for single sign-on (SSO) integration via SAML 2.0 and OpenID Connect. We support all major identity providers including Okta, Azure AD, Google Workspace, and OneLogin. All administrative actions are logged in an immutable audit trail, providing complete visibility into who accessed what data and when. Multi-factor authentication is enforced for all user accounts.

Our data handling practices comply with GDPR, CCPA, and other applicable data protection regulations. We provide comprehensive data processing agreements (DPAs) for all customers and offer data deletion and portability capabilities. Customer data is logically isolated at the tenant level, and we never share customer data between tenants or use it to train our AI models without explicit consent. Our privacy-by-design approach ensures that data protection is embedded into every aspect of the platform's architecture and operations.`,
    },
  ];

  const docRecords = [];
  for (const doc of documents) {
    const record = await db.capabilityDocument.create({
      data: {
        title: doc.title,
        docType: doc.docType,
        description: doc.description,
        content: doc.content,
        fileName: doc.fileName,
        createdAt: daysAgo(Math.floor(Math.random() * 60)),
      },
    });
    docRecords.push(record);
  }
  console.log(`✅ ${docRecords.length} capability documents created.\n`);

  // ── 8. Capability Snippets ────────────────────────────────────────────────
  console.log("📌 Creating 44 capability snippets...");
  const snippetData = [
    { docIdx: 0, type: "Case Study", title: "SaaS Company Reduces Research Time by 60%", content: "A mid-market SaaS company with a 40-person sales team adopted DeepMindQ's sales intelligence platform and reduced average prospect research time from 45 minutes to 18 minutes per account. The AI-generated company profiles eliminated manual data gathering, allowing reps to focus on high-value selling activities. Within six months, the team's pipeline generation increased by 35% while maintaining the same headcount.", industries: "SaaS, Cloud Computing", outcomes: "60% faster research, 35% more pipeline, 18 min avg research time" },
    { docIdx: 0, type: "Service", title: "Real-Time Company Intelligence", content: "Our AI engine continuously monitors and analyzes signals from public sources to build and maintain up-to-date company profiles. This includes technology stack detection, growth indicators, organizational changes, funding events, and market positioning analysis. The intelligence is delivered in real-time through CRM integrations and API endpoints.", industries: "SaaS, FinTech, HealthTech, AI/ML", outcomes: "Real-time insights, 200M+ company profiles, continuous monitoring" },
    { docIdx: 0, type: "Capability", title: "Natural Language Processing for Sales Intelligence", content: "Our proprietary NLP engine processes unstructured data from websites, news articles, social media, and regulatory filings to extract meaningful business intelligence. The system identifies key entities, relationships, and events that impact buying propensity and sales readiness.", industries: "All Industries", outcomes: "Unstructured data analysis, entity extraction, relationship mapping" },
    { docIdx: 0, type: "Outcome", title: "3x Pipeline Quality Improvement", content: "Customers using our full sales intelligence suite report an average 3x improvement in pipeline quality as measured by stage progression rates and close rates. The combination of accurate prospect data, predictive scoring, and AI-generated insights ensures that sales teams are always working on the highest-potential opportunities.", industries: "SaaS, FinTech, E-commerce, EdTech", outcomes: "3x pipeline quality, higher close rates, better stage progression" },
    { docIdx: 1, type: "Case Study", title: "FinTech Startup Achieves 45% Higher Win Rate", content: "A Series B FinTech company implemented our predictive lead scoring and within four months saw their win rate climb from 18% to 26%. The scoring model identified high-intent prospects that their previous manual qualification process was missing, while also deprioritizing accounts that looked promising on paper but had low conversion probability.", industries: "FinTech, Financial Services", outcomes: "45% higher win rate, 18% to 26% win rate, better qualification" },
    { docIdx: 1, type: "Service", title: "Dynamic Lead Scoring Engine", content: "Our machine learning models score every lead and account on a 0-100 scale based on 50+ behavioral and firmographic signals. Scores update in real-time as new signals are detected, ensuring that sales teams always have the most current view of their pipeline's potential.", industries: "SaaS, FinTech, HealthTech, Cybersecurity", outcomes: "50+ scoring signals, real-time updates, 0-100 scoring scale" },
    { docIdx: 1, type: "Capability", title: "AI-Powered Revenue Forecasting", content: "Our forecasting model uses ensemble machine learning techniques trained on millions of historical deal outcomes to predict quarterly revenue with 85%+ accuracy. The model considers deal characteristics, rep performance patterns, seasonal trends, and macroeconomic indicators to produce reliable forecasts.", industries: "All Industries", outcomes: "85%+ forecast accuracy, ensemble ML models, quarterly predictions" },
    { docIdx: 1, type: "Outcome", title: "30% Reduction in Sales Cycle Length", content: "By prioritizing accounts with the highest conversion probability and providing sales teams with the intelligence they need to engage effectively, our customers consistently achieve shorter sales cycles. The average reduction is 30%, with some customers reporting 45%+ improvements in specific verticals.", industries: "SaaS, Manufacturing, Logistics", outcomes: "30% shorter cycles, faster revenue recognition, improved efficiency" },
    { docIdx: 2, type: "Case Study", title: "HealthTech Company Maintains 95%+ Data Quality", content: "A HealthTech company processing sensitive patient data needed to maintain impeccable contact data quality for compliance and outreach effectiveness. After implementing our data enrichment service, they achieved 95%+ email deliverability and reduced bounced emails by 78%. The automated enrichment pipeline saved their operations team 20+ hours per week.", industries: "HealthTech, Healthcare", outcomes: "95%+ deliverability, 78% fewer bounces, 20+ hrs/week saved" },
    { docIdx: 2, type: "Service", title: "Automated Data Enrichment Pipeline", content: "Our enrichment pipeline automatically processes and enhances contact and company records with comprehensive firmographic, technographic, and behavioral data. The system maintains a 99.5% company match rate and 95%+ contact match rate through advanced entity resolution algorithms.", industries: "All Industries", outcomes: "99.5% company match rate, 95%+ contact match rate, automated processing" },
    { docIdx: 2, type: "Capability", title: "Bi-Directional CRM Synchronization", content: "Our integration platform provides real-time, bi-directional sync with Salesforce, HubSpot, Dynamics 365, and Pipedrive. Changes made in either system are propagated instantly, ensuring data consistency across all sales tools without manual effort.", industries: "All Industries", outcomes: "Real-time sync, multi-CRM support, zero data loss" },
    { docIdx: 2, type: "Outcome", title: "Complete Data Ecosystem Unification", content: "Customers report that our integration capabilities eliminate data silos between their CRM, marketing automation, and sales engagement tools. This unified view of prospect and customer data enables more coordinated outreach, better handoffs between teams, and comprehensive reporting across the entire revenue funnel.", industries: "SaaS, FinTech, E-commerce, Manufacturing", outcomes: "Unified data view, eliminated silos, coordinated outreach" },
    { docIdx: 3, type: "Case Study", title: "Cybersecurity Firm Triples Qualified Pipeline", content: "A mid-market cybersecurity company used our buyer intent data to identify and engage accounts actively researching security solutions. By focusing outreach on high-intent accounts, they tripled their qualified pipeline within two quarters while reducing their total outbound volume by 40%.", industries: "Cybersecurity, IT Services", outcomes: "3x qualified pipeline, 40% less outbound, higher efficiency" },
    { docIdx: 3, type: "Service", title: "Multi-Source Intent Signal Aggregation", content: "We collect and analyze intent signals from thousands of sources including content platforms, review sites, job boards, social media, and technology adoption indicators. Each signal is scored, deduplicated, and aggregated into a unified intent profile for every tracked account.", industries: "SaaS, FinTech, Cybersecurity, AI/ML", outcomes: "Thousands of sources, unified profiles, scored signals" },
    { docIdx: 3, type: "Capability", title: "Intent Signal Classification Engine", content: "Our AI classifies intent signals into three categories: research-level (early exploration), evaluation-level (active comparison), and purchase-level (ready to buy). This granular classification helps sales teams tailor their approach based on where each prospect is in their buying journey.", industries: "All Industries", outcomes: "3-tier classification, buyer journey mapping, tailored outreach" },
    { docIdx: 3, type: "Outcome", title: "3x Higher Engagement with Intent-Informed Outreach", content: "When sales teams use our intent data to inform their outreach timing and messaging, they consistently achieve 3x higher engagement rates compared to traditional cold outreach. The ability to reach prospects when they're actively in-market dramatically improves response rates and meeting bookings.", industries: "SaaS, FinTech, HealthTech, E-commerce", outcomes: "3x engagement rate, better timing, higher response rates" },
    { docIdx: 4, type: "Case Study", title: "E-commerce Platform Scales from 5 to 25 Reps", content: "An e-commerce platform company used our sales engagement platform to scale their outbound team from 5 to 25 reps without increasing sales operations headcount. The AI-powered automation handled the increased volume while maintaining personalized messaging quality, resulting in a 4x increase in meetings booked per rep.", industries: "E-commerce, Retail", outcomes: "5x team scale, no ops headcount increase, 4x meetings per rep" },
    { docIdx: 4, type: "Service", title: "AI-Powered Email Personalization", content: "Our personalization engine generates uniquely crafted email messages for each prospect by analyzing their company profile, recent activities, published content, and role-specific pain points. The system produces messages that read as if written by a knowledgeable human, driving significantly higher engagement than template-based approaches.", industries: "All Industries", outcomes: "Unique per-prospect messaging, 60-80% higher response rates, human-quality text" },
    { docIdx: 4, type: "Capability", title: "Multi-Channel Sequence Orchestration", content: "Design and manage multi-step outreach sequences across email, LinkedIn, phone, and other channels from a single interface. Each sequence adapts dynamically based on prospect engagement, with AI-optimized timing and channel selection to maximize response probability.", industries: "All Industries", outcomes: "Multi-channel outreach, dynamic optimization, automated adaptation" },
    { docIdx: 4, type: "Outcome", title: "60-80% Increase in Response Rates", content: "Our AI-personalized outreach consistently delivers 60-80% higher response rates compared to standard template-based approaches. By crafting messages that demonstrate genuine understanding of each prospect's unique situation, we help sales teams break through the noise and start meaningful conversations.", industries: "SaaS, FinTech, HealthTech, Manufacturing", outcomes: "60-80% more responses, meaningful conversations, breakthrough messaging" },
    { docIdx: 5, type: "Case Study", title: "Financial Services Firm Meets SOC 2 Requirements", content: "A financial services company needed a sales intelligence vendor that could meet their stringent security and compliance requirements. DeepMindQ's SOC 2 Type II certification, GDPR compliance, and data residency options made us the clear choice. The implementation included custom SSO configuration and a comprehensive DPA.", industries: "FinTech, Financial Services", outcomes: "SOC 2 compliance, GDPR ready, custom SSO, secure implementation" },
    { docIdx: 5, type: "Service", title: "Enterprise Data Security Suite", content: "Our security suite includes AES-256 encryption at rest, TLS 1.3 in transit, RBAC with SSO support, immutable audit logging, and comprehensive data isolation. We provide data residency options across multiple regions and full transparency through our security documentation.", industries: "FinTech, HealthTech, Cybersecurity", outcomes: "AES-256 encryption, SSO/RBAC, audit logging, data residency" },
    { docIdx: 5, type: "Capability", title: "Zero-Trust Security Architecture", content: "Every request to our platform is authenticated and authorized through a zero-trust security model. There is no implicit trust based on network location — every API call, data access, and user action is verified against strict security policies. This architecture ensures protection even in the event of perimeter breaches.", industries: "All Industries", outcomes: "Zero-trust model, every request verified, breach protection" },
    { docIdx: 5, type: "Outcome", title: "Enterprise-Ready Security Posture", content: "Our comprehensive security posture eliminates the security review bottleneck that often delays enterprise purchases. With pre-completed security questionnaires, SOC 2 reports readily available, and a dedicated security team for customer inquiries, we reduce the average enterprise security review from 8 weeks to 2 weeks.", industries: "FinTech, HealthTech, Government", outcomes: "2-week security review, pre-completed questionnaires, dedicated security team" },
    // Additional snippets spread across documents
    { docIdx: 0, type: "Service", title: "Technology Stack Detection", content: "Automatically identify the complete technology stack of any company including frontend frameworks, backend services, databases, cloud providers, analytics tools, and more. Our crawler analyzes DNS records, HTTP headers, JavaScript libraries, and public job postings to build a comprehensive tech profile.", industries: "SaaS, AI/ML, Cybersecurity", outcomes: "Full stack detection, 1000+ technologies, automated profiling" },
    { docIdx: 1, type: "Capability", title: "Lookalike Account Identification", content: "Our AI analyzes your best customers to identify lookalike accounts sharing similar characteristics. The system considers industry, size, tech stack, growth patterns, and organizational structure to recommend high-potential target accounts that mirror your ideal customer profile.", industries: "All Industries", outcomes: "Lookalike targeting, ICP matching, data-driven prospecting" },
    { docIdx: 2, type: "Capability", title: "Entity Resolution & Deduplication", content: "Advanced fuzzy matching algorithms handle company name variations, mergers, acquisitions, and rebranding events. The system correctly identifies when 'Acme Corp', 'Acme Corporation', and 'Acme Inc (formerly WidgetCo)' refer to the same entity, maintaining a clean and deduplicated database.", industries: "All Industries", outcomes: "Fuzzy matching, M&A tracking, clean database" },
    { docIdx: 3, type: "Service", title: "Weekly Intelligence Briefings", content: "Receive curated weekly briefings summarizing the most significant intent signals, market movements, and competitive changes affecting your target accounts. Each briefing is prioritized by relevance and includes recommended actions for the sales team.", industries: "SaaS, FinTech, Manufacturing", outcomes: "Weekly insights, prioritized signals, action recommendations" },
    { docIdx: 4, type: "Service", title: "AI Response Analysis & Suggested Replies", content: "Incoming prospect replies are automatically analyzed and categorized as positive, neutral, or negative. The AI suggests appropriate response actions and can draft reply templates for common scenarios, reducing response time and maintaining consistency across the sales team.", industries: "All Industries", outcomes: "Auto-categorized replies, suggested responses, faster follow-up" },
    { docIdx: 0, type: "Outcome", title: "2.5x Higher Outbound Response Rates", content: "By leveraging AI-generated company insights and personalized messaging recommendations, our customers achieve 2.5x higher response rates on outbound campaigns compared to traditional approaches. The combination of better targeting and more relevant messaging creates a compounding effect on engagement.", industries: "SaaS, FinTech, EdTech", outcomes: "2.5x response rate, AI-powered targeting, personalized messaging" },
    { docIdx: 1, type: "Outcome", title: "85%+ Revenue Forecast Accuracy", content: "Our ensemble forecasting model has consistently demonstrated 85%+ accuracy across diverse industries and company sizes. The model's ability to incorporate both quantitative deal data and qualitative market signals produces forecasts that sales leaders can confidently use for resource planning and investor reporting.", industries: "SaaS, FinTech, E-commerce", outcomes: "85%+ accuracy, resource planning, investor confidence" },
    { docIdx: 2, type: "Outcome", title: "30-Minute Zero-Code CRM Setup", content: "Our CRM integrations are designed for sales operations teams, not engineers. The guided setup process connects to Salesforce, HubSpot, or Dynamics 365 in under 30 minutes with no coding required. Pre-built field mappings and data synchronization rules get teams up and running immediately.", industries: "All Industries", outcomes: "30-min setup, no coding, pre-built mappings" },
    { docIdx: 3, type: "Outcome", title: "40% Reduction in Wasted Outreach", content: "By focusing on accounts with demonstrated buying intent, our customers eliminate a significant portion of wasted outreach effort. On average, teams reduce their total outbound volume by 40% while generating more qualified meetings, resulting in dramatic improvements in sales efficiency and rep satisfaction.", industries: "SaaS, FinTech, Manufacturing, Logistics", outcomes: "40% less waste, more qualified meetings, better efficiency" },
    { docIdx: 4, type: "Outcome", title: "4x Increase in Meetings Booked Per Rep", content: "Sales teams using our full engagement platform consistently book 4x more meetings per rep compared to manual outreach. The combination of AI personalization, multi-channel orchestration, and intelligent follow-up automation ensures that every prospect interaction is optimized for conversion.", industries: "SaaS, E-commerce, HealthTech", outcomes: "4x meetings per rep, automated follow-up, channel optimization" },
    { docIdx: 5, type: "Outcome", title: "Multi-Region Data Residency", content: "With data residency options in the US, EU, and Asia-Pacific, enterprise customers can ensure their data never leaves their required jurisdiction. This capability is essential for companies subject to GDPR, data localization laws, or industry-specific data handling requirements.", industries: "FinTech, HealthTech, Government", outcomes: "US/EU/APAC residency, GDPR compliance, data localization" },
    { docIdx: 0, type: "Capability", title: "Competitive Intelligence Monitoring", content: "Track competitor movements including pricing changes, product launches, hiring patterns, customer wins, and market positioning shifts. Our AI analyzes these signals to provide actionable competitive insights that help sales teams differentiate and win against specific competitors.", industries: "SaaS, FinTech, Cybersecurity, AI/ML", outcomes: "Competitor tracking, differentiation insights, win strategies" },
    { docIdx: 1, type: "Service", title: "Pipeline Health Monitoring", content: "Real-time dashboards monitor pipeline health across all stages with alerts for at-risk deals, stagnant opportunities, and coverage gaps. Sales leaders can drill down by team, rep, or territory to identify coaching opportunities and resource allocation needs.", industries: "All Industries", outcomes: "Real-time monitoring, at-risk alerts, coaching insights" },
    { docIdx: 2, type: "Service", title: "Custom Data Enrichment Pipelines", content: "Enterprise customers can define custom enrichment schemas that incorporate proprietary data sources and company-specific attributes. Our data engineering team designs and maintains these pipelines to align with unique business requirements.", industries: "Manufacturing, Logistics, PropTech", outcomes: "Custom schemas, proprietary data, dedicated engineering" },
    { docIdx: 3, type: "Capability", title: "Market Trend Analysis", content: "Our AI analyzes macro-level patterns across millions of data points to identify emerging market trends, shifting buyer preferences, and new competitive threats. These insights help sales and marketing teams allocate resources proactively rather than reactively.", industries: "SaaS, AI/ML, FinTech", outcomes: "Trend identification, proactive allocation, market positioning" },
    { docIdx: 4, type: "Capability", title: "Smart Meeting Scheduling", content: "When a prospect expresses interest, our platform automatically proposes meeting times based on calendar availability, sends confirmation emails, and creates CRM events. This frictionless booking process converts 35% more replies into scheduled meetings.", industries: "All Industries", outcomes: "Auto-booking, calendar sync, 35% more conversions" },
    { docIdx: 5, type: "Capability", title: "Comprehensive Audit Trail", content: "Every data access, configuration change, and administrative action is logged in an immutable audit trail. Customers can query the audit log by user, action type, and time range to support compliance reporting and security investigations.", industries: "FinTech, HealthTech, Government", outcomes: "Immutable logging, compliance support, security investigation" },
    { docIdx: 0, type: "Service", title: "Funding & Growth Event Tracking", content: "Monitor funding rounds, M&A activity, IPO filings, and growth milestones for your target accounts. These events often signal budget availability and organizational change, creating ideal timing windows for sales outreach.", industries: "SaaS, AI/ML, FinTech, HealthTech", outcomes: "Funding alerts, M&A tracking, timing optimization" },
    { docIdx: 1, type: "Case Study", title: "Manufacturing Company Optimizes 500-Account Territory", content: "A manufacturing company with a 500-account territory used our predictive scoring to re-prioritize their entire target list. Reps focused on the top 100 accounts by score, resulting in a 55% increase in pipeline value from the same territory with no additional headcount.", industries: "Manufacturing, Industrial", outcomes: "55% more pipeline, optimized territory, no headcount change" },
    { docIdx: 4, type: "Case Study", title: "EdTech Company Achieves 70% Open Rate", content: "An EdTech company used our AI personalization to revamp their outbound email sequences. The AI-generated subject lines and body content achieved a 70% open rate and 12% reply rate — more than double their previous benchmarks. The key was industry-specific language and timely references to education policy changes.", industries: "EdTech, Education", outcomes: "70% open rate, 12% reply rate, 2x benchmark improvement" },
    { docIdx: 2, type: "Case Study", title: "Logistics Company Unifies 3 CRM Instances", content: "A global logistics company had fragmented customer data across three regional Salesforce instances. Our integration platform unified the data into a single view while respecting regional data governance requirements, enabling their global sales team to collaborate on enterprise accounts effectively.", industries: "Logistics, Supply Chain", outcomes: "Unified CRM view, regional compliance, global collaboration" },
  ];

  let snippetCount = 0;
  for (const s of snippetData) {
    const doc = docRecords[s.docIdx];
    if (!doc) continue;
    await db.capabilitySnippet.create({
      data: {
        documentId: doc.id,
        snippetType: s.type,
        title: s.title,
        content: s.content,
        industries: s.industries,
        outcomes: s.outcomes,
        createdAt: daysAgo(Math.floor(Math.random() * 60)),
      },
    });
    snippetCount++;
  }
  console.log(`✅ ${snippetCount} capability snippets created.\n`);

  // ── 9. Company Notes & Contact Notes ───────────────────────────────────────
  console.log("📝 Creating company and contact notes...");

  const companyNoteTemplates = [
    { body: "Met with the VP of Sales at SaaStr Annual. Very interested in our lead scoring capabilities. Wants a demo scheduled for next week. Budget is allocated for Q2.", noteType: "meeting_note" },
    { body: "Company just announced Series C funding of $50M. This is a strong buying signal — they'll likely invest in scaling their sales operations. Priority account.", noteType: "signal" },
    { body: "Their current CRM integration is causing data quality issues. The sales ops team is actively looking for alternatives. Good timing for our data enrichment pitch.", noteType: "insight" },
    { body: "Competitor XYZ just signed a deal with this company's main rival. This creates urgency for them to evaluate alternatives. Leverage this in outreach.", noteType: "competitive" },
    { body: "LinkedIn activity shows they're hiring 5 new enterprise AEs. This confirms their sales expansion plans. Reach out to the newly hired reps for potential champion relationships.", noteType: "signal" },
    { body: "Attended their product webinar. Strong technical product but go-to-market motion needs work. Our sales intelligence platform could fill their pipeline generation gap.", noteType: "research" },
    { body: "Spoke with their marketing director at a conference. They're frustrated with current lead quality from their content marketing efforts. Our intent data could help.", noteType: "meeting_note" },
    { body: "Company posted about digital transformation initiative on their blog. They're investing heavily in modernizing their tech stack. Good opportunity for our CRM integration services.", noteType: "insight" },
    { body: "Referred by existing customer. Warm introduction available through their CTO who knows our founder from a previous company.", noteType: "referral" },
    { body: "Their customer churn rate appears elevated based on public reviews. May indicate internal challenges but also openness to new solutions that improve retention.", noteType: "insight" },
  ];

  let companyNoteCount = 0;
  for (const [companyId] of companyRecords) {
    const numNotes = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numNotes; i++) {
      const template = companyNoteTemplates[Math.floor(Math.random() * companyNoteTemplates.length)];
      await db.companyNote.create({
        data: {
          companyId,
          body: template.body,
          noteType: template.noteType,
          createdAt: daysAgo(Math.floor(Math.random() * 30)),
        },
      });
      companyNoteCount++;
    }
  }
  console.log(`  ✅ ${companyNoteCount} company notes created.`);

  const contactNoteTemplates = [
    { body: "Very responsive to outreach. Expressed genuine interest in our platform during initial call. Followed up with detailed questions about pricing and implementation timeline.", noteType: "call_note" },
    { body: "Key decision-maker for sales technology purchases. Reports directly to the CEO. Has 15+ years in enterprise sales leadership. Prefers concise, data-driven communications.", noteType: "profile" },
    { body: "Champion within the organization. Actively advocating for our solution internally. Needs ROI justification materials to present to the CRO.", noteType: "relationship" },
    { body: "Skeptical of AI-powered tools based on previous bad experience with a competitor. Need to provide concrete case studies and a free trial to build trust.", noteType: "objection" },
    { body: "Recently promoted to VP of Sales. Likely looking to make an impact with new tools and processes. Good window for introduction.", noteType: "signal" },
    { body: "Connected on LinkedIn. Regularly engages with sales technology content. Posted about challenges with data quality in outbound prospecting.", noteType: "social" },
    { body: "Met at industry conference. Mentioned their team is struggling with long sales cycles and poor forecast accuracy. Our platform addresses both pain points.", noteType: "meeting_note" },
    { body: "Technical evaluator for the project. Will need detailed API documentation and security whitepapers. Schedule a technical deep-dive.", noteType: "technical" },
    { body: "Previously worked at a company that was our customer. Familiar with our brand and has positive associations. Leverage this relationship.", noteType: "relationship" },
    { body: "Very busy — prefers email over calls. Keep messages concise and focused on value proposition. Best contact times are Tuesday and Thursday mornings.", noteType: "preference" },
  ];

  let contactNoteCount = 0;
  const allContactEntries = Array.from(contactMap.entries()).flat();
  const contactIdList: string[] = [];
  for (const ids of contactMap.values()) {
    contactIdList.push(...ids);
  }

  for (let i = 0; i < 25; i++) {
    const contactId = contactIdList[i % contactIdList.length];
    const template = contactNoteTemplates[Math.floor(Math.random() * contactNoteTemplates.length)];
    await db.contactNote.create({
      data: {
        contactId,
        body: template.body,
        noteType: template.noteType,
        createdAt: daysAgo(Math.floor(Math.random() * 30)),
      },
    });
    contactNoteCount++;
  }
  console.log(`  ✅ ${contactNoteCount} contact notes created.\n`);

  // ── 10. Timeline Entries ───────────────────────────────────────────────────
  console.log("📅 Creating 110 timeline entries...");
  const timelineActions = [
    { action: "company_created", details: "Company added to CRM from import batch" },
    { action: "contact_created", details: "Contact discovered and added to database" },
    { action: "email_validated", details: "Email address validated successfully" },
    { action: "email_validation_failed", details: "Email validation returned risky/invalid result" },
    { action: "research_generated", details: "AI-generated research card created for company" },
    { action: "opportunity_created", details: "New sales opportunity identified and logged" },
    { action: "outreach_sent", details: "Personalized outreach email sent to contact" },
    { action: "meeting_scheduled", details: "Discovery call scheduled with prospect" },
    { action: "meeting_completed", details: "Initial discovery call completed successfully" },
    { action: "proposal_sent", details: "Custom proposal and pricing sent to prospect" },
    { action: "status_changed", details: "Opportunity status updated" },
    { action: "note_added", details: "New note added to company record" },
    { action: "contact_archived", details: "Contact archived due to bounced email or invalid data" },
    { action: "data_enriched", details: "Company data enriched with latest firmographic information" },
    { action: "intent_detected", details: "Buyer intent signal detected for company" },
    { action: "score_updated", details: "Intelligence score recalculated based on new signals" },
    { action: "draft_generated", details: "AI-generated outreach draft created for contact" },
    { action: "health_check_completed", details: "Email health check completed with updated status" },
    { action: "pipeline_updated", details: "Sales pipeline coverage updated after new opportunity added" },
    { action: "competitor_detected", details: "Competitor engagement detected with target account" },
  ];

  let timelineCount = 0;
  for (let i = 0; i < 110; i++) {
    const companyId = companyIds[Math.floor(Math.random() * companyIds.length)];
    const contactIds = contactMap.get(companyId) || [];
    const contactId = contactIds.length > 0 && Math.random() > 0.3
      ? pick(contactIds)
      : null;

    const actionItem = timelineActions[Math.floor(Math.random() * timelineActions.length)];

    await db.timelineEntry.create({
      data: {
        companyId: Math.random() > 0.1 ? companyId : null,
        contactId,
        action: actionItem.action,
        details: actionItem.details,
        createdAt: daysAgo(Math.floor(Math.random() * 30)),
      },
    });
    timelineCount++;
  }
  console.log(`✅ ${timelineCount} timeline entries created.\n`);

  // ── 11. Drafts ────────────────────────────────────────────────────────────
  console.log("✉️  Creating 18 drafts...");
  const draftData = [
    { subject: "Reducing your sales research time by 60%", body: "Hi {first_name},\n\nI noticed that {company} is growing rapidly and your sales team is likely spending significant time on prospect research. We've helped similar SaaS companies reduce research time by 60% using AI-powered company intelligence.\n\nWould a quick 15-minute demo be worth exploring?\n\nBest, Ravi", cta: "Schedule a 15-minute demo", serviceAngle: "AI-Powered Sales Intelligence", matchScore: 88, confidenceScore: 82 },
    { subject: "Predictive lead scoring for {company}", body: "Hi {first_name},\n\nYour team at {company} is doing impressive work in the {industry} space. I wanted to share how our predictive lead scoring has helped companies like yours achieve 45% higher win rates by focusing on the right prospects.\n\nWould love to share a brief case study if you're interested.\n\nBest, Ravi", cta: "Share a relevant case study", serviceAngle: "Predictive Lead Scoring", matchScore: 85, confidenceScore: 79 },
    { subject: "CRM data quality at {company}", body: "Hi {first_name},\n\nI came across {company} while researching companies in the {industry} space. Many teams we work with struggle with CRM data quality — our data enrichment service has helped maintain 95%+ email deliverability for sales teams.\n\nCurious if this is a challenge you're facing?\n\nBest, Ravi", cta: "Quick question about data quality", serviceAngle: "Data Enrichment Services", matchScore: 78, confidenceScore: 72 },
    { subject: "Buyer intent signals for {industry} companies", body: "Hi {first_name},\n\nWe've been tracking buyer intent signals in the {industry} space and noticed some interesting patterns that might be relevant to {company}. Our platform identifies accounts actively researching solutions like yours.\n\nWould it be useful to see which of your target accounts are showing buying intent?\n\nBest, Ravi", cta: "See intent data for your targets", serviceAngle: "Buyer Intent Data", matchScore: 92, confidenceScore: 85 },
    { subject: "Scaling outbound at {company}", body: "Hi {first_name},\n\nWith {company}'s recent growth, I imagine scaling outbound effectively is a top priority. Our AI-powered engagement platform has helped teams scale from 5 to 25 reps while maintaining personalized messaging quality.\n\nWould love to show you how this works in practice.\n\nBest, Ravi", cta: "See how AI scales personalized outreach", serviceAngle: "Sales Engagement Automation", matchScore: 81, confidenceScore: 76 },
    { subject: "Sales forecasting accuracy at {company}", body: "Hi {first_name},\n\nI've been following {company}'s growth and was curious about how you handle revenue forecasting. Our AI-powered forecasting has achieved 85%+ accuracy for enterprise sales teams by analyzing deal patterns and market signals.\n\nHappy to share a walkthrough if useful.\n\nBest, Ravi", cta: "Share forecasting walkthrough", serviceAngle: "Predictive Pipeline Analytics", matchScore: 74, confidenceScore: 68 },
    { subject: "Enterprise security for your sales intelligence", body: "Hi {first_name},\n\nGiven {company}'s focus on security in the {industry} space, I thought you'd appreciate knowing that our platform is SOC 2 Type II certified with GDPR compliance and multi-region data residency.\n\nIf security review is a concern, we can fast-track the process.\n\nBest, Ravi", cta: "Fast-track security review", serviceAngle: "Enterprise Security", matchScore: 89, confidenceScore: 84 },
    { subject: "Competitive intelligence for {company}", body: "Hi {first_name},\n\nStaying ahead of the competition is critical in {industry}. Our competitive intelligence module tracks competitor movements, pricing changes, and customer wins in real-time.\n\nWould a competitive landscape report for your market be valuable?\n\nBest, Ravi", cta: "Get a competitive landscape report", serviceAngle: "Competitive Intelligence", matchScore: 83, confidenceScore: 77 },
    { subject: "Automating prospect research at {company}", body: "Hi {first_name},\n\nYour sales team at {company} is likely spending hours researching prospects before each outreach. Our platform automates this with AI-generated company profiles, tech stack analysis, and buying signals.\n\nReps typically save 27 minutes per prospect. Worth a conversation?\n\nBest, Ravi", cta: "Calculate time savings for your team", serviceAngle: "AI Sales Intelligence", matchScore: 86, confidenceScore: 80 },
    { subject: "Multi-channel outreach for {company}", body: "Hi {first_name},\n\nMost B2B sales teams rely primarily on email, but the highest engagement comes from coordinated multi-channel sequences. Our platform orchestrates outreach across email, LinkedIn, and phone with AI-optimized timing.\n\nTeams using multi-channel see 3x higher engagement. Interested in learning more?\n\nBest, Ravi", cta: "Explore multi-channel sequences", serviceAngle: "Sales Engagement", matchScore: 79, confidenceScore: 73 },
    { subject: "Account prioritization for your territory", body: "Hi {first_name},\n\nManaging a large territory efficiently requires data-driven prioritization. Our AI analyzes 50+ signals to rank every account in your territory by conversion probability.\n\nOne customer reprioritized a 500-account territory and saw a 55% pipeline increase.\n\nBest, Ravi", cta: "See territory optimization demo", serviceAngle: "Account Prioritization", matchScore: 82, confidenceScore: 75 },
    { subject: "Data-driven outreach for {company}'s expansion", body: "Hi {first_name},\n\nCongratulations on {company}'s recent expansion into new markets. As you scale, maintaining outreach quality at higher volumes becomes challenging.\n\nOur AI personalization engine has helped growing teams maintain 70%+ open rates even at scale. Happy to share how.\n\nBest, Ravi", cta: "Share personalization strategy", serviceAngle: "AI Personalization", matchScore: 90, confidenceScore: 83 },
    { subject: "Improving pipeline coverage at {company}", body: "Hi {first_name},\n\nHealthy pipeline coverage is the foundation of predictable revenue. Our analytics dashboard provides real-time visibility into pipeline health, coverage ratios, and at-risk deals.\n\nWould a pipeline health assessment for your team be useful?\n\nBest, Ravi", cta: "Free pipeline health assessment", serviceAngle: "Pipeline Analytics", matchScore: 77, confidenceScore: 71 },
    { subject: "Sales coaching insights for {company}", body: "Hi {first_name},\n\nOur platform analyzes sales conversations to surface coaching insights — what top performers do differently, common objection patterns, and optimal talk-to-listen ratios.\n\nTeams using our coaching features see 25% faster rep ramp times. Curious?\n\nBest, Ravi", cta: "See coaching insights in action", serviceAngle: "Sales Coaching AI", matchScore: 75, confidenceScore: 69 },
    { subject: "Intent data for {company}'s target market", body: "Hi {first_name},\n\nWe're tracking strong buyer intent signals in the {industry} space right now. Several accounts matching {company}'s ideal customer profile are actively researching solutions.\n\nWant to see the list?\n\nBest, Ravi", cta: "View high-intent accounts", serviceAngle: "Buyer Intent Data", matchScore: 91, confidenceScore: 86 },
    { subject: "Streamlining {company}'s sales operations", body: "Hi {first_name},\n\nAs {company} grows, sales operations complexity increases exponentially. Our platform unifies CRM data, enrichment, scoring, and engagement in one workflow — eliminating tool sprawl and data silos.\n\nOne customer reduced their sales tech stack from 8 tools to 3.\n\nBest, Ravi", cta: "See platform consolidation benefits", serviceAngle: "Sales Intelligence Platform", matchScore: 84, confidenceScore: 78 },
    { subject: "Warm intro from {company}'s industry peer", body: "Hi {first_name},\n\nA sales leader at a company similar to {company} mentioned that your team might benefit from AI-powered prospecting. They've seen strong results with our platform and thought it would be a good fit.\n\nHappy to share their story if interested.\n\nBest, Ravi", cta: "Hear peer success story", serviceAngle: "AI-Powered Prospecting", matchScore: 87, confidenceScore: 81 },
    { subject: "Q2 pipeline planning for {company}", body: "Hi {first_name},\n\nWith Q2 planning underway, I wanted to share how our customers use our platform for pipeline planning. Our predictive models help identify which existing pipeline deals will close and where to find net-new opportunities.\n\nWould a Q2 planning workshop be valuable?\n\nBest, Ravi", cta: "Schedule Q2 planning workshop", serviceAngle: "Revenue Intelligence", matchScore: 80, confidenceScore: 74 },
  ];

  let draftCount = 0;
  for (let i = 0; i < draftData.length; i++) {
    const contactId = contactIdList[i % contactIdList.length];
    const d = draftData[i];
    const status = pick(["draft", "draft", "draft", "approved", "sent", "rejected"]);
    await db.draft.create({
      data: {
        contactId,
        subject: d.subject,
        body: d.body,
        cta: d.cta,
        serviceAngle: d.serviceAngle,
        matchScore: d.matchScore,
        confidenceScore: d.confidenceScore,
        status,
        rejectReason: status === "rejected" ? "Tone too aggressive for this prospect's communication style" : null,
        createdAt: daysAgo(Math.floor(Math.random() * 14)),
      },
    });
    draftCount++;
  }
  console.log(`✅ ${draftCount} drafts created.\n`);

  // ── 12. Email Health Checks ───────────────────────────────────────────────
  console.log("🔍 Creating 35 email health checks...");
  const healthCheckStatuses = ["valid", "risky", "invalid", "unknown"];
  const healthRecommendations = [
    "Email is valid and deliverable. Safe to include in outreach campaigns.",
    "Email syntax is correct but domain has some risk indicators. Consider verifying with a test send.",
    "Email domain is valid but the specific mailbox could not be verified. Use with caution.",
    "Email appears to be a catch-all or generic address. Direct outreach to a personal email is recommended.",
    "Email domain is configured correctly but the mailbox may be inactive. Try an alternative contact.",
    "Email is from a disposable email provider. Do not use for professional outreach.",
    "Email validation inconclusive. The mail server did not respond to verification requests.",
    "Email syntax is invalid. Remove from outreach lists.",
    "Email domain does not accept mail. Remove from active campaigns.",
    "Email is valid but has been flagged for previous bounces. Monitor deliverability closely.",
  ];

  let healthCheckCount = 0;
  for (let i = 0; i < 35; i++) {
    const contactId = contactIdList[i % contactIdList.length];
    const status = pick(healthCheckStatuses);
    const score = status === "valid" ? 80 + Math.floor(Math.random() * 21) :
                  status === "risky" ? 40 + Math.floor(Math.random() * 40) :
                  status === "invalid" ? Math.floor(Math.random() * 30) :
                  50;

    const syntaxOk = status !== "invalid";
    const domainOk = status !== "invalid";
    const mxOk = status === "valid" || status === "risky";
    const disposableOk = status !== "invalid";

    await db.emailHealthCheck.create({
      data: {
        contactId,
        status,
        score,
        actionRecommendation: healthRecommendations[Math.floor(Math.random() * healthRecommendations.length)],
        syntaxOk,
        domainOk,
        mxOk,
        disposableOk,
        checkedAt: daysAgo(Math.floor(Math.random() * 30)),
      },
    });
    healthCheckCount++;
  }
  console.log(`✅ ${healthCheckCount} email health checks created.\n`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════");
  console.log("  🎉 DeepMindQ Seed Data Complete!");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  🏢  Companies:              ${createdCompanies.length}`);
  console.log(`  👤  Contacts:               ${totalContacts}`);
  console.log(`  💰  Opportunities:          ${opportunityCount}`);
  console.log(`  📋  Research Cards:         ${researchCount}`);
  console.log(`  📄  Capability Documents:   ${docRecords.length}`);
  console.log(`  📌  Capability Snippets:    ${snippetCount}`);
  console.log(`  📝  Company Notes:          ${companyNoteCount}`);
  console.log(`  📝  Contact Notes:          ${contactNoteCount}`);
  console.log(`  📅  Timeline Entries:       ${timelineCount}`);
  console.log(`  ✉️   Drafts:                 ${draftCount}`);
  console.log(`  🔍  Email Health Checks:    ${healthCheckCount}`);
  console.log("═══════════════════════════════════════════════════\n");

  await db.$disconnect();
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});