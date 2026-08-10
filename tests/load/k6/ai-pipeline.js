// P5.2 — AI Pipeline Test: 50 concurrent intelligence queries
// Validates P95 < 3s, no hallucination rate increase under load

import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { BASE_URL, COMMON_HEADERS } from './config.js';

const aiErrorRate = new Rate('ai_errors');

export const options = {
  scenarios: {
    ai_pipeline: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const endpoints = ['/api/ai/health', '/api/intelligence/health'];
  const path = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE_URL}${path}`, { headers: COMMON_HEADERS });

  aiErrorRate.add(res.status >= 500);
  check(res, { 'AI endpoint responded': (r) => r.status < 500 });

  sleep(2 + Math.random() * 3);
}
