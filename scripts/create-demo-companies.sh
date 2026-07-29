#!/bin/bash
# Create all 10 demo companies via the existing API

BASE="http://localhost:3000/api/companies"

COMPANIES=(
  '{"rawName":"NovaTech Industries","domain":"novatech.io","website":"https://novatech.io","industry":"Technology","sizeRange":"Mid-Market (500-5,000)","country":"United States"}'
  '{"rawName":"Meridian Healthcare Group","domain":"meridianhealth.com","website":"https://meridianhealth.com","industry":"Healthcare","sizeRange":"Enterprise (10,000+)","country":"United Kingdom"}'
  '{"rawName":"Atlas Manufacturing Corp","domain":"atlasmfg.com","website":"https://atlasmfg.com","industry":"Manufacturing","sizeRange":"Enterprise (5,000-10,000)","country":"Germany"}'
  '{"rawName":"Pinnacle Retail Holdings","domain":"pinnacleretail.com","website":"https://pinnacleretail.com","industry":"Retail","sizeRange":"Enterprise (10,000+)","country":"United States"}'
  '{"rawName":"Sentinel Cyber Defense","domain":"sentinelcyber.io","website":"https://sentinelcyber.io","industry":"Information Technology","sizeRange":"Mid-Market (1,000-5,000)","country":"Israel"}'
  '{"rawName":"Greenfield Energy Solutions","domain":"greenfieldenergy.com","website":"https://greenfieldenergy.com","industry":"Energy","sizeRange":"Mid-Market (500-5,000)","country":"Denmark"}'
  '{"rawName":"Quantum Dynamics Research","domain":"quantumdynamics.org","website":"https://quantumdynamics.org","industry":"Technology","sizeRange":"Mid-Market (1,000-5,000)","country":"United States"}'
  '{"rawName":"StratosCloud Systems","domain":"stratoscloud.com","website":"https://stratoscloud.com","industry":"Technology","sizeRange":"Enterprise (5,000-10,000)","country":"Singapore"}'
  '{"rawName":"Vanguard Consulting Group","domain":"vanguardconsulting.com","website":"https://vanguardconsulting.com","industry":"Consulting","sizeRange":"Mid-Market (1,000-5,000)","country":"United States"}'
)

echo "Creating 9 remaining demo companies..."
for data in "${COMPANIES[@]}"; do
  name=$(echo "$data" | python3 -c "import json,sys; print(json.load(sys.stdin)['rawName'])" 2>/dev/null)
  result=$(curl -s -X POST "$BASE" -H "Content-Type: application/json" -d "$data" 2>/dev/null)
  id=$(echo "$result" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('company',{}).get('id','') or d.get('error','unknown'))" 2>/dev/null)
  echo "  $name → $id"
done
echo "Done!"
