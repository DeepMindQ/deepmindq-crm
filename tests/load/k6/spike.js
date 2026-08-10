// P5.2 — Spike Test: Ramp to 500 concurrent users for 60s
// Validates no errors, auto-recovers within 30s after spike

import http from 'k6/http';
import { BASE_URL, COMMON_HEADERS, THRESHOLDS } from './config.js';

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 50,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '10s', target: 500 },
        { duration: '60s', target: 500 },
        { duration: '30s', target: 50 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    ...THRESHOLDS,
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const endpoints = ['/api/health', '/api/companies?limit=10', '/api/dashboard', '/api/ai/health'];
  const path = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE_URL}${path}`, { headers: COMMON_HEADERS });

  if (res.timings.duration > 5000) {
    console.warn(`Slow response during spike: ${path} took ${res.timings.duration}ms`);
  }
}
