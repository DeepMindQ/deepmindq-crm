// Sequential API verification with retries
// Handles server instability (dies after each request, auto-restarts)
const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port: 8080, path, method: 'GET', timeout: 15000 },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error('Parse error: ' + data.substring(0, 80))); }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function retry(path, attempts = 8, delay = 4000) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await get(path);
    } catch (e) {
      process.stdout.write(`  Attempt ${i + 1} failed: ${e.message}, retrying in ${delay / 1000}s...\n`);
      if (i === attempts - 1) throw e;
      await sleep(delay);
    }
  }
}

(async () => {
  console.log('=== DeepMindQ API Verification ===\n');

  try {
    // 1. Dashboard
    process.stdout.write('1. Dashboard... ');
    const dash = await retry('/api/dashboard');
    console.log('OK');
    console.log('   Companies: ' + dash.totalCompanies);
    console.log('   Contacts: ' + dash.totalContacts);
    console.log('   Healthy emails: ' + dash.healthyEmails);
    console.log('   Risky emails: ' + dash.riskyEmails);
    console.log('   Invalid emails: ' + dash.invalidEmails);
    console.log('   Pipeline stages: ' + (dash.pipeline ? dash.pipeline.length : 0));
    console.log('   Tasks: ' + (dash.tasks ? dash.tasks.length : 0));
    console.log('   Activities: ' + (dash.recentActivity ? dash.recentActivity.length : 0));

    // 2. Companies
    process.stdout.write('2. Companies... ');
    const comp = await retry('/api/companies?pageSize=2');
    console.log('OK');
    console.log('   Total: ' + comp.total);
    if (comp.companies && comp.companies[0]) {
      console.log('   First: ' + comp.companies[0].name + ' (' + comp.companies[0].industry + ', ' + comp.companies[0].status + ')');
    }

    // 3. Contacts
    process.stdout.write('3. Contacts... ');
    const cont = await retry('/api/contacts?pageSize=2');
    console.log('OK');
    console.log('   Total: ' + cont.total);
    if (cont.contacts && cont.contacts[0]) {
      const c = cont.contacts[0];
      console.log('   First: ' + c.name + ' at ' + (c.company ? c.company.name : '?') + ' [' + c.emailHealth + ']');
    }

    // 4. Preferences
    process.stdout.write('4. Preferences... ');
    const prefs = await retry('/api/preferences');
    console.log('OK');
    console.log('   Tone: ' + prefs.tone);
    console.log('   Provider: ' + prefs.aiProvider);
    console.log('   Model: ' + prefs.aiModel);

    // 5. Knowledge
    process.stdout.write('5. Knowledge... ');
    const know = await retry('/api/knowledge?include=snippets');
    console.log('OK');
    console.log('   Documents: ' + (know.documents ? know.documents.length : 0));
    console.log('   Snippets: ' + (know.snippets ? know.snippets.length : 0));

    // 6. Notes
    process.stdout.write('6. Notes... ');
    const notes = await retry('/api/notes?limit=3');
    console.log('OK (' + (Array.isArray(notes) ? notes.length : '?') + ' notes)');

    // 7. Timeline
    process.stdout.write('7. Timeline... ');
    const timeline = await retry('/api/timeline?limit=3');
    console.log('OK (' + (Array.isArray(timeline) ? timeline.length : '?') + ' entries)');

    // 8. Opportunities
    process.stdout.write('8. Opportunities... ');
    const opps = await retry('/api/opportunities');
    console.log('OK (' + (Array.isArray(opps) || opps.data ? 'has data' : 'empty') + ')');

    console.log('\n=== ALL 8 ENDPOINTS VERIFIED SUCCESSFULLY ===');
  } catch (e) {
    console.error('\n❌ VERIFICATION FAILED: ' + e.message);
    process.exit(1);
  }
})();