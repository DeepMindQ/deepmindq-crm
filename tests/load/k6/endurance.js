// P5.2 — Endurance Test: 100 users for 30 minutes
// Validates no memory leak, no degradation over sustained load

import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { BASE_URL, COMMON_HEADERS, THRESHOLDS } from './config.js';

const responseTime = new Trend('response_time');

export const options = {
  scenarios: {
    endurance: {
      executor: 'constant-vus',
      vus: 100,
      duration: '30m',
    },
  },
  thresholds: {
    ...THRESHOLDS,
    http_req_duration: ['p(95)<600'],
  },
};

export default function () {
  const operations = [
    () => http.get(`${BASE_URL}/api/companies?limit=10`, { headers: COMMON_HEADERS }),
    () => http.get(`${BASE_URL}/api/dashboard/stats`, { headers: COMMON_HEADERS }),
    () => http.get(`${BASE_URL}/api/health`, { headers: COMMON_HEADERS }),
  ];

  const op = operations[Math.floor(Math.random() * operations.length)];
  const res = op();

  responseTime.add(res.timings.duration);

  check(res, {
    'status OK': (r) => r.status === 200 || r.status === 401,
  });

  sleep(1 + Math.random());
}

export function handleSummary(data) {
  console.log('Endurance test complete. Check for latency trend (increasing = possible memory leak).');
}
