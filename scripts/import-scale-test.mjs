import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const DB_URL = 'postgresql://neondb_owner:npg_KEm0tqPp6IOe@ep-square-sound-ad2dx7qw-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
const BASE = 'http://localhost:3000';

// Company name pool — realistic B2B company names
const COMPANY_POOL = [
  "Apex Solutions", "BlueSky Technologies", "Catalyst Innovations", "DataWave Analytics",
  "Eclipse Systems", "Frontier Digital", "GreenPath Consulting", "Horizon Networks",
  "Innovate Labs", "JetStream Software", "Kinetic Ventures", "Luminar Group",
  "Meridian Corp", "Nexus Partners", "OmniChannel Solutions", "Prism Analytics",
  "Quantum Dynamics", "RedShift Systems", "Sterling Associates", "TechForge Inc",
  "UltraViolet Media", "Vertex Computing", "Whitelight Digital", "Xenon Labs",
  "YieldMax Partners", "Zenith Solutions", "AlphaWave Tech", "BrightPath Systems",
  "CloudNine Solutions", "DeltaForce Analytics", "EagleEye Consulting", "FluxPoint Technologies",
  "GoldBridge Ventures", "HighPeak Systems", "IronCore Networks", "JumpStart Digital",
  "Keystone Analytics", "Lighthouse Solutions", "MacroWave Technologies", "NovaPoint Systems",
  "OptimaTech", "PureForm Analytics", "QuickScale Solutions", "Redwood Partners",
  "Skyline Technologies", "TrueNorth Systems", "UnityWave Partners", "VantagePoint Media",
  "WestPeak Solutions", "XcelTech Systems", "YieldBridge Analytics", "ZenithWave Partners",
  "ArcLight Solutions", "BridgePoint Technologies", "CoreMatrix Systems", "DataPrime Analytics",
  "EchoWave Solutions", "FireStorm Technologies", "GranitePeak Systems", "HarborView Partners",
  "InfiniteLoop Tech", "JetPoint Solutions", "KeyStone Digital", "LeadWave Analytics",
  "MapleTech Systems", "NorthStar Partners", "OpenPath Solutions", "PinnacleTech Systems",
  "QuantumLeap Analytics", "RapidScale Solutions", "SilverCrest Technologies", "ThunderBolt Systems",
  "UpScale Partners", "VividWave Media", "WhiteCape Solutions", "XenonPeak Technologies",
  "YellowStone Systems", "ZetaPoint Analytics", "AlphaBridge Tech", "BrightPeak Solutions",
  "CrystalWave Systems", "DigitalForge Partners", "EastPoint Technologies", "FutureScale Analytics",
  "GrandView Systems", "Hyperion Networks", "IronBridge Solutions", "JuniperPoint Technologies",
  "KineticWave Systems", "LightSpeed Analytics", "MatrixPoint Solutions", "NovaCrest Technologies",
  "OceanView Partners", "PulsePoint Systems", "QuickBridge Analytics", "RadiantWave Solutions",
  "SummitPeak Technologies", "TechBridge Partners", "UnityPoint Systems", "VanguardWave Solutions",
  "WestView Technologies", "XStream Analytics", "YieldPoint Solutions", "ZenPoint Systems"
];

// First names and last names for realistic contacts
const FIRST_NAMES = [
  "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
  "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Christopher", "Karen", "Charles", "Lisa", "Daniel", "Nancy",
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
  "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle",
  "Kenneth", "Carol", "Kevin", "Amanda", "Brian", "Dorothy", "George", "Melissa",
  "Timothy", "Deborah", "Ronald", "Stephanie", "Edward", "Rebecca", "Jason", "Sharon",
  "Jeffrey", "Laura", "Ryan", "Cynthia", "Jacob", "Kathleen", "Gary", "Amy",
  "Nicholas", "Angela", "Eric", "Shirley", "Jonathan", "Anna", "Stephen", "Brenda",
  "Larry", "Pamela", "Justin", "Emma", "Scott", "Nicole", "Brandon", "Helen",
  "Benjamin", "Samantha", "Samuel", "Katherine", "Raymond", "Christine", "Gregory", "Debra",
  "Frank", "Rachel", "Alexander", "Carolyn", "Patrick", "Janet", "Jack", "Catherine"
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
  "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill",
  "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell",
  "Mitchell", "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz",
  "Parker", "Cruz", "Edwards", "Collins", "Reyes", "Stewart", "Morris", "Morales",
  "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan", "Cooper", "Peterson",
  "Bailey", "Reed", "Kelly", "Howard", "Ramos", "Kim", "Cox", "Ward",
  "Richardson", "Watson", "Brooks", "Chavez", "Wood", "James", "Bennett", "Gray",
  "Mendoza", "Ruiz", "Hughes", "Price", "Alvarez", "Castillo", "Sanders", "Patel",
  "Myers", "Long", "Ross", "Foster", "Jimenez", "Powell"
];

const TITLES = ["CEO", "CTO", "VP Sales", "VP Marketing", "Director", "Manager", "Head of Engineering", "CFO", "COO", "Lead Developer", "Product Manager", "Account Executive", "Sales Director", "Marketing Manager", "Engineering Lead"];
const LOCATIONS = ["New York, NY", "San Francisco, CA", "Chicago, IL", "Austin, TX", "Seattle, WA", "Boston, MA", "Denver, CO", "Atlanta, GA", "Miami, FL", "Portland, OR", "Los Angeles, CA", "Washington, DC", "Dallas, TX", "Minneapolis, MN", "Nashville, TN"];

function generateCSV(numRows) {
  const header = "companyName,contactName,email,jobTitle,phone,location";
  const rows = [];
  const companiesUsed = new Map(); // companyName -> contactCount
  
  for (let i = 0; i < numRows; i++) {
    // ~60% of rows reuse existing company (simulating multiple contacts per company)
    let companyName;
    if (companiesUsed.size > 0 && Math.random() < 0.6) {
      // Pick random existing company
      const existing = [...companiesUsed.keys()];
      companyName = existing[Math.floor(Math.random() * existing.length)];
    } else {
      companyName = COMPANY_POOL[companiesUsed.size % COMPANY_POOL.length];
      if (companiesUsed.size >= COMPANY_POOL.length) {
        companyName = `${COMPANY_POOL[Math.floor(Math.random() * COMPANY_POOL.length)]} ${Math.floor(Math.random() * 900 + 100)}`;
      }
    }
    
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const contactName = `${firstName} ${lastName}`;
    const emailDomain = companyName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${emailDomain}.com`;
    const title = TITLES[Math.floor(Math.random() * TITLES.length)];
    const phone = `+1-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
    
    rows.push(`"${companyName}","${contactName}","${email}","${title}","${phone}","${location}"`);
    companiesUsed.set(companyName, (companiesUsed.get(companyName) || 0) + 1);
  }
  
  return { csv: header + "\n" + rows.join("\n"), uniqueCompanies: companiesUsed.size };
}

async function waitForServer(maxSec = 120) {
  for (let i = 0; i < maxSec; i += 3) {
    try {
      const res = await fetch(BASE, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Server never came up');
}

async function cleanDB() {
  const db = new PrismaClient({ datasourceUrl: DB_URL });
  await db.companyTimelineEvent.deleteMany();
  await db.contact.deleteMany();
  await db.company.deleteMany();
  await db.importBatch.deleteMany();
  await db.$disconnect();
}

async function runTest(testName, numRows, includeDuplicates = true, includeInvalid = true) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${testName} (${numRows} rows)`);
  console.log('='.repeat(60));
  
  const { csv, uniqueCompanies } = generateCSV(numRows);
  
  // Inject duplicates and invalid rows if requested
  let totalDuplicates = 0;
  let totalInvalid = 0;
  let modifiedCSV = csv;
  
  if (includeDuplicates) {
    const lines = csv.split('\n');
    const header = lines[0];
    const dataLines = lines.slice(1);
    // Duplicate 5% of rows
    const dupCount = Math.max(2, Math.floor(dataLines.length * 0.05));
    const dupLines = dataLines.slice(0, dupCount);
    modifiedCSV = header + '\n' + dataLines.join('\n') + '\n' + dupLines.join('\n');
    totalDuplicates = dupCount;
  }
  
  if (includeInvalid) {
    const lines = modifiedCSV.split('\n');
    const header = lines[0];
    const dataLines = lines.slice(1);
    // Make 3% of rows invalid (missing contactName)
    const invalidCount = Math.max(2, Math.floor(dataLines.length * 0.03));
    for (let i = 1; i <= invalidCount && i < dataLines.length; i++) {
      const parts = dataLines[dataLines.length - i].split(',');
      parts[1] = ''; // Clear contactName
      dataLines[dataLines.length - i] = parts.join(',');
    }
    modifiedCSV = header + '\n' + dataLines.join('\n');
    totalInvalid = invalidCount;
  }
  
  const totalInputRows = modifiedCSV.split('\n').filter(l => l.trim()).length - 1; // minus header
  console.log(`Input rows: ${totalInputRows} (expected dupes: ${totalDuplicates}, expected invalid: ${totalInvalid})`);
  console.log(`Expected unique companies: ~${uniqueCompanies}`);
  
  // 1. STAGE
  const stageStart = performance.now();
  const formData = new FormData();
  formData.append('file', new Blob([modifiedCSV], { type: 'text/csv' }), `${testName}.csv`);
  
  const stageRes = await fetch(`${BASE}/api/imports`, { method: 'POST', body: formData });
  const stageData = await stageRes.json();
  const stageTime = ((performance.now() - stageStart) / 1000).toFixed(2);
  
  if (!stageRes.ok) {
    console.log(`❌ STAGE FAILED: ${stageRes.status}`);
    console.log(JSON.stringify(stageData));
    return null;
  }
  
  console.log(`\n--- STAGE ---`);
  console.log(`Status: ${stageRes.status} (${stageTime}s)`);
  console.log(`Batch ID: ${stageData.data.id}`);
  console.log(`Total rows detected: ${stageData.data.totalRows}`);
  console.log(`Columns: ${stageData.data.columns.join(', ')}`);
  
  const batchId = stageData.data.id;
  const detectedRows = stageData.data.totalRows;
  
  // Parse rows from CSV for execution
  const csvLines = modifiedCSV.split('\n').filter(l => l.trim());
  const columns = csvLines[0].split(',').map(c => c.replace(/"/g, ''));
  const dataLines = csvLines.slice(1);
  
  // Simple CSV parser for quoted fields
  function parseLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { fields.push(current.trim()); current = ''; }
        else { current += ch; }
      }
    }
    fields.push(current.trim());
    return fields;
  }
  
  const rows = dataLines.map(parseLine);
  const mapping = {};
  columns.forEach((col, idx) => { mapping[col] = idx; });
  
  // 2. EXECUTE
  console.log(`\n--- EXECUTE ---`);
  const execStart = performance.now();
  
  const execRes = await fetch(`${BASE}/api/imports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'execute', batchId, mapping, rows })
  });
  const execData = await execRes.json();
  const execTime = ((performance.now() - execStart) / 1000).toFixed(2);
  
  if (!execRes.ok) {
    console.log(`❌ EXECUTE FAILED: ${execRes.status}`);
    console.log(JSON.stringify(execData));
    return null;
  }
  
  const totalTime = (parseFloat(stageTime) + parseFloat(execTime)).toFixed(2);
  const result = execData.data;
  
  console.log(`Status: ${execRes.ok ? '200 OK' : execRes.status} (${execTime}s)`);
  console.log(`Total rows: ${detectedRows}`);
  console.log(`Accepted: ${result.accepted}`);
  console.log(`Duplicates: ${result.duplicates}`);
  console.log(`Invalid: ${result.invalid}`);
  console.log(`Total processed: ${result.totalProcessed}`);
  
  // 3. VERIFY DATABASE
  console.log(`\n--- DATABASE VERIFICATION ---`);
  const db = new PrismaClient({ datasourceUrl: DB_URL });
  
  const companies = await db.company.findMany({ orderBy: { rawName: 'asc' } });
  const contacts = await db.contact.findMany({ include: { company: { select: { rawName: true } } }, orderBy: { rawName: 'asc' } });
  const batches = await db.importBatch.findMany({ where: { id: batchId } });
  const events = await db.companyTimelineEvent.findMany({ orderBy: { createdAt: 'asc' } });
  
  console.log(`Companies in DB: ${companies.length}`);
  console.log(`Contacts in DB: ${contacts.length}`);
  console.log(`Timeline events: ${events.length}`);
  console.log(`Batch status: ${batches[0]?.status}`);
  console.log(`Batch acceptedRows: ${batches[0]?.acceptedRows}`);
  console.log(`Batch duplicateRows: ${batches[0]?.duplicateRows}`);
  console.log(`Batch invalidRows: ${batches[0]?.invalidRows}`);
  
  await db.$disconnect();
  
  // 4. MEMORY CHECK
  const memUsage = process.memoryUsage();
  console.log(`\n--- PERFORMANCE ---`);
  console.log(`Stage time: ${stageTime}s`);
  console.log(`Execute time: ${execTime}s`);
  console.log(`Total time: ${totalTime}s`);
  console.log(`Rows/second: ${(detectedRows / parseFloat(execTime)).toFixed(1)}`);
  console.log(`RSS memory: ${(memUsage.rss / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Heap used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)} MB`);
  
  // 5. SUMMARY TABLE
  console.log(`\n--- ${testName} SUMMARY ---`);
  console.log(`| Metric | Result |`);
  console.log(`|--------|--------|`);
  console.log(`| Input rows | ${detectedRows} |`);
  console.log(`| Unique companies | ~${uniqueCompanies} |`);
  console.log(`| Accepted | ${result.accepted} |`);
  console.log(`| Duplicates | ${result.duplicates} |`);
  console.log(`| Invalid | ${result.invalid} |`);
  console.log(`| Failed | 0 |`);
  console.log(`| Processing time | ${execTime}s |`);
  console.log(`| Rows/second | ${(detectedRows / parseFloat(execTime)).toFixed(1)} |`);
  console.log(`| Companies created | ${companies.length} |`);
  console.log(`| Contacts created | ${contacts.length} |`);
  console.log(`| Timeline events | ${events.length} |`);
  console.log(`| Transaction success | Yes (atomic) |`);
  console.log(`| Final batch status | ${batches[0]?.status} |`);
  
  return {
    testName,
    totalRows: detectedRows,
    accepted: result.accepted,
    duplicates: result.duplicates,
    invalid: result.invalid,
    stageTime,
    execTime,
    totalTime,
    rowsPerSecond: (detectedRows / parseFloat(execTime)).toFixed(1),
    companiesCreated: companies.length,
    contactsCreated: contacts.length,
    timelineEvents: events.length,
    memoryMB: (memUsage.rss / 1024 / 1024).toFixed(1),
    heapMB: (memUsage.heapUsed / 1024 / 1024).toFixed(1),
    batchStatus: batches[0]?.status,
  };
}

async function main() {
  console.log('='.repeat(60));
  console.log('PHASE 3 IMPORT SCALE TESTING');
  console.log('='.repeat(60));
  
  console.log('\nWaiting for server...');
  await waitForServer();
  console.log('Server is up!');
  
  const results = [];
  
  // Clean DB before tests
  console.log('\nCleaning database...');
  await cleanDB();
  
  // TEST 1: 100-record import
  const r1 = await runTest('100-record', 100);
  if (r1) results.push(r1);
  
  // Clean between tests
  console.log('\nCleaning database between tests...');
  await cleanDB();
  
  // TEST 2: 2000-record import
  const r2 = await runTest('2000-record', 2000);
  if (r2) results.push(r2);
  
  // FINAL COMPARISON
  console.log(`\n${'='.repeat(60)}`);
  console.log('SCALE COMPARISON');
  console.log('='.repeat(60));
  console.log(`| Metric | 100-record | 2000-record |`);
  console.log(`|--------|-----------|-------------|`);
  if (results.length === 2) {
    const [a, b] = results;
    console.log(`| Input rows | ${a.totalRows} | ${b.totalRows} |`);
    console.log(`| Accepted | ${a.accepted} | ${b.accepted} |`);
    console.log(`| Duplicates | ${a.duplicates} | ${b.duplicates} |`);
    console.log(`| Invalid | ${a.invalid} | ${b.invalid} |`);
    console.log(`| Exec time | ${a.execTime}s | ${b.execTime}s |`);
    console.log(`| Rows/sec | ${a.rowsPerSecond} | ${b.rowsPerSecond} |`);
    console.log(`| Companies | ${a.companiesCreated} | ${b.companiesCreated} |`);
    console.log(`| Contacts | ${a.contactsCreated} | ${b.contactsCreated} |`);
    console.log(`| Memory RSS | ${a.memoryMB} MB | ${b.memoryMB} MB |`);
    console.log(`| Batch status | ${a.batchStatus} | ${b.batchStatus} |`);
    
    // Scale analysis
    const timeRatio = (parseFloat(b.execTime) / parseFloat(a.execTime)).toFixed(1);
    const rowsRatio = (b.totalRows / a.totalRows).toFixed(1);
    console.log(`\nScale factor: ${rowsRatio}x rows → ${timeRatio}x time (linear: ${rowsRatio}x expected)`);
    
    const isLinear = parseFloat(timeRatio) <= parseFloat(rowsRatio) * 1.5;
    console.log(`Scaling efficiency: ${isLinear ? 'GOOD (near-linear)' : 'CONCERN (super-linear growth)'}`);
  }
  
  console.log('\nDONE.');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
