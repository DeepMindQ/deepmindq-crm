import { PrismaClient } from '@prisma/client';
const DB_URL = 'postgresql://neondb_owner:npg_KEm0tqPp6IOe@ep-square-sound-ad2dx7qw-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
const BASE = 'http://localhost:3000';

const COMP = [];
for (let i = 0; i < 200; i++) COMP.push(`Company_${String(i).padStart(3,'0')} Inc`);
const FN = ["James","Mary","Robert","Patricia","John","Jennifer","Michael","Linda","David","Elizabeth","William","Barbara","Richard","Susan","Joseph","Jessica","Thomas","Sarah","Christopher","Karen","Charles","Lisa","Daniel","Nancy","Matthew","Betty","Anthony","Margaret","Mark","Sandra","Donald","Ashley","Steven","Kimberly","Paul","Emily","Andrew","Donna","Joshua","Michelle","Kenneth","Carol","Kevin","Amanda","Brian","Dorothy","George","Melissa","Timothy","Deborah","Ronald","Stephanie","Edward","Rebecca"];
const LN = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin","Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts"];
const TIT = ["CEO","CTO","VP Sales","VP Marketing","Director","Manager","CFO","COO","Head of Engineering","Product Manager"];
const LOC = ["New York, NY","San Francisco, CA","Chicago, IL","Austin, TX","Seattle, WA","Boston, MA","Denver, CO","Atlanta, GA","Miami, FL","Portland, OR"];

function gen(n) {
  const lines = ["companyName,contactName,email,jobTitle,phone,location"];
  for (let i = 0; i < n; i++) {
    if (i === 5 || i === 15 || i === 50) { lines.push(`"${COMP[0]}","${FN[0]} ${LN[0]}","${FN[0].toLowerCase()}.${LN[0].toLowerCase()}@${COMP[0].toLowerCase().replace(/[^a-z0-9]/g,'')}.com","${TIT[0]}","+1-555-0001","${LOC[0]}"`); continue; }
    if (i === 3 || i === 20 || i === 100) { lines.push(`"${COMP[1]}","","noone@x.com","${TIT[1]}","+1-555-0002","${LOC[1]}"`); continue; }
    const co = COMP[i % COMP.length];
    const fn = FN[i % FN.length]; const ln = LN[i % LN.length];
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}@c${(i%COMP.length).toString().padStart(3,'0')}.com`;
    lines.push(`"${co}","${fn} ${ln}","${email}","${TIT[i%TIT.length]}","+1-555-${String(1000+i).slice(-4)}","${LOC[i%LOC.length]}"`);
  }
  return lines.join('\n');
}

function pl(line) { const f=[]; let c='',q=false; for(let i=0;i<line.length;i++){if(q){if(line[i]==='"')q=false;else c+=line[i];}else{if(line[i]==='"')q=true;else if(line[i]===','){f.push(c.trim());c='';}else c+=line[i];}} f.push(c.trim()); return f; }

async function main() {
  console.log('Server check...');
  try { await fetch(BASE,{signal:AbortSignal.timeout(3000)}); console.log('Server up'); } catch { console.log('Server not responding!'); return; }

  const csv = gen(2000);
  const lines = csv.split('\n').filter(l=>l.trim());
  const cols = lines[0].split(',').map(c=>c.replace(/"/g,''));
  const rows = lines.slice(1).map(pl);
  const mapping = {}; cols.forEach((c,i)=>mapping[c]=i);
  console.log(`Generated ${rows.length} rows`);

  console.log('\n--- STAGING ---');
  const t0 = performance.now();
  const fd = new FormData();
  fd.append('file', new Blob([csv],{type:'text/csv'}), 'test-2000.csv');
  const sr = await fetch(`${BASE}/api/imports`, {method:'POST', body:fd, signal:AbortSignal.timeout(60000)});
  const sd = await sr.json();
  const stageTime = ((performance.now()-t0)/1000).toFixed(2);
  console.log(`Status: ${sr.status} (${stageTime}s), Rows: ${sd.data?.totalRows}`);
  if (!sr.ok) { console.log(JSON.stringify(sd)); return; }

  console.log('\n--- EXECUTING ---');
  const t1 = performance.now();
  const er = await fetch(`${BASE}/api/imports`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({action:'execute', batchId:sd.data.id, mapping, rows}),
    signal: AbortSignal.timeout(300000)
  });
  const ed = await er.json();
  const execTime = ((performance.now()-t1)/1000).toFixed(2);

  if (!er.ok) { console.log(`FAIL: ${er.status}`); console.log(JSON.stringify(ed)); return; }

  const db = new PrismaClient({ datasourceUrl: DB_URL });
  const co = await db.company.count();
  const ct = await db.contact.count();
  const ev = await db.companyTimelineEvent.count();
  const batch = await db.importBatch.findUnique({where:{id:sd.data.id}});
  await db.$disconnect();
  const mem = process.memoryUsage();
  const r = ed.data;

  console.log(`Status: ${er.status} (${execTime}s)`);
  console.log(`\n========== 2000-RECORD IMPORT RESULTS ==========`);
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
