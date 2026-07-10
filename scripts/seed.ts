import { db } from '../src/lib/db';

// ─── Helper Data ────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'James','Sarah','Michael','Emily','David','Jessica','Robert','Ashley','William','Amanda',
  'Daniel','Samantha','Joseph','Lauren','Andrew','Stephanie','Thomas','Jennifer','John','Nicole',
  'Christopher','Rachel','Richard','Megan','Matthew','Elizabeth','Anthony','Kimberly','Mark','Christina',
  'Steven','Heather','Kevin','Angela','Brian','Melissa','Charles','Diana','Timothy','Rebecca',
  'Patrick','Maria','Peter','Catherine','Rajesh','Priya','Wei','Mei','Hans','Anika',
  'Yuki','Kenji','Carlos','Ana','Omar','Fatima','Liam','Olivia','Noah','Emma',
  'Arjun','Deepa','Hiroshi','Sakura','Lars','Greta','Sanjay','Neha','Takeshi','Yui',
  'Ahmed','Layla','Dieter','Ingrid','Ravi','Sunita','Taro','Aiko','Felipe','Isabela',
];

const LAST_NAMES = [
  'Anderson','Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez',
  'Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson',
  'Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis',
  'Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill',
  'Patel','Sharma','Kumar','Singh','Müller','Schmidt','Weber','Fischer','Meyer','Schneider',
  'Tanaka','Suzuki','Watanabe','Ito','Yamamoto','Kim','Park','Chen','Wang','Liu',
  'Al-Rashid','Al-Maktoum','Hassan','Ali','Santos','Silva','Oliveira','Costa','Fernandes','Larsson',
];

const JOB_TITLES = [
  'CTO','VP Engineering','Head of Sales','Director of Marketing','CEO','COO','CFO','CIO',
  'VP Product','Head of Operations','Director of IT','VP Strategy','Head of Digital',
  'Chief Data Officer','VP Business Development','Director of Innovation','Head of R&D',
  'Chief Information Security Officer','VP Customer Success','Director of Partnerships',
  'Head of Analytics','Director of Engineering','VP Operations','Chief Digital Officer',
  'Head of Procurement','Director of Supply Chain','VP Technology','Head of AI/ML',
  'Director of Data Science','Chief Revenue Officer','VP Customer Experience',
  'Head of Infrastructure','Director of Cloud Services','Chief Growth Officer',
  'VP of Corporate Development','Head of Enterprise Sales','Director of Product Management',
  'SVP Engineering','Head of Quality','Director of Program Management','VP of Strategy & Ops',
];

const ROLE_BUCKETS = ['decision_maker','influencer','end_user','blocker','champion'] as const;
const EMAIL_HEALTHS = ['valid','risky','invalid','unknown'] as const;
const NOTE_TYPES = ['call','meeting','research','general'] as const;
const COMPANIES_STATUSES = ['new','researching','ready','contacted','qualified','archived'] as const;
const OPP_STATUSES = ['researching','contacted','proposed','negotiation','won','lost'] as const;
const TIMELINE_ACTIONS = [
  'company_created','contact_added','research_updated','email_validated',
  'opportunity_created','opportunity_updated','status_changed','note_added',
  'import_completed','health_check_run',
] as const;

function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN<T>(arr: readonly T[], n: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}
function daysAgo(d: number) { return new Date(Date.now() - d * 24 * 60 * 60 * 1000); }
function hoursAgo(h: number) { return new Date(Date.now() - h * 60 * 60 * 1000); }

// ─── Seed Data ──────────────────────────────────────────────────────────────

const companies = [
  // comp-1 through comp-10: retain original IDs
  { id:'comp-1', name:'ABC Manufacturing', domain:'abc.com', industry:'Manufacturing', country:'USA', employeeSize:'5001-10000', location:'Detroit, MI', website:'https://abc.com', linkedinUrl:'https://linkedin.com/company/abc-mfg', status:'researching', intelligenceScore:85, dataFreshness:'fresh' },
  { id:'comp-2', name:'TechVision Solutions', domain:'techvision.io', industry:'Technology', country:'India', employeeSize:'201-500', location:'Bangalore, India', website:'https://techvision.io', linkedinUrl:'https://linkedin.com/company/techvision', status:'ready', intelligenceScore:72, dataFreshness:'fresh' },
  { id:'comp-3', name:'Global Finance Corp', domain:'gfc.com', industry:'Finance', country:'UK', employeeSize:'10000+', location:'London, UK', website:'https://gfc.com', status:'new', intelligenceScore:68, dataFreshness:'stale' },
  { id:'comp-4', name:'HealthPlus Networks', domain:'healthplus.com', industry:'Healthcare', country:'USA', employeeSize:'501-1000', location:'Boston, MA', website:'https://healthplus.com', linkedinUrl:'https://linkedin.com/company/healthplus', status:'contacted', intelligenceScore:91, dataFreshness:'fresh' },
  { id:'comp-5', name:'EduLearn Platform', domain:'edulearn.com', industry:'Education', country:'Singapore', employeeSize:'51-200', location:'Singapore', website:'https://edulearn.com', status:'researching', intelligenceScore:55, dataFreshness:'old' },
  { id:'comp-6', name:'RetailMax Group', domain:'retailmax.com', industry:'Retail', country:'UAE', employeeSize:'1001-5000', location:'Dubai, UAE', website:'https://retailmax.com', linkedinUrl:'https://linkedin.com/company/retailmax', status:'new', intelligenceScore:78, dataFreshness:'fresh' },
  { id:'comp-7', name:'GreenEnergy Solutions', domain:'greenenergy.com', industry:'Energy', country:'Germany', employeeSize:'1001-5000', location:'Munich, Germany', website:'https://greenenergy.com', linkedinUrl:'https://linkedin.com/company/greenenergy', status:'contacted', intelligenceScore:82, dataFreshness:'fresh' },
  { id:'comp-8', name:'LegalEdge Partners', domain:'legaledge.com', industry:'Legal', country:'USA', employeeSize:'201-500', location:'Chicago, IL', website:'https://legaledge.com', status:'new', intelligenceScore:64, dataFreshness:'stale' },
  { id:'comp-9', name:'PharmaCore Labs', domain:'pharmacore.com', industry:'Pharma', country:'Switzerland', employeeSize:'5001-10000', location:'Basel, Switzerland', website:'https://pharmacore.com', linkedinUrl:'https://linkedin.com/company/pharmacore', status:'qualified', intelligenceScore:93, dataFreshness:'fresh' },
  { id:'comp-10', name:'CyberShield Security', domain:'cybershield.io', industry:'Technology', country:'USA', employeeSize:'201-500', location:'Austin, TX', website:'https://cybershield.io', linkedinUrl:'https://linkedin.com/company/cybershield', status:'ready', intelligenceScore:76, dataFreshness:'fresh' },

  // comp-11 through comp-50: new companies
  { id:'comp-11', name:'NovaTech Industries', domain:'novatech.com', industry:'Aerospace', country:'USA', employeeSize:'5001-10000', location:'Seattle, WA', website:'https://novatech.com', linkedinUrl:'https://linkedin.com/company/novatech-ind', status:'researching', intelligenceScore:88, dataFreshness:'fresh' },
  { id:'comp-12', name:'Apex Logistics', domain:'apexlogistics.com', industry:'Logistics', country:'Canada', employeeSize:'1001-5000', location:'Toronto, Canada', website:'https://apexlogistics.com', linkedinUrl:'https://linkedin.com/company/apex-logistics', status:'new', intelligenceScore:71, dataFreshness:'fresh' },
  { id:'comp-13', name:'SkyRocket Media', domain:'skyrocketmedia.com', industry:'Media', country:'UK', employeeSize:'51-200', location:'Manchester, UK', website:'https://skyrocketmedia.com', status:'researching', intelligenceScore:62, dataFreshness:'stale' },
  { id:'comp-14', name:'QuantumLeap Consulting', domain:'quantumleap.co', industry:'Consulting', country:'Australia', employeeSize:'201-500', location:'Sydney, Australia', website:'https://quantumleap.co', linkedinUrl:'https://linkedin.com/company/quantumleap', status:'ready', intelligenceScore:74, dataFreshness:'fresh' },
  { id:'comp-15', name:'FreshHarvest Agri', domain:'freshharvest.com', industry:'Agriculture', country:'Brazil', employeeSize:'1001-5000', location:'São Paulo, Brazil', website:'https://freshharvest.com', linkedinUrl:'https://linkedin.com/company/freshharvest', status:'new', intelligenceScore:58, dataFreshness:'stale' },
  { id:'comp-16', name:'UrbanNest Realty', domain:'urbannest.com', industry:'Real Estate', country:'UAE', employeeSize:'201-500', location:'Abu Dhabi, UAE', website:'https://urbannest.com', status:'new', intelligenceScore:65, dataFreshness:'fresh' },
  { id:'comp-17', name:'BioGenetics Lab', domain:'biogeneticslab.com', industry:'Pharma', country:'Japan', employeeSize:'1001-5000', location:'Tokyo, Japan', website:'https://biogeneticslab.com', linkedinUrl:'https://linkedin.com/company/biogeneticslab', status:'qualified', intelligenceScore:90, dataFreshness:'fresh' },
  { id:'comp-18', name:'DataStream Analytics', domain:'datastream.io', industry:'Technology', country:'USA', employeeSize:'51-200', location:'San Francisco, CA', website:'https://datastream.io', linkedinUrl:'https://linkedin.com/company/datastream', status:'contacted', intelligenceScore:83, dataFreshness:'fresh' },
  { id:'comp-19', name:'Pinnacle Healthcare', domain:'pinnaclehealth.com', industry:'Healthcare', country:'India', employeeSize:'5001-10000', location:'Mumbai, India', website:'https://pinnaclehealth.com', linkedinUrl:'https://linkedin.com/company/pinnaclehealth', status:'researching', intelligenceScore:77, dataFreshness:'stale' },
  { id:'comp-20', name:'DataVault Systems', domain:'datavault.io', industry:'Technology', country:'USA', employeeSize:'51-200', location:'Denver, CO', website:'https://datavault.io', linkedinUrl:'https://linkedin.com/company/datavault', status:'ready', intelligenceScore:80, dataFreshness:'fresh' },
  { id:'comp-21', name:'Pacific Rim Manufacturing', domain:'pacificrim.co.jp', industry:'Manufacturing', country:'Japan', employeeSize:'10000+', location:'Osaka, Japan', website:'https://pacificrim.co.jp', linkedinUrl:'https://linkedin.com/company/pacificrim', status:'contacted', intelligenceScore:86, dataFreshness:'fresh' },
  { id:'comp-22', name:'Nordic Finance Group', domain:'nordicfinance.se', industry:'Finance', country:'Germany', employeeSize:'1001-5000', location:'Frankfurt, Germany', website:'https://nordicfinance.se', linkedinUrl:'https://linkedin.com/company/nordicfinance', status:'new', intelligenceScore:70, dataFreshness:'old' },
  { id:'comp-23', name:'InsureTech Global', domain:'insuretechglobal.com', industry:'Finance', country:'UK', employeeSize:'201-500', location:'Edinburgh, UK', website:'https://insuretechglobal.com', linkedinUrl:'https://linkedin.com/company/insuretechglobal', status:'contacted', intelligenceScore:84, dataFreshness:'fresh' },
  { id:'comp-24', name:'CloudNine SaaS', domain:'cloudnine.io', industry:'Technology', country:'Singapore', employeeSize:'201-500', location:'Singapore', website:'https://cloudnine.io', linkedinUrl:'https://linkedin.com/company/cloudnine', status:'ready', intelligenceScore:75, dataFreshness:'fresh' },
  { id:'comp-25', name:'MegaMart Retail', domain:'megamart.com', industry:'Retail', country:'India', employeeSize:'10000+', location:'New Delhi, India', website:'https://megamart.com', linkedinUrl:'https://linkedin.com/company/megamart', status:'new', intelligenceScore:66, dataFreshness:'stale' },
  { id:'comp-26', name:'BrightPath Education', domain:'brightpath.edu', industry:'Education', country:'Canada', employeeSize:'501-1000', location:'Vancouver, Canada', website:'https://brightpath.edu', linkedinUrl:'https://linkedin.com/company/brightpath', status:'researching', intelligenceScore:60, dataFreshness:'old' },
  { id:'comp-27', name:'Atlas Freight', domain:'atlasfreight.com', industry:'Logistics', country:'USA', employeeSize:'5001-10000', location:'Houston, TX', website:'https://atlasfreight.com', linkedinUrl:'https://linkedin.com/company/atlasfreight', status:'new', intelligenceScore:73, dataFreshness:'fresh' },
  { id:'comp-28', name:'Solaris Energy Corp', domain:'solarenergy.com', industry:'Energy', country:'Australia', employeeSize:'201-500', location:'Brisbane, Australia', website:'https://solarenergy.com', linkedinUrl:'https://linkedin.com/company/solarisenergy', status:'researching', intelligenceScore:69, dataFreshness:'stale' },
  { id:'comp-29', name:'Veritas Law Associates', domain:'veritaslaw.com', industry:'Legal', country:'UK', employeeSize:'201-500', location:'Birmingham, UK', website:'https://veritaslaw.com', status:'new', intelligenceScore:56, dataFreshness:'old' },
  { id:'comp-30', name:'TerraForm Construction', domain:'terraform.co', industry:'Real Estate', country:'UAE', employeeSize:'1001-5000', location:'Dubai, UAE', website:'https://terraform.co', linkedinUrl:'https://linkedin.com/company/terraform-construction', status:'contacted', intelligenceScore:79, dataFreshness:'fresh' },
  { id:'comp-31', name:'AgriTech Solutions', domain:'agritech.io', industry:'Agriculture', country:'India', employeeSize:'51-200', location:'Hyderabad, India', website:'https://agritech.io', linkedinUrl:'https://linkedin.com/company/agritech', status:'ready', intelligenceScore:67, dataFreshness:'fresh' },
  { id:'comp-32', name:'Starlight Studios', domain:'starlightstudios.com', industry:'Media', country:'USA', employeeSize:'201-500', location:'Los Angeles, CA', website:'https://starlightstudios.com', linkedinUrl:'https://linkedin.com/company/starlightstudios', status:'new', intelligenceScore:63, dataFreshness:'stale' },
  { id:'comp-33', name:'BluePeak Consulting', domain:'bluepeak.co', industry:'Consulting', country:'USA', employeeSize:'501-1000', location:'New York, NY', website:'https://bluepeak.co', linkedinUrl:'https://linkedin.com/company/bluepeak', status:'contacted', intelligenceScore:81, dataFreshness:'fresh' },
  { id:'comp-34', name:'PetroChem Global', domain:'petrochem.com', industry:'Energy', country:'Saudi Arabia', employeeSize:'10000+', location:'Riyadh, Saudi Arabia', website:'https://petrochem.com', linkedinUrl:'https://linkedin.com/company/petrochem', status:'new', intelligenceScore:87, dataFreshness:'fresh' },
  { id:'comp-35', name:'MediCare Plus', domain:'medicareplus.com', industry:'Healthcare', country:'Germany', employeeSize:'1001-5000', location:'Berlin, Germany', website:'https://medicareplus.com', linkedinUrl:'https://linkedin.com/company/medicareplus', status:'researching', intelligenceScore:74, dataFreshness:'stale' },
  { id:'comp-36', name:'AeroSpace Dynamics', domain:'aerodynamics.com', industry:'Aerospace', country:'UK', employeeSize:'1001-5000', location:'Bristol, UK', website:'https://aerodynamics.com', linkedinUrl:'https://linkedin.com/company/aerodynamics', status:'researching', intelligenceScore:89, dataFreshness:'fresh' },
  { id:'comp-37', name:'SwiftShip Logistics', domain:'swiftship.com', industry:'Logistics', country:'Singapore', employeeSize:'201-500', location:'Singapore', website:'https://swiftship.com', linkedinUrl:'https://linkedin.com/company/swiftship', status:'ready', intelligenceScore:72, dataFreshness:'fresh' },
  { id:'comp-38', name:'CryptoVault Finance', domain:'cryptovault.com', industry:'Finance', country:'Japan', employeeSize:'51-200', location:'Tokyo, Japan', website:'https://cryptovault.com', linkedinUrl:'https://linkedin.com/company/cryptovault', status:'new', intelligenceScore:54, dataFreshness:'old' },
  { id:'comp-39', name:'EduSphere Online', domain:'edusphere.com', industry:'Education', country:'USA', employeeSize:'201-500', location:'Austin, TX', website:'https://edusphere.com', linkedinUrl:'https://linkedin.com/company/edusphere', status:'contacted', intelligenceScore:68, dataFreshness:'fresh' },
  { id:'comp-40', name:'Greenfield Pharma', domain:'greenfieldpharma.com', industry:'Pharma', country:'India', employeeSize:'1001-5000', location:'Hyderabad, India', website:'https://greenfieldpharma.com', linkedinUrl:'https://linkedin.com/company/greenfieldpharma', status:'new', intelligenceScore:76, dataFreshness:'fresh' },
  { id:'comp-41', name:'ProximaTech AI', domain:'proximatech.com', industry:'Technology', country:'Canada', employeeSize:'201-500', location:'Montreal, Canada', website:'https://proximatech.com', linkedinUrl:'https://linkedin.com/company/proximatech', status:'researching', intelligenceScore:92, dataFreshness:'fresh' },
  { id:'comp-42', name:'LuxeRetail Holdings', domain:'luxeretail.com', industry:'Retail', country:'UK', employeeSize:'1001-5000', location:'London, UK', website:'https://luxeretail.com', linkedinUrl:'https://linkedin.com/company/luxeretail', status:'archived', intelligenceScore:45, dataFreshness:'old' },
  { id:'comp-43', name:'Summit Manufacturing', domain:'summitmfg.com', industry:'Manufacturing', country:'Germany', employeeSize:'5001-10000', location:'Stuttgart, Germany', website:'https://summitmfg.com', linkedinUrl:'https://linkedin.com/company/summitmfg', status:'contacted', intelligenceScore:83, dataFreshness:'fresh' },
  { id:'comp-44', name:'Horizon Real Estate', domain:'horizonre.com', industry:'Real Estate', country:'Australia', employeeSize:'201-500', location:'Melbourne, Australia', website:'https://horizonre.com', status:'new', intelligenceScore:61, dataFreshness:'stale' },
  { id:'comp-45', name:'VistaCrop Sciences', domain:'vistacrop.com', industry:'Agriculture', country:'Brazil', employeeSize:'201-500', location:'Curitiba, Brazil', website:'https://vistacrop.com', linkedinUrl:'https://linkedin.com/company/vistacrop', status:'researching', intelligenceScore:64, dataFreshness:'fresh' },
  { id:'comp-46', name:'DigitalWave Media', domain:'digitalwave.com', industry:'Media', country:'India', employeeSize:'501-1000', location:'Mumbai, India', website:'https://digitalwave.com', linkedinUrl:'https://linkedin.com/company/digitalwave', status:'new', intelligenceScore:57, dataFreshness:'stale' },
  { id:'comp-47', name:'Stratton Consulting Group', domain:'stratton.co', industry:'Consulting', country:'UK', employeeSize:'1001-5000', location:'London, UK', website:'https://stratton.co', linkedinUrl:'https://linkedin.com/company/stratton', status:'archived', intelligenceScore:38, dataFreshness:'old' },
  { id:'comp-48', name:'Zenith Aerospace', domain:'zenithaero.com', industry:'Aerospace', country:'USA', employeeSize:'10000+', location:'Huntsville, AL', website:'https://zenithaero.com', linkedinUrl:'https://linkedin.com/company/zenithaero', status:'researching', intelligenceScore:91, dataFreshness:'fresh' },
  { id:'comp-49', name:'Optima Health Systems', domain:'optimahealth.com', industry:'Healthcare', country:'Canada', employeeSize:'1001-5000', location:'Calgary, Canada', website:'https://optimahealth.com', linkedinUrl:'https://linkedin.com/company/optimahealth', status:'contacted', intelligenceScore:78, dataFreshness:'fresh' },
  { id:'comp-50', name:'TidalWave Energy', domain:'tidalwave.com', industry:'Energy', country:'UK', employeeSize:'201-500', location:'Glasgow, UK', website:'https://tidalwave.com', linkedinUrl:'https://linkedin.com/company/tidalwave', status:'ready', intelligenceScore:73, dataFreshness:'stale' },
];

// ─── Contacts (200+) ────────────────────────────────────────────────────────
// 3-5 per company, generated deterministically with helper arrays

function makeContacts() {
  const contacts: Array<{
    id: string; companyId: string; name: string; email: string;
    jobTitle: string; roleBucket: string; linkedinUrl?: string;
    phone?: string; location?: string; status: string;
    emailHealth: string; emailHealthScore: number;
    lastContactedAt?: Date; lastValidatedAt?: Date; archivedAt?: Date;
  }> = [];

  // Role bucket distribution: decision_maker 20%, influencer 30%, end_user 30%, blocker 10%, champion 10%
  const roleDist: string[] = [
    'decision_maker','influencer','influencer','end_user','end_user','end_user','blocker','champion',
  ];
  // Email health distribution: valid 60%, risky 15%, invalid 10%, unknown 15%
  const healthDist: string[] = [
    'valid','valid','valid','valid','valid','valid','risky','risky','invalid','unknown','unknown',
  ];

  const namePool: Array<{ first: string; last: string }> = [];
  const used = new Set<string>();
  for (const f of FIRST_NAMES) {
    for (const l of LAST_NAMES) {
      const key = `${f} ${l}`;
      if (!used.has(key)) { used.add(key); namePool.push({ first: f, last: l }); }
    }
  }
  // Shuffle deterministically
  let seed = 42;
  function rng() { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646; }
  for (let i = namePool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [namePool[i], namePool[j]] = [namePool[j], namePool[i]];
  }

  let nameIdx = 0;
  let contactNum = 1;

  for (const comp of companies) {
    const count = 4 + Math.floor(rng() * 2); // 4-5
    const domain = comp.domain || 'example.com';

    for (let i = 0; i < count; i++) {
      const person = namePool[nameIdx++ % namePool.length];
      const emailPattern = rng();
      let email: string;
      if (emailPattern < 0.33) {
        email = `${person.first.toLowerCase()}@${domain}`;
      } else if (emailPattern < 0.66) {
        email = `${person.first.toLowerCase()}.${person.last.toLowerCase()}@${domain}`;
      } else {
        email = `${person.first[0].toLowerCase()}${person.last.toLowerCase()}@${domain}`;
      }

      const title = JOB_TITLES[Math.floor(rng() * JOB_TITLES.length)];
      const role = roleDist[Math.floor(rng() * roleDist.length)];
      const health = healthDist[Math.floor(rng() * healthDist.length)];
      const healthScore = health === 'valid' ? 85 + Math.floor(rng() * 15)
        : health === 'risky' ? 45 + Math.floor(rng() * 25)
        : health === 'invalid' ? Math.floor(rng() * 15)
        : 0;

      const isArchived = rng() < 0.05; // 5% archived

      contacts.push({
        id: `cont-${contactNum++}`,
        companyId: comp.id,
        name: `${person.first} ${person.last}`,
        email,
        jobTitle: title,
        roleBucket: role,
        linkedinUrl: `https://linkedin.com/in/${person.first.toLowerCase()}-${person.last.toLowerCase()}`,
        phone: `+1 ${Math.floor(rng()*900+100)} ${Math.floor(rng()*900+100)} ${Math.floor(rng()*9000+1000)}`,
        location: comp.location,
        status: 'new',
        emailHealth: health,
        emailHealthScore: healthScore,
        lastContactedAt: rng() < 0.4 ? daysAgo(Math.floor(rng() * 30) + 1) : undefined,
        lastValidatedAt: rng() < 0.6 ? daysAgo(Math.floor(rng() * 14) + 1) : undefined,
        archivedAt: isArchived ? daysAgo(Math.floor(rng() * 60) + 30) : undefined,
      });
    }
  }

  return contacts;
}

const contacts = makeContacts();

// ─── Opportunities (40+) ────────────────────────────────────────────────────

const opportunities = [
  { companyId:'comp-1', title:'Enterprise AI Process Automation Deal', description:'Comprehensive AI-driven process automation across manufacturing lines. Target $5M+ annual savings through document intelligence, quality inspection, and supply chain optimization.', targetContactId:'cont-3', status:'researching', nextAction:'Research their current automation stack and prepare capability deck' },
  { companyId:'comp-1', title:'Cloud Migration Support', description:'They recently started Azure migration from SAP ECC 6.0. Could offer cloud modernization and application modernization services to accelerate their timeline.', targetContactId:'cont-5', status:'proposed', nextAction:'Follow up on the migration proposal sent last week' },
  { companyId:'comp-1', title:'Predictive Maintenance Platform', description:'Build a predictive maintenance system using IoT sensor data from manufacturing equipment. Could reduce unplanned downtime by 40% and save millions in lost production.', targetContactId:'cont-6', status:'researching', nextAction:'Draft predictive maintenance capability overview' },
  { companyId:'comp-2', title:'Data Engineering Platform', description:'Build a scalable data engineering platform for their analytics products. They need real-time data pipelines and a modern data lakehouse architecture.', targetContactId:'cont-10', status:'contacted', nextAction:'Schedule technical deep-dive with their VP Engineering' },
  { companyId:'comp-3', title:'Risk Analytics Modernization', description:'Modernize their legacy risk analytics platform. Currently running on-prem Hadoop cluster that needs migration to cloud-native architecture with real-time processing.', targetContactId:'cont-13', status:'researching', nextAction:'Request current architecture documentation' },
  { companyId:'comp-4', title:'Healthcare Document AI for Claims', description:'Insurance claims processing automation could save significant time for their back-office operations. 50K claims/month with 15% error rate represents major efficiency opportunity.', targetContactId:'cont-14', status:'proposed', nextAction:'Prepare proposal document for document AI solution' },
  { companyId:'comp-4', title:'Patient Flow Optimization', description:'AI-powered patient flow system to reduce wait times and optimize resource allocation across 12 hospitals. Estimated 25% improvement in patient throughput.', targetContactId:'cont-15', status:'researching', nextAction:'Gather more details on current patient flow challenges' },
  { companyId:'comp-5', title:'Adaptive Learning Platform', description:'Build AI-powered adaptive learning paths for their 2M+ students. Personalized content delivery based on learning patterns and performance data.', targetContactId:'cont-18', status:'contacted', nextAction:'Send case study of similar education platform implementation' },
  { companyId:'comp-6', title:'Omnichannel Retail Analytics', description:'Unified analytics dashboard for their 350+ retail stores across the Middle East. Need real-time inventory, sales, and customer behavior analytics.', targetContactId:'cont-21', status:'researching', nextAction:'Research their current POS and analytics infrastructure' },
  { companyId:'comp-7', title:'Sustainability Analytics Platform', description:'GreenEnergy needs better data analytics for their sustainability reporting and carbon tracking across 5000+ solar installations. Real-time monitoring dashboard with predictive analytics.', targetContactId:'cont-24', status:'won', nextAction:'Project kickoff meeting scheduled for next Monday' },
  { companyId:'comp-8', title:'Legal Document Automation', description:'Automate contract review and legal document analysis using NLP. Their team of 200+ lawyers spends 40% of time on document review that could be automated.', targetContactId:'cont-27', status:'researching', nextAction:'Prepare NLP capability deck for legal sector' },
  { companyId:'comp-9', title:'Regulatory Submission Automation', description:'Automate the regulatory document preparation and submission pipeline. Target: reduce submission time from 6-8 months to 2 months. High-value opportunity with pharma margins.', targetContactId:'cont-28', status:'negotiation', nextAction:'Send regulatory automation capability deck to Dr. Fischer' },
  { companyId:'comp-10', title:'AI-Enhanced Threat Detection', description:'Enhance their threat detection with advanced AI/ML capabilities. They process 10B events/day and need better pattern recognition for zero-day threats.', targetContactId:'cont-31', status:'contacted', nextAction:'Research their current detection capabilities and tech stack' },
  { companyId:'comp-11', title:'Aerospace Parts Predictive Analytics', description:'Predictive analytics for aircraft component lifecycle management. Need ML models to predict maintenance schedules and part replacements for 500+ aircraft.', targetContactId:'cont-35', status:'researching', nextAction:'Request fleet data and maintenance history samples' },
  { companyId:'comp-11', title:'Supply Chain Digital Twin', description:'Build a digital twin of their aerospace supply chain to simulate disruptions and optimize inventory. 2000+ suppliers across 40 countries.', targetContactId:'cont-37', status:'researching', nextAction:'Prepare digital twin concept document' },
  { companyId:'comp-12', title:'Route Optimization Engine', description:'AI-powered route optimization for their fleet of 5000+ trucks. Currently using manual planning that results in 15% excess mileage. Target: 20% reduction in fuel costs.', targetContactId:'cont-39', status:'proposed', nextAction:'Follow up on route optimization proposal' },
  { companyId:'comp-13', title:'Content Recommendation Engine', description:'Build an NLP-powered content recommendation system for their digital platforms. Needs to handle multi-language content and real-time personalization.', targetContactId:'cont-42', status:'researching', nextAction:'Prepare NLP/ML capability overview for media industry' },
  { companyId:'comp-14', title:'Client Intelligence Dashboard', description:'Build a unified client intelligence dashboard consolidating data from 15+ sources. Need real-time risk scoring and opportunity identification for their consulting engagements.', targetContactId:'cont-45', status:'contacted', nextAction:'Schedule demo of analytics platform' },
  { companyId:'comp-17', title:'ML Pipeline Scaling for Drug Discovery', description:'Scale their ML infrastructure for protein structure prediction and drug discovery. Need to handle increasing model complexity and data volumes.', targetContactId:'cont-57', status:'negotiation', nextAction:'Prepare ML infrastructure proposal for computational biology' },
  { companyId:'comp-18', title:'Real-Time Analytics Pipeline', description:'Build real-time analytics pipeline processing 1M+ events/sec. Need stream processing with sub-second latency for their SaaS analytics product.', targetContactId:'cont-60', status:'proposed', nextAction:'Prepare streaming architecture proposal' },
  { companyId:'comp-19', title:'Hospital Operations AI', description:'AI-driven hospital operations optimization covering bed management, staff scheduling, and resource allocation across 25 hospitals in India.', targetContactId:'cont-63', status:'researching', nextAction:'Gather hospital operations data for analysis' },
  { companyId:'comp-20', title:'Advanced Anomaly Detection', description:'Build next-gen anomaly detection using LLMs and advanced ML for their data observability platform. Natural language querying of data issues.', targetContactId:'cont-66', status:'contacted', nextAction:'Send technical capability overview' },
  { companyId:'comp-21', title:'Smart Factory Integration', description:'Integrate IoT sensors with AI analytics for their 8 manufacturing plants in Japan. Predictive quality control and automated defect detection.', targetContactId:'cont-69', status:'won', nextAction:'Begin Phase 1 sensor deployment plan' },
  { companyId:'comp-22', title:'RegTech Compliance Platform', description:'Build an automated regulatory compliance platform for their EU banking operations. MiFID II, GDPR, and AML compliance automation.', targetContactId:'cont-72', status:'researching', nextAction:'Map current compliance workflows and pain points' },
  { companyId:'comp-23', title:'Claims Processing Automation', description:'Automate 60% of their 2M+ annual insurance claims processing. $15M/year currently spent on manual processing. AI-powered document extraction and decision support.', targetContactId:'cont-75', status:'proposed', nextAction:'Finalize claims automation proposal' },
  { companyId:'comp-24', title:'Multi-Tenant SaaS Infrastructure', description:'Architect and build multi-tenant infrastructure for their B2B SaaS platform. Need to scale from 200 to 2000 tenants in 18 months.', targetContactId:'cont-78', status:'contacted', nextAction:'Prepare infrastructure scaling assessment' },
  { companyId:'comp-27', title:'Freight Management Platform', description:'Build an integrated freight management platform with real-time tracking, automated documentation, and predictive ETA for their global shipping operations.', targetContactId:'cont-89', status:'researching', nextAction:'Research current TMS systems in use' },
  { companyId:'comp-30', title:'Construction Project Analytics', description:'AI-powered project management analytics for their $2B+ construction portfolio. Predictive cost overruns, schedule delays, and resource optimization.', targetContactId:'cont-98', status:'lost', nextAction:'Archive and document lessons learned' },
  { companyId:'comp-33', title:'Management Consulting AI Toolkit', description:'Build an AI-powered toolkit for their 500+ consultants. Automated report generation, data analysis, and client recommendation engines.', targetContactId:'cont-107', status:'researching', nextAction:'Prepare AI toolkit demo for partner review' },
  { companyId:'comp-34', title:'Pipeline Integrity Monitoring', description:'IoT and AI-based pipeline integrity monitoring system. Real-time leak detection, predictive maintenance, and compliance reporting for 15,000km of pipelines.', targetContactId:'cont-110', status:'contacted', nextAction:'Schedule site visit to pipeline control center' },
  { companyId:'comp-36', title:'Flight Data Analytics Platform', description:'Build a comprehensive flight data analytics platform processing 50TB/day of sensor data. Predictive maintenance, fuel optimization, and safety analytics.', targetContactId:'cont-116', status:'proposed', nextAction:'Prepare technical architecture for flight data processing' },
  { companyId:'comp-41', title:'MLOps Platform Build', description:'Design and build a production MLOps platform for their AI research team. Model registry, automated training pipelines, and A/B testing infrastructure.', targetContactId:'cont-131', status:'negotiation', nextAction:'Finalize MLOps platform scope and timeline' },
  { companyId:'comp-43', title:'Industry 4.0 Digital Transformation', description:'Lead their Industry 4.0 digital transformation across 5 German manufacturing plants. Connected factory, digital twin, and AI quality inspection.', targetContactId:'cont-137', status:'researching', nextAction:'Prepare Industry 4.0 transformation roadmap' },
  { companyId:'comp-48', title:'Satellite Data Processing', description:'Build a satellite telemetry data processing platform. Real-time processing of 100GB/hour of satellite downlink data with ML-powered anomaly detection.', targetContactId:'cont-152', status:'contacted', nextAction:'Request satellite data format specifications' },
  { companyId:'comp-49', title:'Telehealth AI Assistant', description:'Build an AI-powered telehealth assistant for patient triage, symptom assessment, and appointment scheduling. Supporting 3M+ patients across Canada.', targetContactId:'cont-155', status:'proposed', nextAction:'Prepare telehealth AI demo for clinical review' },
  { companyId:'comp-50', title:'Tidal Energy Forecasting', description:'ML-based tidal energy production forecasting system. Optimize turbine operations and grid integration for their 200+ tidal energy installations.', targetContactId:'cont-158', status:'researching', nextAction:'Gather historical production and weather data' },
  { companyId:'comp-35', title:'Clinical Trial Data Platform', description:'Build a unified clinical trial data management platform. Automated data collection, cleaning, and analysis for 30+ active trials.', targetContactId:'cont-122', status:'lost', nextAction:'Review why we lost and document for future reference' },
  { companyId:'comp-39', title:'LMS Migration & Enhancement', description:'Migrate their legacy LMS to a modern cloud-native platform with AI-powered content recommendations and adaptive assessments.', targetContactId:'cont-144', status:'won', nextAction:'Begin migration planning workshop' },
  { companyId:'comp-40', title:'Drug Discovery Data Lake', description:'Design and implement a data lake for their drug discovery research. Consolidate genomic, proteomic, and clinical trial data from 10+ sources.', targetContactId:'cont-147', status:'researching', nextAction:'Assess current data infrastructure and integration needs' },
  { companyId:'comp-44', title:'Property Valuation AI', description:'Build an AI-powered property valuation model for the Australian real estate market. Automated comparable analysis and market trend prediction.', targetContactId:'cont-150', status:'contacted', nextAction:'Request historical transaction data for model training' },
  { companyId:'comp-37', title:'Smart Port Operations', description:'AI-powered port operations optimization for their 3 major ports in Southeast Asia. Automated container tracking, berth allocation, and vessel scheduling. Target: 25% improvement in port throughput.', targetContactId:'cont-125', status:'researching', nextAction:'Prepare port operations analytics capability overview' },
  { companyId:'comp-19', title:'Diagnostic AI for Radiology', description:'Build an AI-assisted diagnostic tool for their radiology department processing 500K+ scans annually. Computer vision models for X-ray, CT, and MRI analysis to reduce radiologist workload by 40%.', targetContactId:'cont-165', status:'contacted', nextAction:'Schedule clinical validation workshop with radiology team' },
  { companyId:'comp-25', title:'Supply Chain Visibility Platform', description:'Build end-to-end supply chain visibility platform for their 10,000+ product SKUs across 500 stores. Real-time tracking, demand forecasting, and automated replenishment. Target: 30% reduction in stockouts.', targetContactId:'cont-172', status:'researching', nextAction:'Assess current ERP and warehouse management systems' },
];

// ─── Timeline Entries (100+) ────────────────────────────────────────────────

function makeTimelineEntries() {
  const entries: Array<{ companyId?: string; contactId?: string; action: string; details: string; createdAt: Date }> = [];
  const now = Date.now();

  const companyEvents = [
    { action: 'company_created', detailsMap: {
      'Manufacturing': 'Imported from Manufacturing_Leads_Q2.csv',
      'Technology': 'Imported from Tech_Companies_Global.csv',
      'Healthcare': 'Imported from Healthcare_Leads.csv',
      'Finance': 'Imported from Finance_Sector_Q3.csv',
      'Education': 'Imported from Education_Tech_Leaders.csv',
      'Retail': 'Imported from Retail_Global_Leaders.csv',
      'Energy': 'Imported from Energy_Sector_Leads.csv',
      'Legal': 'Imported from Legal_Tech_Adopters.csv',
      'Pharma': 'Imported from Pharma_Global_Leaders.csv',
      'Aerospace': 'Imported from Aerospace_Defense_Tech.csv',
      'Logistics': 'Imported from Logistics_Supply_Chain.csv',
      'Media': 'Imported from Media_Digital_Tech.csv',
      'Consulting': 'Imported from Consulting_Firms_Global.csv',
      'Agriculture': 'Imported from AgriTech_Innovators.csv',
      'Real Estate': 'Imported from PropTech_Leaders.csv',
    }},
  ];

  for (const comp of companies) {
    const importDetail = companyEvents[0].detailsMap[comp.industry || 'Technology'] || 'Imported from leads database';
    // Company created
    entries.push({ companyId: comp.id, action: 'company_created', details: importDetail, createdAt: daysAgo(20 + Math.floor(Math.random() * 10)) });

    // Research updated
    if (['researching','ready','contacted','qualified'].includes(comp.status)) {
      entries.push({ companyId: comp.id, action: 'research_updated', details: `Added business overview and technology landscape research for ${comp.name}`, createdAt: daysAgo(15 + Math.floor(Math.random() * 8)) });
    }

    // Status changed
    if (comp.status !== 'new') {
      entries.push({ companyId: comp.id, action: 'status_changed', details: `Status updated from 'new' to '${comp.status}' after initial research and validation`, createdAt: daysAgo(10 + Math.floor(Math.random() * 8)) });
    }

    // Contact added events
    const compContacts = contacts.filter(c => c.companyId === comp.id);
    for (const ct of compContacts.slice(0, 2)) {
      entries.push({ companyId: comp.id, contactId: ct.id, action: 'contact_added', details: `Added ${ct.name} (${ct.jobTitle}) to contact database`, createdAt: daysAgo(12 + Math.floor(Math.random() * 10)) });
    }
  }

  // Add specific timeline events for companies with opportunities
  for (const opp of opportunities.slice(0, 30)) {
    entries.push({ companyId: opp.companyId, action: 'opportunity_created', details: `Created opportunity: ${opp.title}`, createdAt: daysAgo(3 + Math.floor(Math.random() * 10)) });
    if (['proposed','negotiation','won','lost'].includes(opp.status)) {
      entries.push({ companyId: opp.companyId, action: 'opportunity_updated', details: `Opportunity "${opp.title}" moved to ${opp.status} stage`, createdAt: daysAgo(Math.floor(Math.random() * 5)) });
    }
  }

  // Email validation events
  const validContacts = contacts.filter(c => c.lastValidatedAt);
  for (const ct of validContacts.slice(0, 25)) {
    entries.push({ companyId: ct.companyId, contactId: ct.id, action: 'email_validated', details: `Email ${ct.email} validated as ${ct.emailHealth} (score: ${ct.emailHealthScore})`, createdAt: ct.lastValidatedAt! });
  }

  // Health check run events
  entries.push({ companyId: 'comp-1', action: 'health_check_run', details: 'Ran batch email health check for 8 contacts. 5 valid, 2 risky, 1 invalid.', createdAt: daysAgo(2) });
  entries.push({ companyId: 'comp-4', action: 'health_check_run', details: 'Ran batch email health check for 4 contacts. 3 valid, 1 risky.', createdAt: daysAgo(5) });
  entries.push({ companyId: 'comp-9', action: 'health_check_run', details: 'Ran batch email health check for 5 contacts. 4 valid, 1 unknown.', createdAt: daysAgo(1) });
  entries.push({ companyId: 'comp-23', action: 'health_check_run', details: 'Ran batch email health check for 4 contacts. 2 valid, 1 risky, 1 invalid.', createdAt: daysAgo(3) });
  entries.push({ companyId: 'comp-11', action: 'health_check_run', details: 'Ran batch email health check for 4 contacts. 3 valid, 1 risky.', createdAt: daysAgo(4) });
  entries.push({ companyId: 'comp-43', action: 'health_check_run', details: 'Ran batch email health check for 5 contacts. 4 valid, 1 valid.', createdAt: daysAgo(6) });

  // Import completed events
  entries.push({ action: 'import_completed', details: 'Import batch "Global_Leads_Master_Q3.csv" completed: 45,200 rows processed, 42,800 accepted', createdAt: daysAgo(22) });
  entries.push({ action: 'import_completed', details: 'Import batch "APAC_Tech_Companies.csv" completed: 12,500 rows processed, 11,900 accepted', createdAt: daysAgo(18) });
  entries.push({ action: 'import_completed', details: 'Import batch "EMEA_Industry_Leaders.csv" completed: 28,300 rows processed, 26,700 accepted', createdAt: daysAgo(14) });

  // Note added events
  entries.push({ companyId: 'comp-1', action: 'note_added', details: 'Call note: Discussed AI automation roadmap with CTO John Smith at Manufacturing Tech Summit', createdAt: daysAgo(6) });
  entries.push({ companyId: 'comp-4', action: 'note_added', details: 'Meeting note: Discovery call with Sarah Chen, VP of Engineering. Very interested in document AI.', createdAt: daysAgo(2) });
  entries.push({ companyId: 'comp-9', action: 'note_added', details: 'Research note: Lab of the Future initiative confirmed. Budget approved for FY2025.', createdAt: daysAgo(3) });
  entries.push({ companyId: 'comp-23', action: 'note_added', details: 'Meeting note: Presented claims automation demo to Richard Taylor. Impressed by accuracy metrics.', createdAt: daysAgo(1) });
  entries.push({ companyId: 'comp-7', action: 'note_added', details: 'Call note: Sustainability dashboard demo went well. GreenEnergy CIO wants to proceed to POC.', createdAt: daysAgo(4) });

  // Sort by date descending (most recent first)
  entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return entries;
}

const timelineEntries = makeTimelineEntries();

// ─── Notes (50+) ────────────────────────────────────────────────────────────

const companyNotes = [
  { companyId:'comp-1', body:'Had a great conversation with John Smith at the Manufacturing Tech Summit in Detroit. They are actively looking for AI automation solutions for their quality control lines. Budget is allocated for Q1 next year. Key pain point: 15% defect rate on assembly line 3.', noteType:'call' },
  { companyId:'comp-1', body:'Mary Wilson from Digital Transformation confirmed they are 6 months into their Azure migration. They are struggling with SAP ECC 6.0 integration. This is a strong cloud modernization opportunity. Suggested a joint workshop.', noteType:'meeting' },
  { companyId:'comp-1', body:'Research findings: ABC Manufacturing recently filed 3 patents related to IoT sensor networks for predictive maintenance. Their R&D budget increased 22% YoY. They are investing heavily in Industry 4.0 capabilities.', noteType:'research' },
  { companyId:'comp-4', body:'Discovery call with Sarah Chen went very well. HealthPlus processes 50K+ insurance claims per month with a 15% manual error rate. They estimate $3M/year in rework costs. Sarah is our champion - she will present to the C-suite next week.', noteType:'call' },
  { companyId:'comp-4', body:'Met with Dr. Patel at their Boston HQ. Discussed patient flow optimization across their 12 hospital network. Current average wait time is 47 minutes. Target is under 20 minutes. They have a dedicated innovation budget of $2M for this fiscal year.', noteType:'meeting' },
  { companyId:'comp-4', body:'Competitive intelligence: HealthPlus recently evaluated UiPath and Automation Anywhere for RPA. They chose neither due to integration complexity with their Epic EHR system. This gives us an advantage with our healthcare-specific approach.', noteType:'research' },
  { companyId:'comp-9', body:'Dr. Fischer confirmed that the Lab of the Future initiative has board-level approval with a €15M budget over 3 years. Regulatory submission automation is their top priority. Current submission cycle is 6-8 months; target is 2 months.', noteType:'call' },
  { companyId:'comp-9', body:'On-site visit to Basel research facility. Impressive setup with 200+ researchers. Their current document preparation is 70% manual with significant quality issues. 3 submissions were rejected last year due to formatting errors.', noteType:'meeting' },
  { companyId:'comp-7', body:'GreenEnergy CIO showed strong interest during the sustainability analytics demo. They track 5000+ solar installations manually via spreadsheets. Real-time monitoring could reduce maintenance response time from 48 hours to 2 hours.', noteType:'meeting' },
  { companyId:'comp-23', body:'Richard Taylor was very impressed by the claims automation demo. Showed them processing 200 claims in under 10 minutes vs their current 45-minute average. Their board meets next month to discuss the $2M automation budget.', noteType:'meeting' },
  { companyId:'comp-23', body:'Research: InsureTech Global acquired a smaller insurtech startup last quarter. They are aggressively building internal AI capabilities but lack the specialized document processing expertise we offer.', noteType:'research' },
  { companyId:'comp-11', body:'NovaTech CTO mentioned they process 50TB of telemetry data daily from their aircraft fleet. Current analytics platform is struggling with scale. They are evaluating vendors for a complete overhaul.', noteType:'call' },
  { companyId:'comp-21', body:'Site visit to Osaka manufacturing plant was very productive. Pacific Rim has invested significantly in IoT sensors but lacks the AI layer to extract insights. Their quality team manually reviews 10,000+ inspection images daily.', noteType:'meeting' },
  { companyId:'comp-33', body:'BluePeak senior partner expressed interest in an AI toolkit for their consultants. Currently consultants spend 60% of their time on data gathering and report formatting. An AI assistant could reclaim 30+ hours per consultant per month.', noteType:'meeting' },
  { companyId:'comp-41', body:'Technical deep-dive with ProximaTech ML team. They have 15 ML models in production but no standardized MLOps. Model deployment takes 3-4 weeks currently. They want to get it under 3 days.', noteType:'call' },
  { companyId:'comp-48', body:'Zenith Aerospace processes 100GB/hour of satellite telemetry data. Their current batch processing has 6-hour latency. Need real-time processing for anomaly detection. Budget approved by DoD contract.', noteType:'research' },
  { companyId:'comp-34', body:'PetroChem has 15,000km of pipelines across the Middle East. Current leak detection relies on manual patrol. They had 3 incidents last year costing $50M+ in damages and fines. Strong urgency for AI-based monitoring.', noteType:'research' },
  { companyId:'comp-2', body:'TechVision Solutions is exploring a partnership model rather than a vendor relationship. They want to co-develop a data engineering platform that they can also offer to their clients. Potential for revenue sharing arrangement.', noteType:'meeting' },
  { companyId:'comp-49', body:'Optima Health wants to build a telehealth AI assistant for patient triage. They serve 3M+ patients across Canada. Current triage process has 40-minute average wait times. Regulatory approval from Health Canada will be needed.', noteType:'call' },
  { companyId:'comp-39', body:'EduSphere Online decided to go with us for their LMS migration! They are moving from a 10-year-old custom LMS to a modern cloud platform. Project value: $1.2M over 18 months. Kickoff next week.', noteType:'general' },
];

const contactNotes = [
  { contactId:'cont-3', body:'Tom Bradley is very well-connected in the Detroit manufacturing scene. He mentioned he can introduce us to 3 other potential clients at upcoming conferences. Keep him warm even if ABC deal does not close.', noteType:'call' },
  { contactId:'cont-14', body:'Sarah Chen is our primary champion at HealthPlus. She has 15 years in healthcare IT and strong influence over the CTO. She is presenting our capabilities to the executive team next Tuesday. Send her updated ROI calculations by Friday.', noteType:'meeting' },
  { contactId:'cont-28', body:'Dr. Fischer is methodical and data-driven. He wants to see peer-reviewed evidence of our regulatory automation accuracy. Send him the case study from the Merck engagement and the accuracy benchmark report.', noteType:'call' },
  { contactId:'cont-31', body:'Marcus Webb at CyberShield is technically sharp and will push hard on architecture questions. Make sure our solution architect is available for the deep-dive. He prefers async communication via email.', noteType:'general' },
  { contactId:'cont-57', body:'Yuki Tanaka is the Head of R&D at BioGenetics. She is leading the protein structure prediction project. Very forward-thinking but needs to convince the board. She asked for a detailed technical architecture document.', noteType:'meeting' },
  { contactId:'cont-66', body:'Kevin Liu at DataVault is enthusiastic about our anomaly detection capabilities. He wants to integrate LLM-based natural language querying into their product. Potential for a strategic partnership beyond this initial engagement.', noteType:'call' },
  { contactId:'cont-75', body:'Richard Taylor confirmed the claims automation project budget of $2M is approved. He wants to start with a 3-month POC covering motor insurance claims. If successful, they will expand to health and property lines.', noteType:'meeting' },
  { contactId:'cont-24', body:'Hans Müller from GreenEnergy is very results-oriented. He wants concrete KPIs and milestone-based delivery. Prefers weekly status calls. His team is lean so we need to provide strong project management.', noteType:'call' },
  { contactId:'cont-107', body:'Samantha Lee at BluePeak has been a consulting partner for 12 years. She understands the value of AI tools but is concerned about adoption by senior consultants who resist change. Suggest a change management component.', noteType:'meeting' },
  { contactId:'cont-131', body:'Dr. Kenji Yamamoto at ProximaTech is a former Google Brain researcher. He is technically demanding and will scrutinize every detail of our MLOps proposal. Ensure the architecture review is thorough.', noteType:'research' },
  { contactId:'cont-137', body:'Lars Schmidt at Summit Manufacturing is practical and cost-conscious. He wants to see clear ROI within 12 months. Suggest phased approach starting with the highest-impact use case: visual quality inspection.', noteType:'call' },
  { contactId:'cont-144', body:'Emily Chen at EduSphere is the project sponsor for the LMS migration. She has strong executive backing. Key concern is data migration integrity - they have 10 years of student learning data that must be preserved.', noteType:'meeting' },
  { contactId:'cont-152', body:'Robert Anderson at Zenith Aerospace has security clearance for DoD projects. All communication must go through secure channels. The satellite data processing project is under a classified contract umbrella.', noteType:'general' },
  { contactId:'cont-155', body:'Priya Sharma at Optima Health has a clinical background which helps her bridge the gap between engineering and healthcare requirements. She wants the telehealth AI to meet clinical safety standards from day one.', noteType:'call' },
  { contactId:'cont-158', body:'Wei Wang at TidalWave Energy is a renewable energy specialist with deep domain expertise. He is skeptical of generic ML approaches and wants physics-informed models for tidal energy forecasting.', noteType:'research' },
  { contactId:'cont-39', body:'Carlos Santos at Apex Logistics is frustrated with their current TMS vendor. Contract renewal is coming up in 6 months. He wants to explore alternatives. Timing is perfect for our route optimization solution.', noteType:'call' },
  { contactId:'cont-98', body:'Ahmed Al-Rashid at TerraForm was not convinced about AI for construction. He cited past failures with other vendors. The deal was lost to a traditional project management consultancy. Document lessons learned.', noteType:'meeting' },
  { contactId:'cont-122', body:'Dr. Maria Fischer at MediCare felt our clinical trial platform lacked HIPAA compliance features they needed. They went with a specialized healthcare vendor. We should strengthen our compliance story for pharma/healthcare.', noteType:'general' },
  { contactId:'cont-78', body:'Rajesh Kumar at CloudNine is a strong technical leader. He built their current platform from scratch. He is looking for a partner who can match his engineering standards. Pair him with our best solution architect.', noteType:'meeting' },
  { contactId:'cont-110', body:'Omar Hassan at PetroChem is the VP of Operations. He is dealing with aging pipeline infrastructure and increasing regulatory pressure. The pipeline monitoring project is his top priority for Q1.', noteType:'call' },
  { contactId:'cont-45', body:'Jessica Brown at QuantumLeap is a data-driven decision maker. She wants to see a live demo with their actual client data. NDA signing is in progress. Once signed, we can prepare a customized demo.', noteType:'general' },
  { contactId:'cont-63', body:'Arjun Patel at Pinnacle Healthcare manages operations for 25 hospitals. He is overwhelmed with operational data and lacks unified analytics. He wants a single dashboard that shows bed occupancy, staff utilization, and patient flow.', noteType:'meeting' },
  { contactId:'cont-89', body:'Felipe Santos at Atlas Freight manages a team of 15 dispatchers. He is open to AI-assisted route planning but his team is resistant. Change management will be critical for adoption.', noteType:'call' },
  { contactId:'cont-150', body:'Liam O\'Connor at Horizon Real Estate is a data enthusiast who built their current valuation model in Excel. He knows it needs to be modernized but is protective of his methodology. Approach as augmentation, not replacement.', noteType:'general' },
  { contactId:'cont-116', body:'Sakura Ito at AeroSpace Dynamics is leading the Flight Data Analytics initiative. She has a PhD in aerospace engineering and understands both the domain and data science. Ideal technical stakeholder.', noteType:'research' },
  { contactId:'cont-147', body:'Deepa Sharma at Greenfield Pharma manages a data engineering team of 8. They are currently spending 70% of their time on data wrangling instead of analysis. She is desperate for a modern data lake solution.', noteType:'meeting' },
  { contactId:'cont-72', body:'Dieter Weber at Nordic Finance is risk-averse by nature. He wants extensive references and proof points before making any technology decisions. Prepare 3+ case studies from the banking sector.', noteType:'call' },
  { contactId:'cont-42', body:'Anika Müller at SkyRocket Media is creative and vision-oriented. She wants the content recommendation engine to feel magical to end users. She cares more about user experience than technical architecture.', noteType:'meeting' },
  { contactId:'cont-69', body:'Takeshi Yamamoto at Pacific Rim Manufacturing is a traditionalist who prefers proven technologies. He was convinced after seeing the 15x defect detection improvement at our reference manufacturing client.', noteType:'call' },
  { contactId:'cont-107', body:'Follow-up: Samantha Lee at BluePeak shared that their managing partner is now asking about AI tools after seeing the competitive landscape shift. She wants a formal presentation for the leadership team next month.', noteType:'general' },
  { contactId:'cont-18', body:'Mei Lin at EduLearn is exploring gamification and adaptive learning. She attended our webinar on AI in education last month and has been following up consistently. Good long-term prospect.', noteType:'call' },
  { contactId:'cont-21', body:'Fatima Al-Maktoum at RetailMax manages a $50M annual technology budget. She is looking for vendors who can serve all 350 stores across the GCC region. Multi-currency and multi-language support is essential.', noteType:'meeting' },
];

// ─── Research Cards (15+) ───────────────────────────────────────────────────

const researchCards = [
  { companyId:'comp-1', businessOverview:'ABC Manufacturing is a leading automotive parts manufacturer headquartered in Detroit, MI with over 7,500 employees across 12 facilities. They produce precision-engineered components for major OEMs including Ford, GM, and Stellantis. Annual revenue exceeds $2.1B with a strong focus on electric vehicle components.', currentTechLandscape:'Currently running SAP ECC 6.0 for ERP, with a custom-built MES system from 2015. They use Azure for cloud services but migration is only 30% complete. Analytics infrastructure is limited to basic Excel reporting with some Power BI dashboards. No AI/ML capabilities in production.', potentialChallenges:'Significant technical debt in legacy systems. The SAP migration is consuming most of their IT budget and attention. Internal resistance to change from factory floor managers who prefer manual processes. Limited data science talent in the Detroit market.', possibleOpportunities:'Strong appetite for AI-driven quality inspection to reduce their 15% defect rate. Predictive maintenance for 500+ manufacturing machines could save $8M annually. Supply chain optimization given their 2000+ supplier network. Digital twin of factory operations.', relevantServices:'AI Process Automation for quality inspection, Predictive Maintenance Platform, Document Intelligence for supplier invoices and compliance docs, Data Analytics & BI for operations dashboards.', keyDecisionMakers:'John Smith (CTO) - technical decision maker, Mary Wilson (VP Digital Transformation) - executive sponsor, Tom Bradley (Director of IT) - implementation lead. Board approval required for investments over $1M.', lastInteraction:'Discovery call with Mary Wilson on Dec 10. She confirmed the AI automation budget is allocated for Q1 2025. CTO John Smith wants a technical deep-dive in January.', nextAction:'Prepare detailed capability deck focused on manufacturing AI use cases with ROI projections. Schedule technical workshop with John Smith.', confidenceScore:88 },
  { companyId:'comp-4', businessOverview:'HealthPlus Networks is a major healthcare network operating 12 hospitals and 200+ clinics across the northeastern United States. They serve over 2 million patients annually with a workforce of 15,000+ healthcare professionals. Revenue of $4.5B makes them one of the top 20 health systems nationally.', currentTechLandscape:'Epic EHR system deployed across all facilities. Custom data warehouse built on Snowflake. Limited AI capabilities - only basic NLP for clinical note summarization in pilot. Claims processing is 70% manual with a custom workflow engine. No computer vision in production despite significant imaging volume.', potentialChallenges:'HIPAA compliance adds complexity to any technology implementation. Their Epic EHR integration is notoriously difficult. Clinical staff resistance to AI-powered tools. Budget constraints due to rising healthcare costs. Multi-year procurement cycles.', possibleOpportunities:'Claims processing automation could save $3M annually in their back-office operations. Patient flow optimization across 12 hospitals could reduce wait times by 60%. AI-powered medical imaging analysis for radiology department. Supply chain optimization for hospital operations.', relevantServices:'Document Intelligence for claims and clinical documents, AI Process Automation for back-office workflows, NLP for clinical text analysis, Data Analytics for operational dashboards.', keyDecisionMakers:'Sarah Chen (VP Engineering) - primary champion, Dr. Rajesh Patel (CMIO) - clinical sponsor, Michael Torres (CFO) - budget approval. Board-level approval required for any project over $500K.', lastInteraction:'In-person meeting with Sarah Chen and Dr. Patel at Boston HQ on Dec 12. Demo of document AI was very well received. Sarah presenting to C-suite on Dec 18.', nextAction:'Send detailed ROI analysis and implementation roadmap to Sarah Chen before her C-suite presentation. Prepare answers for anticipated technical questions.', confidenceScore:91 },
  { companyId:'comp-9', businessOverview:'PharmaCore Labs is a global pharmaceutical company headquartered in Basel, Switzerland with operations in 35 countries. They specialize in oncology, immunology, and rare diseases with 8,000+ employees. Annual R&D spend exceeds $2.5B with 25 compounds in clinical trials.', currentTechLandscape:'Sophisticated R&D IT infrastructure with high-performance computing clusters for molecular modeling. LIMS system from Thermo Fisher. Document management via Veeva Vault. However, regulatory submission preparation is 70% manual. No AI/ML in regulatory affairs despite significant investment in clinical AI.', potentialChallenges:'Heavy regulatory requirements (FDA, EMA, PMDA) constrain technology choices. Data privacy across multiple jurisdictions. Long validation cycles for any GxP-compliant system. Internal politics between R&D and commercial IT teams. High quality bar for any vendor.', possibleOpportunities:'Regulatory submission automation could reduce 6-8 month submission cycles to 2 months, saving €10M+ annually. AI-powered literature review for drug discovery. Clinical trial data management and analysis automation. Automated pharmacovigilance signal detection.', relevantServices:'Document Intelligence for regulatory submissions, NLP for medical literature analysis, AI Process Automation for clinical trial workflows, Data Analytics for R&D portfolio management.', keyDecisionMakers:'Dr. Klaus Fischer (Head of Regulatory Affairs) - primary sponsor, Dr. Yuki Tanaka (Head of R&D) - technical evaluation, CFO Andreas Weber - budget approval. Board-level priority as "Lab of the Future" initiative.', lastInteraction:'On-site visit to Basel facility on Dec 8. Tour of research labs and regulatory affairs department. Dr. Fischer confirmed board-approved budget of €15M for Lab of the Future over 3 years.', nextAction:'Prepare regulatory automation proof-of-concept proposal with specific workflow mappings for FDA and EMA submissions. Include validation documentation approach.', confidenceScore:93 },
  { companyId:'comp-7', businessOverview:'GreenEnergy Solutions is a leading renewable energy company based in Munich, Germany. They design, install, and maintain over 5,000 solar installations across Europe with a growing presence in the Middle East. Revenue of €800M with 2,500 employees. Recently raised €120M Series C for expansion.', currentTechLandscape:'SCADA systems for solar farm monitoring with legacy dashboards. Manual maintenance scheduling via SAP PM module. No predictive analytics despite 3+ years of sensor data. Customer reporting is manual Excel-based. No AI/ML capabilities in house.', potentialChallenges:'Limited internal technical capabilities - most IT is outsourced to a German system integrator. Data quality issues from aging sensor infrastructure. Multiple data formats across different solar panel manufacturers. Need for real-time processing at edge locations.', possibleOpportunities:'Real-time monitoring dashboard for 5,000+ installations could reduce maintenance response time from 48 hours to 2 hours. Predictive maintenance could increase energy output by 8-12%. Automated sustainability reporting for ESG compliance. Customer-facing analytics portal.', relevantServices:'Data Analytics & BI for monitoring dashboards, Predictive Maintenance Platform, Cloud Modernization for their data infrastructure, Document Intelligence for compliance reporting.', keyDecisionMakers:'Hans Müller (CIO) - technical decision maker, CEO Klaus Schmidt - executive sponsor for digital transformation. Board recently approved digital transformation budget of €20M over 2 years.', lastInteraction:'Virtual demo of sustainability analytics platform on Dec 11. Hans Müller was impressed by real-time capabilities. He wants to proceed to a 3-month POC starting in January.', nextAction:'Prepare POC scope document and timeline. Identify 50 solar installations for pilot deployment. Set up data integration plan for their SCADA systems.', confidenceScore:85 },
  { companyId:'comp-11', businessOverview:'NovaTech Industries is a major aerospace and defense contractor based in Seattle, WA. They design and manufacture aircraft components, avionics systems, and satellite payloads. With 8,000+ employees and $3.2B in annual revenue, they serve both commercial (Boeing, Airbus) and defense (DoD) customers.', currentTechLandscape:'Mature PLM and ERP systems (Siemens Teamcenter + SAP S/4HANA). Custom telemetry data platform built on Hadoop that is reaching end of life. Some ML models in production for component testing but no MLOps infrastructure. Limited real-time analytics capabilities.', potentialChallenges:'ITAR and security clearance requirements for all technology implementations. Extremely rigorous validation and testing requirements for aerospace systems. Long procurement cycles (12-18 months). Data classification requirements limit cloud usage. Multiple business units with different technology stacks.', possibleOpportunities:'Real-time telemetry data platform to process 50TB/day of flight and satellite data. Predictive analytics for component lifecycle management across their aircraft fleet. Digital twin of manufacturing supply chain for disruption simulation. AI-powered anomaly detection for quality control.', relevantServices:'Machine Learning Engineering for MLOps platform, Data Analytics for telemetry processing, AI Process Automation for quality inspection, Cloud Modernization for data platform migration.', keyDecisionMakers:'CTO (name TBD) - ultimate technical authority, VP Engineering (name TBD) - implementation owner, DoD Program Manager - compliance requirements. CISO approval required for any cloud deployment.', lastInteraction:'Initial outreach email sent on Dec 5. Received positive response from VP Engineering requesting a capability overview. Scheduled introductory call for next week.', nextAction:'Prepare aerospace-specific capability deck highlighting similar defense/aerospace experience. Ensure all materials are ITAR-compliant. Prepare security questionnaire responses.', confidenceScore:78 },
  { companyId:'comp-23', businessOverview:'InsureTech Global is a leading insurance technology company based in Edinburgh, UK. They provide claims management, underwriting, and policy administration platforms to 50+ insurance carriers across Europe. With 350 employees and £120M revenue, they are one of the fastest-growing insurtech companies in Europe.', currentTechLandscape:'Modern microservices architecture on AWS with Kubernetes. Strong engineering team of 120+ developers. Claims processing engine is custom-built but handles only 40% of claims automatically. OCR for document extraction is basic (Tesseract-based). No ML models in production for claims decisioning.', potentialChallenges:'Fast-paced environment with aggressive growth targets may limit attention for transformational projects. Existing engineering team may resist external solutions. Multiple clients with different data formats and business rules. Regulatory compliance across 15+ European jurisdictions.', possibleOpportunities:'Upgrade their OCR to AI-powered document intelligence for claims processing. ML-based claims triage and decision support could automate 60%+ of remaining manual claims. Fraud detection using anomaly detection on claims patterns. Automated regulatory reporting for Solvency II compliance.', relevantServices:'Document Intelligence for claims document processing, AI Process Automation for claims workflows, ML Engineering for fraud detection models, NLP for claims correspondence analysis.', keyDecisionMakers:'Richard Taylor (CEO) - executive sponsor, CTO David Chen - technical evaluation, Head of Product Sarah Williams - product integration. Board approval needed for investments over £500K.', lastInteraction:'In-person meeting at their Edinburgh office on Dec 13. Presented claims automation demo processing 200 claims in 10 minutes vs their 45-minute average. Richard Taylor was impressed and wants to move to POC.', nextAction:'Send detailed POC proposal covering motor insurance claims as first use case. Include pricing, timeline, and resource requirements. Schedule technical architecture session with their CTO.', confidenceScore:87 },
  { companyId:'comp-33', businessOverview:'BluePeak Consulting is a top-tier management consulting firm based in New York with offices in London, Singapore, and Sydney. They employ 2,500+ consultants serving Fortune 500 clients. Annual revenue of $1.8B with practice areas in strategy, operations, technology, and digital transformation.', currentTechLandscape:'Standard enterprise tools (Office 365, Salesforce, Workday). Proprietary knowledge management system built 8 years ago is showing its age. Limited analytics capabilities - most analysis is done in Excel by individual consultants. No AI/ML tools deployed despite growing client demand for data-driven consulting.', potentialChallenges:'Partners and senior consultants may resist AI tools that change established workflows. Diverse client requirements make standardization difficult. Knowledge management is fragmented across practices. High billable hour expectations leave little time for tool adoption.', possibleOpportunities:'AI-powered toolkit for consultants could save 30+ hours per month per consultant through automated data analysis and report generation. Client intelligence dashboard consolidating 15+ data sources. Automated proposal generation and competitive intelligence. Knowledge management modernization with AI-powered search.', relevantServices:'NLP for document analysis and report generation, Data Analytics for client intelligence, AI Process Automation for workflow automation, ML Engineering for predictive client analytics.', keyDecisionMakers:'Samantha Lee (Senior Partner, Digital Practice) - champion, Managing Partner (name TBD) - budget approval, CTO Mark Johnson - technical evaluation. Innovation committee approval required for new tools.', lastInteraction:'Dinner meeting with Samantha Lee in NYC on Dec 9. She shared that the managing partner is now asking about AI tools after competitors adopted them. She wants a formal presentation to the leadership team in January.', nextAction:'Prepare executive presentation highlighting competitive pressure and ROI of AI consultant toolkits. Include reference from similar engagement with another consulting firm. Develop demo with sample consulting deliverables.', confidenceScore:75 },
  { companyId:'comp-41', businessOverview:'ProximaTech AI is a fast-growing AI research company based in Montreal, Canada. Founded by former Google Brain researchers, they specialize in computer vision and NLP for enterprise applications. With 200+ employees and $45M Series B funding, they are building cutting-edge AI products for the financial and healthcare sectors.', currentTechLandscape:'World-class ML research team with 15 models in production. However, no standardized MLOps infrastructure - each team has custom deployment pipelines. Model deployment takes 3-4 weeks. No centralized model registry or monitoring. Experiment tracking is inconsistent across teams.', potentialChallenges:'Research-heavy culture may resist engineering process standardization. Multiple ML frameworks (PyTorch, TensorFlow, JAX) in use. High bar for engineering quality given the technical sophistication of the team. Budget constraints as they are still in growth mode post-Series B.', possibleOpportunities:'Build a production MLOps platform to standardize model deployment, monitoring, and retraining. Could reduce deployment time from 3-4 weeks to 3 days. Centralized model registry and A/B testing infrastructure. Automated model performance monitoring and alerting.', relevantServices:'Machine Learning Engineering for MLOps platform design and build, Cloud Modernization for infrastructure optimization, Data Analytics for model performance monitoring.', keyDecisionMakers:'Dr. Kenji Yamamoto (Co-founder & CTO) - technical authority, CEO Marie-Claire Bouchard - budget approval, VP Engineering (name TBD) - implementation. Technical team buy-in is critical.', lastInteraction:'Technical deep-dive with Dr. Yamamoto and his ML engineering lead on Dec 14. Reviewed their current deployment pipeline and identified 12 pain points. Dr. Yamamoto agreed to a formal proposal for MLOps platform.', nextAction:'Prepare detailed MLOps platform architecture proposal. Include comparison of open-source vs commercial tools. Address their specific pain points around multi-framework model deployment. Schedule follow-up to review proposal.', confidenceScore:82 },
  { companyId:'comp-21', businessOverview:'Pacific Rim Manufacturing is one of Japan\'s largest electronics manufacturers with 15,000+ employees across 8 manufacturing plants. They produce semiconductors, display panels, and automotive electronics for global OEMs. Annual revenue of ¥800B ($5.3B) with a strong focus on quality and precision.', currentTechLandscape:'Highly automated factories with extensive IoT sensor networks. SAP S/4HANA for ERP. Custom quality management system. However, visual quality inspection is still largely manual - 10,000+ images reviewed daily by trained inspectors. No AI/ML in production despite significant data assets.', potentialChallenges:'Cultural resistance to replacing human inspectors with AI. Extremely high quality standards ( Six Sigma) require near-perfect accuracy. Japanese language requirements for all documentation and interfaces. Long decision-making cycles typical of Japanese corporations. Preference for domestic vendors.', possibleOpportunities:'AI-powered visual quality inspection could increase throughput 15x while maintaining 99.9% accuracy. Predictive maintenance for 2,000+ machines across 8 plants. Supply chain digital twin for their 500+ supplier network. Energy optimization across manufacturing facilities.', relevantServices:'AI Process Automation for visual quality inspection, Predictive Maintenance Platform, Data Analytics for operational dashboards, ML Engineering for quality prediction models.', keyDecisionMakers:'Takeshi Yamamoto (Director of Manufacturing Technology) - technical sponsor, Plant Manager (name TBD) - implementation owner, CTO - strategic approval. Decision requires consensus across multiple plant managers.', lastInteraction:'Site visit to Osaka plant on Dec 6. Demonstrated AI quality inspection achieving 99.7% accuracy on their display panel samples. Takeshi Yamamoto was convinced and is now building internal consensus for a multi-plant rollout.', nextAction:'Prepare multi-plant implementation plan with phased rollout timeline. Address data security and sovereignty requirements for Japanese manufacturing. Provide Japanese-language executive summary.', confidenceScore:84 },
  { companyId:'comp-34', businessOverview:'PetroChem Global is one of the world\'s largest petrochemical companies headquartered in Riyadh, Saudi Arabia. They operate 12 refineries and 15,000km of pipelines across the Middle East and Asia. With 25,000+ employees and $45B annual revenue, they are a major player in the global energy market.', currentTechLandscape:'Legacy SCADA and DCS systems for pipeline and refinery monitoring. SAP for ERP and maintenance management. Manual pipeline inspection with physical patrols. No real-time leak detection capabilities. Analytics limited to monthly production reports. Some IoT sensors installed but not integrated.', potentialChallenges:'Extreme environment requirements for any deployed technology. Security and geopolitical considerations. Multiple regulatory jurisdictions. Aging infrastructure makes data integration complex. Need for Arabic language support. Government relations and local content requirements.', possibleOpportunities:'AI-based pipeline integrity monitoring could prevent the $50M+ in annual incident costs. Real-time leak detection system for 15,000km of pipelines. Predictive maintenance for refinery equipment. Automated environmental compliance monitoring and reporting. Digital twin for refinery operations optimization.', relevantServices:'IoT and AI for pipeline monitoring, Predictive Maintenance Platform, Data Analytics for real-time dashboards, Cloud Modernization for data infrastructure, NLP for regulatory document processing.', keyDecisionMakers:'Omar Hassan (VP Operations) - executive sponsor, CIO (name TBD) - technical evaluation, CEO - board-level approval. Government relations team must approve any foreign technology vendor. Security clearance required.', lastInteraction:'Initial meeting with Omar Hassan at their Riyadh headquarters on Dec 7. He shared that 3 pipeline incidents last year cost $50M+ in damages and regulatory fines. Strong urgency for AI-based monitoring solution.', nextAction:'Prepare comprehensive pipeline monitoring proposal with phased deployment plan. Address security and data sovereignty requirements. Include reference from similar oil & gas engagement. Plan site visit to pipeline control center.', confidenceScore:79 },
  { companyId:'comp-48', businessOverview:'Zenith Aerospace is a major defense and space contractor headquartered in Huntsville, AL. They design and manufacture satellite systems, missile defense components, and space exploration hardware. With 12,000+ employees and $8.5B annual revenue, they are a top-5 US defense contractor with extensive NASA and DoD contracts.', currentTechLandscape:'Mature enterprise architecture with classified and unclassified networks. Custom telemetry processing platform built 10 years ago struggling with modern data volumes. Batch processing with 6-hour latency for satellite data. Some ML models for component testing but no production MLOps. Extensive use of virtualization but limited cloud adoption due to classification requirements.', potentialChallenges:'Multiple security classification levels complicate architecture. All personnel require security clearances. DoD certification requirements (Authority to Operate) for any new system. Long procurement cycles aligned with government fiscal years. Rigorous testing and validation requirements.', possibleOpportunities:'Satellite telemetry data platform processing 100GB/hour with real-time anomaly detection. ML-powered predictive maintenance for satellite components. Automated test data analysis reducing validation time by 50%. Digital engineering for satellite design reviews.', relevantServices:'Machine Learning Engineering for MLOps in classified environments, Data Analytics for real-time telemetry processing, AI Process Automation for test and validation workflows, Cloud Modernization for hybrid cloud architecture.', keyDecisionMakers:'Robert Anderson (VP Space Systems) - executive sponsor, CTO (name TBD) - technical evaluation, CISO - security approval. DoD Program Manager - requirements and acceptance. Authority to Operate certification required.', lastInteraction:'Initial outreach via cleared channel on Dec 4. Received response from VP Space Systems requesting capability brief. Security questionnaire initiated. Preliminary discussions indicate strong need for real-time telemetry processing.', nextAction:'Submit security questionnaire responses and capability brief through cleared channels. Prepare for facility tour and technical interchange meeting in January. Ensure all materials are classified appropriately.', confidenceScore:72 },
  { companyId:'comp-49', businessOverview:'Optima Health Systems is a major integrated health system based in Calgary, Canada. They operate 8 hospitals and 150+ clinics across Alberta and British Columbia, serving 3M+ patients. With 10,000+ employees and C$3.2B annual revenue, they are one of Canada\'s largest provincial health authorities.', currentTechLandscape:'Epic EHR deployed across all facilities. Provincial health data sharing platform. Basic telehealth platform from 2020 pandemic deployment. Limited AI capabilities - only basic scheduling optimization. Patient triage is fully manual with 40-minute average wait times. No NLP or computer vision in production.', potentialChallenges:'Provincial health authority budget constraints and approval processes. Bilingual requirements (English/French). Health Canada regulatory approval needed for AI-assisted clinical tools. Union considerations for workflow changes. Data residency requirements within Canada.', possibleOpportunities:'AI-powered telehealth assistant for patient triage could reduce wait times by 70%. Predictive analytics for hospital bed management and staffing optimization. NLP for clinical documentation to reduce physician administrative burden. Automated health reporting for provincial and federal requirements.', relevantServices:'NLP for patient triage and clinical documentation, AI Process Automation for administrative workflows, Data Analytics for hospital operations, Document Intelligence for health records processing.', keyDecisionMakers:'Priya Sharma (VP Digital Health) - executive sponsor, CMIO (name TBD) - clinical validation, CFO - budget approval within provincial health authority. Health Canada approval needed for any clinical AI tool.', lastInteraction:'Video call with Priya Sharma on Dec 10. She confirmed the telehealth AI assistant is a top strategic priority for 2025. Budget of C$5M has been requested from the provincial government. Health Canada pre-consultation scheduled for January.', nextAction:'Prepare telehealth AI capability brief with clinical safety documentation. Include Canadian health data privacy compliance approach (PIPEDA + provincial). Prepare for Health Canada pre-consultation meeting.', confidenceScore:76 },
  { companyId:'comp-2', businessOverview:'TechVision Solutions is a mid-sized IT services and product company based in Bangalore, India. They provide software development, data engineering, and analytics services to clients in the US, UK, and Middle East. With 350 employees and $25M revenue, they are growing 40% YoY and exploring product-led growth.', currentTechLandscape:'Strong engineering team proficient in modern cloud-native technologies (AWS, GCP, Kubernetes). They build data pipelines and analytics products for clients but lack their own AI/ML capabilities. Internal tools are basic - Jira, Confluence, Slack. No proprietary AI technology or platform.', potentialChallenges:'Revenue model dependent on billable hours, making product investment difficult. Limited AI/ML talent in a competitive Bangalore market. Client concentration risk - top 3 clients represent 60% of revenue. Potential conflict between services and product strategies.', possibleOpportunities:'Partnership to co-develop a data engineering and analytics platform. White-label our AI capabilities as part of their service offerings. Joint go-to-market for manufacturing and healthcare verticals in India and Middle East. Technology knowledge transfer and training programs.', relevantServices:'Cloud Modernization, Data Analytics & BI, Machine Learning Engineering, NLP solutions. Potential for white-label partnership model.', keyDecisionMakers:'Rajesh Krishnan (CEO) - strategic decision maker, CTO (name TBD) - technical evaluation, VP Sales (name TBD) - go-to-market strategy. Board approval needed for any partnership or co-investment.', lastInteraction:'Video call with CEO Rajesh Krishnan on Dec 8. He proposed a partnership model where we provide AI capabilities and they provide delivery capacity. Revenue sharing model to be discussed. He wants a pilot project to validate the partnership.', nextAction:'Prepare partnership proposal with pilot project scope, revenue sharing model, and IP ownership terms. Identify 2-3 potential pilot projects from our pipeline that could use their delivery capacity.', confidenceScore:70 },
  { companyId:'comp-36', businessOverview:'AeroSpace Dynamics is a UK-based aerospace engineering company specializing in flight systems, avionics, and unmanned aerial vehicles. With 3,500 employees and £900M revenue, they serve both commercial aviation and defense sectors. Known for innovation in electric propulsion and autonomous flight systems.', currentTechLandscape:'Advanced engineering simulation tools (MATLAB/Simulink, ANSYS). Custom flight data recording systems producing 50TB/day of sensor data. Legacy data platform based on Oracle and Hadoop. Some MATLAB-based analytics but no modern ML pipeline. Flight test data processing takes days due to batch architecture.', potentialChallenges:'Airworthiness certification requirements for any AI system that touches flight operations. Strict data governance for defense-related programs. Limited cloud usage due to ITAR and UK MoD security requirements. Multi-site engineering teams across Bristol, Farnborough, and Preston.', possibleOpportunities:'Real-time flight data analytics platform reducing processing from days to hours. Predictive maintenance for aircraft components using sensor data. AI-powered anomaly detection for flight test data analysis. Automated regulatory compliance reporting for CAA and EASA.', relevantServices:'Data Analytics for flight data processing, Machine Learning Engineering for predictive models, AI Process Automation for compliance reporting, Cloud Modernization for hybrid architecture.', keyDecisionMakers:'Sakura Ito (Head of Flight Data Analytics) - technical champion, VP Engineering (name TBD) - implementation, CTO - strategic direction. CAA certification may be required for operational AI systems.', lastInteraction:'Initial call with Sakura Ito on Dec 12. She has a PhD in aerospace engineering and immediately understood the value of modern data platforms. She is preparing an internal business case for the flight data analytics platform.', nextAction:'Support Sakura\'s business case with technical architecture options and cost-benefit analysis. Prepare flight data processing benchmark using sample datasets. Plan on-site visit to Bristol engineering center.', confidenceScore:74 },
  { companyId:'comp-43', businessOverview:'Summit Manufacturing is a premium German automotive components manufacturer based in Stuttgart. They produce precision-engineered powertrain, chassis, and interior components for BMW, Mercedes-Benz, and Porsche. With 7,000 employees and €1.8B revenue, they are known for exceptional quality and innovation.', currentTechLandscape:'Industry-leading factory automation with extensive robotics and IoT sensors. SAP S/4HANA fully deployed. Advanced PLM with Siemens Teamcenter. However, quality inspection still relies on trained human inspectors for final validation. No AI/ML models in production despite generating massive sensor datasets.', potentialChallenges:'German engineering culture demands perfection - any AI solution must demonstrate near-zero false negative rates. Strong works council (Betriebsrat) involvement in technology decisions affecting workers. "Made in Germany" quality reputation creates high risk tolerance threshold. Tendency to prefer domestic technology vendors.', possibleOpportunities:'AI-powered visual quality inspection as a second pair of eyes for human inspectors (augmentation, not replacement). Predictive maintenance for their precision machining equipment. Digital twin of their most complex assembly line. Energy optimization across their 5 German plants to meet 2030 carbon neutrality goals.', relevantServices:'AI Process Automation for quality inspection, Predictive Maintenance Platform, Data Analytics for manufacturing intelligence, ML Engineering for quality prediction models.', keyDecisionMakers:'Lars Schmidt (VP Manufacturing Technology) - technical sponsor, Plant Directors (5) - implementation approval, CTO - strategic technology decisions. Works council consultation required for any workflow changes.', lastInteraction:'Video conference with Lars Schmidt on Dec 11. He is practical and ROI-focused. He wants to see clear payback within 12 months. He suggested starting with the highest-impact use case: visual quality inspection on the BMW steering column assembly line.', nextAction:'Prepare phased approach proposal starting with visual quality inspection POC on one assembly line. Include detailed ROI projections with German engineering quality benchmarks. Address works council engagement plan.', confidenceScore:77 },
  { companyId:'comp-50', businessOverview:'TidalWave Energy is a pioneering marine energy company based in Glasgow, UK. They design, build, and operate tidal energy installations with 200+ turbines deployed across the UK, Canada, and France. With 250 employees and £60M revenue, they are a leader in the emerging tidal energy sector.', currentTechLandscape:'Remote monitoring systems for tidal turbines with basic SCADA integration. Oceanographic data collection systems. Energy production forecasting based on simple tidal models. No ML/AI despite 5+ years of operational data. Manual maintenance scheduling based on calendar intervals rather than condition.', potentialChallenges:'Harsh marine environment limits sensor reliability and data quality. Small company with limited internal IT capabilities. Tidal energy is still emerging - limited reference architectures for AI applications. Budget constraints as the company is not yet profitable. Remote site access for installation and maintenance.', possibleOpportunities:'ML-based tidal energy production forecasting could improve accuracy by 30%+ over current tide-table models. Predictive maintenance for underwater turbine components could reduce maintenance costs by 40%. Automated environmental impact monitoring and reporting. Grid integration optimization for variable tidal output.', relevantServices:'Machine Learning Engineering for forecasting models, Predictive Maintenance Platform, Data Analytics for operational dashboards, Cloud Modernization for data infrastructure.', keyDecisionMakers:'Wei Wang (Head of Operations) - domain expert and sponsor, CEO (name TBD) - budget approval. CTO is part-time consultant. Wei is the primary technical decision maker with deep renewable energy expertise.', lastInteraction:'Call with Wei Wang on Dec 13. He is skeptical of generic ML approaches and wants physics-informed models that incorporate tidal mechanics. He has 5 years of production and oceanographic data available for model training.', nextAction:'Research physics-informed neural networks for tidal energy forecasting. Prepare a technical approach that combines domain physics with ML. Request sample datasets to validate feasibility before formal proposal.', confidenceScore:65 },
  { companyId:'comp-3', businessOverview:'Global Finance Corp is a major international banking and financial services company headquartered in London. With operations in 40+ countries, 35,000+ employees, and £25B annual revenue, they provide retail banking, corporate banking, investment management, and insurance services to millions of customers worldwide.', currentTechLandscape:'Legacy core banking systems built on mainframes with modern digital layers on top. Private cloud infrastructure with some AWS usage for non-critical workloads. Risk analytics running on a 5-year-old Hadoop cluster. Advanced fraud detection using rules-based systems. Limited AI/ML adoption despite significant data assets.', potentialChallenges:'Massive technical debt from decades of legacy system accumulation. Regulatory scrutiny (PRA, FCA) for any technology changes in banking systems. Data silos across business units and geographies. Change management across a large, complex organization. Security and resilience requirements for critical banking infrastructure.', possibleOpportunities:'Modernization of risk analytics platform from Hadoop to cloud-native architecture with real-time processing. AI-powered fraud detection to replace rules-based systems. Automated regulatory reporting for PRA stress testing. Customer intelligence platform consolidating data from 40+ countries.', relevantServices:'Cloud Modernization for risk analytics migration, Data Analytics for customer intelligence, AI Process Automation for regulatory reporting, ML Engineering for fraud detection models.', keyDecisionMakers:'CIO (name TBD) - strategic technology direction, Head of Risk Analytics - domain sponsor, CRO - regulatory approval. Group Technology Committee approval required for any major technology investment.', lastInteraction:'Initial outreach email sent on Dec 3. Received referral from a mutual contact at a London fintech event. Awaiting response from the CIO office. No direct meetings scheduled yet.', nextAction:'Follow up on outreach email with a value proposition focused on risk analytics modernization. Leverage mutual contact for warm introduction to CIO. Prepare London banking sector capability overview.', confidenceScore:58 },
];

// ─── Capability Documents (8) ───────────────────────────────────────────────

const capabilityDocuments = [
  { id:'cap-1', title:'AI Process Automation', docType:'PDF', description:'End-to-end AI-powered process automation services for enterprise workflows', fileName:'AI_Process_Automation_Capability.pdf', content:'Our AI Process Automation services help enterprises eliminate manual workflows, reduce processing time by 60-80%, and improve accuracy across document processing, data extraction, and decision workflows. We combine computer vision, NLP, and machine learning to automate complex business processes that traditionally require human judgment. Our solutions integrate seamlessly with existing enterprise systems including SAP, Salesforce, and custom applications.' },
  { id:'cap-2', title:'Cloud Modernization', docType:'DOCX', description:'Comprehensive cloud migration and modernization services for legacy enterprise systems', fileName:'Cloud_Modernization_Services.docx', content:'We help organizations migrate legacy applications to modern cloud architectures. Specializing in AWS, Azure, and GCP platforms with zero-downtime strategies and cost optimization. Our approach covers assessment, planning, migration, and optimization phases with proven methodologies for SAP, Oracle, and custom application modernization. We have successfully migrated 200+ enterprise applications with an average 40% cost reduction.' },
  { id:'cap-3', title:'Data Analytics & Business Intelligence', docType:'PDF', description:'Advanced analytics and business intelligence solutions for data-driven decision making', fileName:'Data_Analytics_BI_Platform.pdf', content:'Transform raw data into actionable business intelligence with modern data platforms and real-time analytics dashboards. From data warehousing to self-service BI for business users. Our solutions leverage cloud-native data platforms like Snowflake, Databricks, and BigQuery combined with visualization tools like Tableau and Power BI. We help organizations build modern data lakehouse architectures that support both batch and real-time analytics.' },
  { id:'cap-4', title:'Document Intelligence', docType:'PDF', description:'AI-powered document processing and intelligent data extraction services', fileName:'Document_Intelligence_Platform.pdf', content:'Extract structured data from unstructured documents using advanced NLP and computer vision. Supports invoices, contracts, medical records, regulatory documents, and custom formats. Our document intelligence platform achieves 99.5% accuracy on standard document types and can be fine-tuned for domain-specific documents. We process millions of documents daily for enterprise clients across healthcare, finance, and manufacturing.' },
  { id:'cap-5', title:'Machine Learning Engineering & MLOps', docType:'MD', description:'Production-grade ML pipeline development and MLOps platform services', fileName:'MLEngineering_MLOps.md', content:'# Machine Learning Engineering & MLOps\n\nDesign, build, and deploy production ML systems with robust MLOps practices. Model training, versioning, monitoring, and scaling for enterprise workloads.\n\n## Capabilities\n- End-to-end ML lifecycle management from data preparation to model deployment and monitoring\n- Supports TensorFlow, PyTorch, and scikit-learn with automated retraining pipelines\n- Model registry, A/B testing, and canary deployment strategies\n- Real-time model monitoring with automated alerting and drift detection' },
  { id:'cap-6', title:'Natural Language Processing Solutions', docType:'DOCX', description:'Advanced NLP solutions for text understanding, generation, and analysis', fileName:'NLP_Solutions_Overview.docx', content:'Custom NLP solutions including sentiment analysis, entity recognition, document summarization, chatbots, and content recommendation engines. Our NLP capabilities span multiple languages and domains with state-of-the-art transformer-based models. We have deployed NLP solutions processing over 100M documents daily across healthcare, legal, and financial services sectors. Our models support fine-tuning for domain-specific terminology and requirements.' },
  { id:'cap-7', title:'Predictive Maintenance Platform', docType:'PDF', description:'IoT-integrated predictive maintenance solutions for industrial operations', fileName:'Predictive_Maintenance_Platform.pdf', content:'Our Predictive Maintenance Platform combines IoT sensor data with machine learning to predict equipment failures before they occur. We integrate with existing SCADA, MES, and CMMS systems to provide real-time health monitoring and predictive analytics. Our solutions have been deployed across manufacturing, energy, transportation, and aerospace sectors, reducing unplanned downtime by 30-50% and maintenance costs by 20-40%.' },
  { id:'cap-8', title:'Cybersecurity AI Solutions', docType:'TXT', description:'AI-powered cybersecurity solutions for threat detection and response', fileName:'Cybersecurity_AI_Solutions.txt', content:'AI-Powered Cybersecurity Solutions\n================================\n\nOur cybersecurity AI solutions provide advanced threat detection, automated incident response, and security analytics for enterprise environments.\n\nCore Capabilities:\n- Real-time threat detection using deep learning models analyzing network traffic, endpoints, and cloud workloads\n- Automated incident response with playbook-driven remediation\n- User and entity behavior analytics (UEBA) for insider threat detection\n- AI-powered vulnerability management and risk scoring\n- Natural language security query interface for security operations teams\n\nOur platform processes over 10 billion security events daily and has demonstrated 95% detection rate with less than 0.1% false positive rate across enterprise deployments.' },
];

// ─── Capability Snippets (50+) ──────────────────────────────────────────────

const capabilitySnippets = [
  // cap-1: AI Process Automation (8 snippets)
  { documentId:'cap-1', snippetType:'capability', title:'Document Intelligence', content:'AI-powered extraction and processing of invoices, purchase orders, contracts, and compliance documents. Reduces manual data entry by 80% with 99.5% field-level accuracy. Supports 50+ document formats including handwritten forms and multi-page documents.', industries:'Manufacturing, Finance, Healthcare, Legal', outcomes:'80% reduction in manual processing, 99.5% accuracy, 24/7 operation' },
  { documentId:'cap-1', snippetType:'case_study', title:'Manufacturing QC Automation', content:'Implemented AI-powered quality inspection for a Fortune 500 manufacturer. Reduced defect detection time from 45 minutes to 3 minutes per unit. System processes 10,000+ inspection images daily with 99.7% accuracy, catching defects that human inspectors miss 15% of the time.', industries:'Manufacturing, Automotive, Electronics', outcomes:'15x faster inspection, $2.5M annual savings, 40% defect reduction' },
  { documentId:'cap-1', snippetType:'case_study', title:'Insurance Claims Automation', content:'Automated claims processing for a top-10 US insurer. Processes 200K+ claims/month with 98.7% accuracy, reducing processing time from 45 minutes to 3 minutes per claim. The system handles motor, property, and health insurance claims with domain-specific extraction rules.', industries:'Insurance, Finance', outcomes:'95% cost reduction, 15x faster processing, $12M annual savings' },
  { documentId:'cap-1', snippetType:'capability', title:'Workflow Orchestration', content:'Intelligent workflow orchestration engine that automates complex multi-step business processes. Supports conditional branching, parallel processing, human-in-the-loop approval, and integration with 100+ enterprise systems via pre-built connectors.', industries:'All Industries', outcomes:'70% faster process completion, 90% reduction in human errors' },
  { documentId:'cap-1', snippetType:'capability', title:'Intelligent Data Extraction', content:'Multi-modal data extraction combining OCR, NLP, and computer vision to extract structured data from any document format. Handles tables, forms, handwritten text, and embedded images. Supports extraction from PDFs, images, emails, and scanned documents.', industries:'Finance, Healthcare, Legal, Government', outcomes:'99% extraction accuracy, 60% faster data processing' },
  { documentId:'cap-1', snippetType:'metric', title:'Automation ROI Benchmarks', content:'Average ROI across 150+ automation deployments: 340% return in first year, 65% reduction in processing costs, 80% improvement in throughput, 99.2% accuracy improvement, and 70% reduction in FTE requirements for automated processes.', industries:'All Industries', outcomes:'340% first-year ROI, 65% cost reduction' },
  { documentId:'cap-1', snippetType:'case_study', title:'Healthcare Claims Processing', content:'Deployed AI document processing for a major health network processing 50K+ insurance claims monthly. Automated extraction of patient demographics, diagnosis codes, procedure codes, and billing amounts. Reduced claim turnaround from 5 days to 4 hours.', industries:'Healthcare, Insurance', outcomes:'97% faster turnaround, $3M annual savings, 15% error reduction' },
  { documentId:'cap-1', snippetType:'capability', title:'Intelligent Classification', content:'AI-powered document classification and routing system that automatically categorizes incoming documents by type, priority, and department. Achieves 98% classification accuracy across 200+ document categories with continuous learning from user corrections.', industries:'All Industries', outcomes:'98% classification accuracy, 90% reduction in manual sorting' },

  // cap-2: Cloud Modernization (7 snippets)
  { documentId:'cap-2', snippetType:'capability', title:'Application Migration', content:'Systematic migration of legacy applications to cloud-native architectures with zero-downtime strategies. Specialized in SAP, Oracle, and custom application modernization. Our phased approach minimizes business disruption while maximizing cloud benefits.', industries:'Technology, Finance, Healthcare, Manufacturing', outcomes:'Zero downtime migration, 40% cost reduction' },
  { documentId:'cap-2', snippetType:'case_study', title:'Enterprise SAP Migration', content:'Migrated a global manufacturer\'s SAP ECC 6.0 to S/4HANA on Azure with zero production downtime. 18-month program covering 12 business units across 8 countries. Achieved 35% infrastructure cost reduction and 60% improvement in report generation performance.', industries:'Manufacturing, Automotive', outcomes:'Zero downtime, 35% cost savings, 60% performance gain' },
  { documentId:'cap-2', snippetType:'capability', title:'Cloud Cost Optimization', content:'Comprehensive cloud cost optimization service covering right-sizing, reserved instances, spot instances, and architecture optimization. Average savings of 40-60% on cloud infrastructure costs without performance degradation.', industries:'All Industries', outcomes:'40-60% cost savings on cloud infrastructure' },
  { documentId:'cap-2', snippetType:'case_study', title:'Data Center Consolidation', content:'Consolidated 4 regional data centers into 2 cloud regions for a financial services company. Migrated 300+ applications and 50PB of data over 24 months. Achieved 99.99% availability and 50% reduction in infrastructure costs.', industries:'Finance, Insurance', outcomes:'50% cost reduction, 99.99% availability, 300+ apps migrated' },
  { documentId:'cap-2', snippetType:'capability', title:'Containerization & Kubernetes', content:'Modernize legacy applications through containerization and Kubernetes orchestration. We handle monolith-to-microservices decomposition, Docker containerization, Kubernetes cluster design, and CI/CD pipeline setup for cloud-native deployment.', industries:'Technology, Finance, Healthcare', outcomes:'70% faster deployments, 3x improved scalability' },
  { documentId:'cap-2', snippetType:'capability', title:'Hybrid Cloud Architecture', content:'Design and implement hybrid cloud architectures that span on-premises data centers and public cloud providers. Secure connectivity, data synchronization, and workload placement optimization for compliance-sensitive industries.', industries:'Finance, Healthcare, Government, Aerospace', outcomes:'Optimal workload placement, regulatory compliance, reduced risk' },
  { documentId:'cap-2', snippetType:'metric', title:'Migration Success Metrics', content:'Across 200+ cloud migration projects: 99.7% migration success rate, average 37% cost reduction, 45% improvement in application performance, 80% reduction in infrastructure management overhead, and average payback period of 14 months.', industries:'All Industries', outcomes:'99.7% success rate, 37% cost reduction, 14-month payback' },

  // cap-3: Data Analytics & BI (7 snippets)
  { documentId:'cap-3', snippetType:'capability', title:'Executive Dashboards', content:'Real-time executive dashboards consolidating data from multiple sources into actionable insights. Self-service BI for business users with drag-and-drop report building. Supports 50+ data connectors out of the box with custom connector development.', industries:'All Industries', outcomes:'70% reduction in report generation time, real-time insights' },
  { documentId:'cap-3', snippetType:'case_study', title:'Retail Analytics Platform', content:'Built a unified analytics platform for a top-20 retailer with 500+ stores. Consolidated POS, inventory, customer, and marketing data into a single data lakehouse. Enabled real-time inventory optimization saving $15M annually in reduced stockouts and overstock.', industries:'Retail, E-commerce', outcomes:'$15M annual savings, 30% reduction in stockouts' },
  { documentId:'cap-3', snippetType:'capability', title:'Data Lakehouse Architecture', content:'Modern data lakehouse architecture combining the flexibility of data lakes with the performance of data warehouses. Built on Databricks, Snowflake, or BigQuery with Delta Lake or Apache Iceberg for ACID transactions and time travel.', industries:'All Industries', outcomes:'10x query performance improvement, unified data platform' },
  { documentId:'cap-3', snippetType:'case_study', title:'Financial Risk Analytics', content:'Built a real-time risk analytics platform for a global bank processing 100M+ transactions daily. Replaced legacy Hadoop cluster with modern cloud-native architecture achieving 100x faster query performance and 60% cost reduction.', industries:'Finance, Banking, Insurance', outcomes:'100x faster queries, 60% cost reduction, real-time risk scoring' },
  { documentId:'cap-3', snippetType:'capability', title:'Self-Service Analytics', content:'Empower business users with self-service analytics tools that require no SQL or coding knowledge. Natural language query interface, automated insight generation, and collaborative analytics workspaces. Governed data access with row-level security.', industries:'All Industries', outcomes:'5x increase in analytics adoption, 80% reduction in IT report requests' },
  { documentId:'cap-3', snippetType:'capability', title:'Streaming Analytics', content:'Real-time streaming analytics for time-sensitive use cases. Process millions of events per second with sub-second latency using Apache Kafka, Flink, or Spark Streaming. Ideal for fraud detection, IoT analytics, and real-time operational monitoring.', industries:'Finance, Technology, Manufacturing, Energy', outcomes:'Millions of events/sec, sub-second latency' },
  { documentId:'cap-3', snippetType:'metric', title:'Analytics Impact Metrics', content:'Average impact across 100+ analytics deployments: 5x faster decision making, 70% reduction in report backlogs, $8M average annual value from data-driven insights, 90% data freshness improvement, and 4x increase in data-driven culture adoption.', industries:'All Industries', outcomes:'5x faster decisions, $8M average annual value' },

  // cap-4: Document Intelligence (7 snippets)
  { documentId:'cap-4', snippetType:'capability', title:'Regulatory Document Processing', content:'Automated extraction and validation of regulatory submission documents. Supports FDA, EMA, and global regulatory formats with compliance-aware processing. Pre-trained models for IND, NDA, ANDA, and MAA submission documents.', industries:'Pharmaceuticals, Healthcare, Finance', outcomes:'75% faster document preparation, 99% compliance rate' },
  { documentId:'cap-4', snippetType:'case_study', title:'Contract Analysis Platform', content:'Built an AI contract analysis platform for a top-10 law firm processing 50K+ contracts annually. Automated extraction of key clauses, risk identification, and obligation tracking. Reduced contract review time from 4 hours to 15 minutes per contract.', industries:'Legal, Finance, Real Estate', outcomes:'94% faster review, $4M annual savings in legal costs' },
  { documentId:'cap-4', snippetType:'capability', title:'Medical Document Processing', content:'Specialized document intelligence for healthcare: clinical notes, discharge summaries, lab reports, and imaging reports. HIPAA-compliant processing with de-identification capabilities. Pre-trained models for ICD-10, CPT, and HCPCS code extraction.', industries:'Healthcare, Pharmaceuticals, Insurance', outcomes:'95% code extraction accuracy, HIPAA compliant' },
  { documentId:'cap-4', snippetType:'case_study', title:'Invoice Processing Automation', content:'Automated invoice processing for a manufacturing conglomerate handling 100K+ invoices monthly across 30 countries and 15 languages. Achieved 99.2% accuracy on line-item extraction with automated matching to purchase orders and delivery receipts.', industries:'Manufacturing, Logistics, Retail', outcomes:'99.2% accuracy, 85% processing cost reduction' },
  { documentId:'cap-4', snippetType:'capability', title:'Table Extraction', content:'Advanced table extraction from complex documents including nested tables, merged cells, and multi-page tables. Preserves spatial relationships and hierarchical structures. Handles both digital and scanned PDF documents with equal accuracy.', industries:'All Industries', outcomes:'97% table extraction accuracy, supports complex layouts' },
  { documentId:'cap-4', snippetType:'capability', title:'Custom Model Training', content:'Fine-tune document intelligence models for domain-specific document types with as few as 100 labeled examples. Active learning workflow reduces labeling effort by 80%. Continuous improvement through human-in-the-loop feedback.', industries:'All Industries', outcomes:'80% less labeling effort, domain-specific accuracy' },
  { documentId:'cap-4', snippetType:'metric', title:'Document Processing KPIs', content:'Platform performance benchmarks across 50M+ documents processed: 99.5% average accuracy, 200ms average processing time per page, 50+ supported languages, 100+ pre-trained document types, and 99.9% system uptime.', industries:'All Industries', outcomes:'99.5% accuracy, 200ms/page, 50+ languages' },

  // cap-5: ML Engineering & MLOps (6 snippets)
  { documentId:'cap-5', snippetType:'capability', title:'MLOps Platform', content:'End-to-end ML lifecycle management from data preparation to model deployment and monitoring. Supports TensorFlow, PyTorch, and scikit-learn with automated retraining pipelines. Feature store, model registry, and experiment tracking included.', industries:'Technology, Finance, Healthcare, Manufacturing', outcomes:'3x faster model deployment, 50% reduction in ML operations cost' },
  { documentId:'cap-5', snippetType:'case_study', title:'ML Platform for FinTech', content:'Built a centralized MLOps platform for a FinTech company managing 25+ ML models in production. Reduced model deployment time from 4 weeks to 2 days. Implemented automated retraining reducing model staleness by 90%.', industries:'Finance, Technology', outcomes:'14x faster deployment, 90% reduction in stale models' },
  { documentId:'cap-5', snippetType:'capability', title:'Model Monitoring & Observability', content:'Real-time model monitoring with automated drift detection, performance tracking, and alerting. Dashboard for model health across all production models. Automated retraining triggers based on data drift and performance degradation thresholds.', industries:'All Industries', outcomes:'99% model uptime, proactive drift detection' },
  { documentId:'cap-5', snippetType:'capability', title:'Feature Engineering Platform', content:'Centralized feature engineering platform with feature store for consistent feature computation across training and serving. Supports batch and real-time feature computation. Feature versioning, lineage tracking, and automated feature quality monitoring.', industries:'Technology, Finance, Healthcare', outcomes:'60% reduction in feature engineering time, consistency across models' },
  { documentId:'cap-5', snippetType:'case_study', title:'Healthcare ML Pipeline', content:'Designed and implemented a healthcare ML pipeline for a pharmaceutical company processing clinical trial data. Automated data validation, feature engineering, model training, and clinical reporting. Reduced model development cycle from 3 months to 3 weeks.', industries:'Healthcare, Pharmaceuticals', outcomes:'4x faster development cycle, automated clinical reporting' },
  { documentId:'cap-5', snippetType:'metric', title:'MLOps Impact Metrics', content:'Average impact across 75+ MLOps engagements: 10x faster model deployment, 60% reduction in ML operations cost, 85% improvement in model reliability, 40% reduction in data science team operational overhead.', industries:'All Industries', outcomes:'10x faster deployment, 60% cost reduction' },

  // cap-6: NLP Solutions (6 snippets)
  { documentId:'cap-6', snippetType:'capability', title:'Sentiment Analysis', content:'Real-time sentiment analysis for customer feedback, social media, and support tickets. Multi-language support with industry-specific fine-tuning. Handles sarcasm, context-dependent sentiment, and aspect-based analysis for granular insights.', industries:'Media, Retail, Healthcare, Finance', outcomes:'92% accuracy, real-time processing, 30+ languages' },
  { documentId:'cap-6', snippetType:'case_study', title:'Legal Document Analysis', content:'Built NLP-powered legal document analysis system for a top-20 law firm. Automated contract review, due diligence, and regulatory compliance checking. Processes 10K+ legal documents daily, extracting key clauses, obligations, and risk indicators.', industries:'Legal, Finance, Real Estate', outcomes:'90% faster due diligence, $6M annual savings' },
  { documentId:'cap-6', snippetType:'capability', title:'Content Recommendation', content:'NLP-powered content recommendation engine using transformer-based models. Understands content semantics, user preferences, and contextual relevance. Supports multi-modal recommendations combining text, images, and behavioral signals.', industries:'Media, E-commerce, Education', outcomes:'35% increase in engagement, 25% increase in conversion' },
  { documentId:'cap-6', snippetType:'case_study', title:'Customer Support Automation', content:'Deployed NLP-powered chatbot and email classification for a telecom company handling 5M+ support interactions monthly. Automated 60% of tier-1 support requests with 94% customer satisfaction score. Reduced average response time from 4 hours to 30 seconds.', industries:'Telecommunications, Retail, Financial Services', outcomes:'60% automation rate, 94% CSAT, 30-second response time' },
  { documentId:'cap-6', snippetType:'capability', title:'Document Summarization', content:'AI-powered document summarization for long-form content. Extractive and abstractive summarization with configurable length and style. Supports technical documents, legal briefs, research papers, and business reports with domain-specific fine-tuning.', industries:'Legal, Healthcare, Consulting, Research', outcomes:'80% time savings in document review, maintains key information' },
  { documentId:'cap-6', snippetType:'capability', title:'Entity Recognition & Linking', content:'Custom named entity recognition (NER) and entity linking for domain-specific entities. Pre-trained models for people, organizations, locations, dates, and monetary amounts. Fine-tunable for medical terms, legal citations, product names, and industry jargon.', industries:'Healthcare, Legal, Finance, Government', outcomes:'95% entity recognition accuracy, domain-adaptable' },

  // cap-7: Predictive Maintenance (5 snippets)
  { documentId:'cap-7', snippetType:'capability', title:'Equipment Health Monitoring', content:'Real-time equipment health monitoring combining IoT sensor data with ML models. Detects anomalies, predicts failures, and recommends maintenance actions. Integrates with existing SCADA, MES, and CMMS systems via standard protocols.', industries:'Manufacturing, Energy, Transportation, Aerospace', outcomes:'50% reduction in unplanned downtime, 30% maintenance cost savings' },
  { documentId:'cap-7', snippetType:'case_study', title:'Manufacturing Predictive Maintenance', content:'Deployed predictive maintenance for a global manufacturer with 2,000+ machines across 8 plants. Predicted equipment failures 72 hours in advance with 89% accuracy. Reduced unplanned downtime by 45% and maintenance costs by $4M annually.', industries:'Manufacturing, Automotive', outcomes:'45% less downtime, $4M annual savings, 89% prediction accuracy' },
  { documentId:'cap-7', snippetType:'capability', title:'Remaining Useful Life Prediction', content:'ML models for predicting remaining useful life (RUL) of industrial equipment. Uses sensor data, maintenance history, and operating conditions to estimate time-to-failure. Supports multiple degradation models for different equipment types.', industries:'Manufacturing, Energy, Aerospace, Transportation', outcomes:'85% RUL prediction accuracy, optimized maintenance scheduling' },
  { documentId:'cap-7', snippetType:'case_study', title:'Energy Pipeline Monitoring', content:'AI-based pipeline integrity monitoring for an oil & gas company with 5,000km of pipelines. Integrated 10,000+ IoT sensors with ML models for leak detection, corrosion prediction, and structural health monitoring. Prevented 12 potential incidents in the first year.', industries:'Energy, Oil & Gas, Utilities', outcomes:'12 incidents prevented, $50M+ in avoided costs' },
  { documentId:'cap-7', snippetType:'metric', title:'Predictive Maintenance KPIs', content:'Performance benchmarks across 50+ deployments: 87% average prediction accuracy, 45% reduction in unplanned downtime, 30% maintenance cost reduction, 20% extension of equipment lifespan, and average ROI of 280% in the first year.', industries:'Manufacturing, Energy, Transportation, Aerospace', outcomes:'87% accuracy, 280% first-year ROI' },

  // cap-8: Cybersecurity AI (5 snippets)
  { documentId:'cap-8', snippetType:'capability', title:'Threat Detection AI', content:'Deep learning models for real-time network threat detection. Analyzes traffic patterns, endpoints, and cloud workloads to identify zero-day threats, advanced persistent threats, and insider threats. Processes 10B+ events daily with sub-second detection latency.', industries:'Finance, Healthcare, Government, Technology', outcomes:'95% detection rate, 0.1% false positive rate' },
  { documentId:'cap-8', snippetType:'case_study', title:'Financial Services SOC', content:'Deployed AI-powered SOC automation for a global bank processing 5B+ security events daily. Automated 70% of tier-1 security alerts, reducing mean time to detect from 48 hours to 15 minutes. Identified 3 APT campaigns in the first 6 months.', industries:'Finance, Banking, Insurance', outcomes:'70% alert automation, 192x faster detection' },
  { documentId:'cap-8', snippetType:'capability', title:'User Behavior Analytics', content:'AI-powered user and entity behavior analytics (UEBA) for insider threat detection. Establishes behavioral baselines for every user and entity, detecting anomalies that indicate compromised accounts, data exfiltration, or policy violations.', industries:'Finance, Healthcare, Government, Technology', outcomes:'90% insider threat detection rate, 85% reduction in false positives' },
  { documentId:'cap-8', snippetType:'capability', title:'Automated Incident Response', content:'AI-driven automated incident response with playbook orchestration. Detects, investigates, and remediates security incidents in seconds rather than hours. Integrates with SIEM, SOAR, and endpoint detection platforms for coordinated response.', industries:'All Industries', outcomes:'95% faster incident response, 60% reduction in analyst workload' },
  { documentId:'cap-8', snippetType:'metric', title:'Security AI Performance', content:'Performance benchmarks across 30+ enterprise deployments: 95% threat detection rate, 0.1% false positive rate, 70% alert automation, 15-minute average time to detect (vs 48-hour industry average), and 85% reduction in SOC analyst workload.', industries:'All Industries', outcomes:'95% detection, 0.1% FPR, 192x faster MTTD' },
];

// ─── Email Health Checks (15+) ──────────────────────────────────────────────

const emailHealthChecks = [
  { contactId:'cont-1', status:'valid', score:95, actionRecommendation:'allow', syntaxOk:true, domainOk:true, mxOk:true, disposableOk:true },
  { contactId:'cont-2', status:'valid', score:92, actionRecommendation:'allow', syntaxOk:true, domainOk:true, mxOk:true, disposableOk:true },
  { contactId:'cont-4', status:'invalid', score:0, actionRecommendation:'block', syntaxOk:false, domainOk:false, mxOk:false, disposableOk:false },
  { contactId:'cont-10', status:'risky', score:62, actionRecommendation:'review', syntaxOk:true, domainOk:true, mxOk:false, disposableOk:true },
  { contactId:'cont-14', status:'valid', score:97, actionRecommendation:'allow', syntaxOk:true, domainOk:true, mxOk:true, disposableOk:true },
  { contactId:'cont-17', status:'risky', score:55, actionRecommendation:'review', syntaxOk:true, domainOk:true, mxOk:false, disposableOk:true },
  { contactId:'cont-22', status:'invalid', score:8, actionRecommendation:'block', syntaxOk:true, domainOk:false, mxOk:false, disposableOk:false },
  { contactId:'cont-24', status:'risky', score:58, actionRecommendation:'review', syntaxOk:true, domainOk:true, mxOk:false, disposableOk:true },
  { contactId:'cont-28', status:'valid', score:94, actionRecommendation:'allow', syntaxOk:true, domainOk:true, mxOk:true, disposableOk:true },
  { contactId:'cont-31', status:'valid', score:91, actionRecommendation:'allow', syntaxOk:true, domainOk:true, mxOk:true, disposableOk:true },
  { contactId:'cont-34', status:'risky', score:60, actionRecommendation:'review', syntaxOk:true, domainOk:true, mxOk:false, disposableOk:true },
  { contactId:'cont-40', status:'invalid', score:3, actionRecommendation:'block', syntaxOk:false, domainOk:false, mxOk:false, disposableOk:false },
  { contactId:'cont-44', status:'risky', score:54, actionRecommendation:'review', syntaxOk:true, domainOk:true, mxOk:false, disposableOk:true },
  { contactId:'cont-48', status:'invalid', score:5, actionRecommendation:'block', syntaxOk:false, domainOk:false, mxOk:false, disposableOk:false },
  { contactId:'cont-54', status:'risky', score:50, actionRecommendation:'review', syntaxOk:true, domainOk:true, mxOk:false, disposableOk:true },
  { contactId:'cont-57', status:'valid', score:88, actionRecommendation:'allow', syntaxOk:true, domainOk:true, mxOk:true, disposableOk:true },
  { contactId:'cont-66', status:'valid', score:93, actionRecommendation:'allow', syntaxOk:true, domainOk:true, mxOk:true, disposableOk:true },
  { contactId:'cont-75', status:'valid', score:96, actionRecommendation:'allow', syntaxOk:true, domainOk:true, mxOk:true, disposableOk:true },
];

// ─── Import Batches (3) ─────────────────────────────────────────────────────

const importBatches = [
  { fileName:'Global_Leads_Master_Q3.csv', fileHash:'sha256-glm2024q3master', totalRows:45200, acceptedRows:42800, duplicateRows:1800, invalidRows:600, status:'completed' },
  { fileName:'APAC_Tech_Companies.csv', fileHash:'sha256-apac2024tech', totalRows:12500, acceptedRows:11900, duplicateRows:420, invalidRows:180, status:'completed' },
  { fileName:'EMEA_Industry_Leaders.csv', fileHash:'sha256-emea2024ind', totalRows:28300, acceptedRows:26700, duplicateRows:1200, invalidRows:400, status:'completed' },
];

// ─── Main Seed Function ─────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Seeding DeepMindQ database...');

  // 1. Clear all data in correct dependency order
  console.log('  Clearing existing data...');
  await db.$transaction([
    db.capabilitySnippet.deleteMany(),
    db.companyNote.deleteMany(),
    db.contactNote.deleteMany(),
    db.emailHealthCheck.deleteMany(),
    db.draft.deleteMany(),
    db.timelineEntry.deleteMany(),
    db.opportunity.deleteMany(),
    db.contact.deleteMany(),
    db.companyResearchCard.deleteMany(),
    db.company.deleteMany(),
    db.importBatch.deleteMany(),
    db.capabilityDocument.deleteMany(),
    db.userPreferences.deleteMany(),
  ]);
  console.log('  Data cleared.');

  // 2. Import Batches
  console.log('  Creating import batches...');
  await db.importBatch.createMany({ data: importBatches });
  console.log(`  ✓ ${importBatches.length} import batches`);

  // 3. Capability Documents
  console.log('  Creating capability documents...');
  for (const doc of capabilityDocuments) {
    await db.capabilityDocument.upsert({ where: { id: doc.id }, update: doc, create: doc });
  }
  console.log(`  ✓ ${capabilityDocuments.length} capability documents`);

  // 4. Capability Snippets
  console.log('  Creating capability snippets...');
  await db.capabilitySnippet.createMany({ data: capabilitySnippets });
  console.log(`  ✓ ${capabilitySnippets.length} capability snippets`);

  // 5. User Preferences
  console.log('  Creating user preferences...');
  await db.userPreferences.upsert({ where: { id: 'pref-1' }, update: {}, create: { id: 'pref-1' } });
  console.log('  ✓ 1 user preferences');

  // 6. Companies
  console.log('  Creating companies...');
  for (const comp of companies) {
    await db.company.upsert({
      where: { id: comp.id },
      update: comp,
      create: comp,
    });
  }
  console.log(`  ✓ ${companies.length} companies`);

  // 7. Contacts
  console.log('  Creating contacts...');
  await db.contact.createMany({ data: contacts });
  console.log(`  ✓ ${contacts.length} contacts`);

  // 8. Opportunities
  console.log('  Creating opportunities...');
  for (const opp of opportunities) {
    await db.opportunity.create({ data: opp });
  }
  console.log(`  ✓ ${opportunities.length} opportunities`);

  // 9. Timeline Entries
  console.log('  Creating timeline entries...');
  await db.timelineEntry.createMany({ data: timelineEntries });
  console.log(`  ✓ ${timelineEntries.length} timeline entries`);

  // 10. Company Notes
  console.log('  Creating company notes...');
  await db.companyNote.createMany({ data: companyNotes });
  console.log(`  ✓ ${companyNotes.length} company notes`);

  // 11. Contact Notes
  console.log('  Creating contact notes...');
  await db.contactNote.createMany({ data: contactNotes });
  console.log(`  ✓ ${contactNotes.length} contact notes`);

  // 12. Research Cards
  console.log('  Creating research cards...');
  for (const card of researchCards) {
    await db.companyResearchCard.upsert({
      where: { companyId: card.companyId },
      update: card,
      create: card,
    });
  }
  console.log(`  ✓ ${researchCards.length} research cards`);

  // 13. Email Health Checks
  console.log('  Creating email health checks...');
  await db.emailHealthCheck.createMany({ data: emailHealthChecks });
  console.log(`  ✓ ${emailHealthChecks.length} email health checks`);

  // Summary
  console.log('\n✅ Database seeded successfully!\n');
  console.log('Summary:');
  console.log(`  Companies:        ${companies.length}`);
  console.log(`  Contacts:         ${contacts.length}`);
  console.log(`  Opportunities:    ${opportunities.length}`);
  console.log(`  Timeline Entries: ${timelineEntries.length}`);
  console.log(`  Company Notes:    ${companyNotes.length}`);
  console.log(`  Contact Notes:    ${contactNotes.length}`);
  console.log(`  Research Cards:   ${researchCards.length}`);
  console.log(`  Cap Documents:    ${capabilityDocuments.length}`);
  console.log(`  Cap Snippets:     ${capabilitySnippets.length}`);
  console.log(`  Health Checks:    ${emailHealthChecks.length}`);
  console.log(`  Import Batches:   ${importBatches.length}`);
  console.log(`  User Preferences: 1`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
}).finally(() => process.exit(0));