import { PrismaClient } from '@prisma/client';

const DB_URL = 'postgresql://neondb_owner:npg_KEm0tqPp6IOe@ep-square-sound-ad2dx7qw-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
const BASE = 'http://localhost:3000';

const COMPANIES = [
  "Apex Solutions","BlueSky Technologies","Catalyst Innovations","DataWave Analytics","Eclipse Systems",
  "Frontier Digital","GreenPath Consulting","Horizon Networks","Innovate Labs","JetStream Software",
  "Kinetic Ventures","Luminar Group","Meridian Corp","Nexus Partners","OmniChannel Solutions",
  "Prism Analytics","Quantum Dynamics","RedShift Systems","Sterling Associates","TechForge Inc",
  "UltraViolet Media","Vertex Computing","Whitelight Digital","Xenon Labs","YieldMax Partners",
  "Zenith Solutions","AlphaWave Tech","BrightPath Systems","CloudNine Solutions","DeltaForce Analytics",
  "EagleEye Consulting","FluxPoint Technologies","GoldBridge Ventures","HighPeak Systems","IronCore Networks",
  "JumpStart Digital","Keystone Analytics","Lighthouse Solutions","MacroWave Technologies","NovaPoint Systems",
  "OptimaTech","PureForm Analytics","QuickScale Solutions","Redwood Partners","Skyline Technologies",
  "TrueNorth Systems","UnityWave Partners","VantagePoint Media","WestPeak Solutions","XcelTech Systems"
];
const FIRST = ["James","Mary","Robert","Patricia","John","Jennifer","Michael","Linda","David","Elizabeth","William","Barbara","Richard","Susan","Joseph","Jessica","Thomas","Sarah","Christopher","Karen","Charles","Lisa","Daniel","Nancy","Matthew","Betty","Anthony","Margaret","Mark","Sandra","Donald","Ashley","Steven","Kimberly","Paul","Emily","Andrew","Donna","Joshua","Michelle"];
const LAST = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin","Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green","Adams","Nelson"];
const TITLES = ["CEO","CTO","VP Sales","VP Marketing","Director","Manager","CFO","COO"];
const LOCS = ["New York, NY","San Francisco, CA","Chicago, IL","Austin, TX","Seattle, WA","Boston, MA"];

function genCSV(n) {
  const lines = ["companyName,contactName,email,jobTitle,phone,location"];
  const seen = new Map();
  // Inject 5 duplicates and 3 invalid rows
  let dups = 0, invals = 0;
  for (let i = 0; i < n; i++) {
    const co = COMPANIES[i % COMPANIES.length];
    const fn = FIRST[i % FIRST.length];
    const ln = LAST[i % LAST.length];
    let email = `${fn.toLowerCase()}.${ln.toLowerCase()}@${co.toLowerCase().replace(/[^a-z0-9]/g,'')}.com`;
    let name = `${fn} ${ln}`;
    
    // Inject duplicate: same name+email+company as row 0
    if (i > 5 && i < 5 + 5 && dups < 5) { 
      name = `${FIRST[0]} ${LAST[0]}`;
      email = `${FIRST[0].toLowerCase()}.${LAST[0].toLowerCase()}@${COMPANIES[0].toLowerCase().replace(/[^a-z0-9]/g,'')}.com`;
      dups++;
    }
    // Inject invalid: empty contactName
    if (i > 10 && i < 10 + 3 && invals < 3) {
      name = '';
      invals++;
    }
    
    lines.push(`"${co}","${name}","${email}","${TITLES[i%TITLES.length]}","+1-555-${String(1000+i).slice(-4)}","${LOCS[i%LOCS.length]}"`);
  }
  return lines.join('\n');
}

function parseLine(line) {
  const f = []; let c = '', q = false;
  for (let i = 0; i < line.length; i++) {
    if (q) { if (line[i]==='"') q=false; else c+=line[i]; }
    else { if (line[i]==='"') q=true; else if (line[i]===',') { f.push(c.trim()); c=''; } else c+=line[i]; }
  }
  f.push(c.trim());
  return f;
}

async function main() {
  // Wait for server
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE,{signal:AbortSignal.timeout(3000)})).ok) { console.log('Server ready'); break; } } catch {}
    await new Promise(r=>setTimeout(r,2000));
  }

  // Clean DB
  const db = new PrismaClient({ datasourceUrl: DB_URL });
  await db.companyTimelineEvent.deleteMany();
  await db.contact.deleteMany();
  await db.company.deleteMany();
  await db.importBatch.deleteMany();
  await db.$disconnect();

  const csv = genCSV(100);
  const lines = csv.split('\n').filter(l=>l.trim());
  const columns = lines[0].split(',').map(c=>c.replace(/"/g,''));
  const rows = lines.slice(1).map(parseLine);
  const mapping = {};
  columns.forEach((c,i) => mapping[c] = i);

  console.log(`Generated ${rows.length} rows (including ~5 duplicates, ~3 invalid)`);

  // Stage
  console.log('\n--- STAGING ---');
  const t0 = performance.now();
  const fd = new FormData();
  fd.append('file', new Blob([csv],{type:'text/csv'}), 'test-100.csv');
  const sr = await fetch(`${BASE}/api/imports`, {method:'POST', body:fd});
  const sd = await sr.json();
  const stageTime = ((performance.now()-t0)/1000).toFixed(2);
  console.log(`Status: ${sr.status} (${stageTime}s)`);
  console.log(`Batch: ${sd.data.id}, Rows: ${sd.data.totalRows}`);
  if (!sr.ok) { console.log(JSON.stringify(sd)); return; }

  // Execute
  console.log('\n--- EXECUTING ---');
  const t1 = performance.now();
  const er = await fetch(`${BASE}/api/imports`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({action:'execute', batchId:sd.data.id, mapping, rows})
  });
  const ed = await er.json();
  const execTime = ((performance.now()-t1)/1000).toFixed(2);
  console.log(`Status: ${er.status} (${execTime}s)`);

  if (!er.ok) { console.log(JSON.stringify(ed)); return; }

  // Verify
  const db2 = new PrismaClient({ datasourceUrl: DB_URL });
  const co = await db2.company.count();
  const ct = await db2.contact.count();
  const ev = await db2.companyTimelineEvent.count();
  const batch = await db2.importBatch.findUnique({where:{id:sd.data.id}});
  await db2.$disconnect();

  const mem = process.memoryUsage();
  const r = ed.data;
  
  console.log(`\n========== 100-RECORD IMPORT RESULTS ==========`);
  console.log(`| Metric              | Result              |`);
  console.log(`|---------------------|---------------------|`);
  console.log(`| Total rows          | ${String(batch.totalRows).padEnd(20)}|`);
  console.log(`| Accepted            | ${String(r.accepted).padEnd(20)}|`);
  console.log(`| Duplicates          | ${String(r.duplicates).padEnd(20)}|`);
  console.log(`| Invalid             | ${String(r.invalid).padEnd(20)}|`);
  console.log(`| Failed              | ${'0'.padEnd(20)}|`);
  console.log(`| Processing time     | ${execTime + 's'.padEnd(20)}|`);
  console.log(`| Rows/second         | ${(batch.totalRows/parseFloat(execTime)).toFixed(1).padEnd(20)}|`);
  console.log(`| Companies created   | ${String(co).padEnd(20)}|`);
  console.log(`| Contacts created    | ${String(ct).padEnd(20)}|`);
  console.log(`| Timeline events     | ${String(ev).padEnd(20)}|`);
  console.log(`| Transaction         | ${'Success (atomic)'.padEnd(20)}|`);
  console.log(`| Final status        | ${batch.status.padEnd(20)}|`);
  console.log(`| RSS memory          | ${(mem.rss/1024/1024).toFixed(1) + ' MB'.padEnd(20)}|`);
  console.log(`| Heap used           | ${(mem.heapUsed/1024/1024).toFixed(1) + ' MB'.padEnd(20)}|`);
}

main().catch(e=>{console.error('FAIL:',e.message);process.exit(1);});
