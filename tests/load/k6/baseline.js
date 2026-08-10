// P5.2 — Baseline Test: 100 concurrent users, 1000 req/min
// Validates all endpoints respond within P95 < 500ms, P99 < 3s, < 1% error rate

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { BASE_URL, COMMON_HEADERS, THRESHOLDS } from './config.js';

export const options = {
  scenarios: {
    baseline: {
      executor: 'constant-arrival-rate',
      rate: 1000,
      timeUnit: '1m',
      duration: '5m',
      preAllocatedVUs: 100,
      maxVUs: 150,
    },
  },
  thresholds: THRESHOLDS,
};

const errorRate = new Rate('errors');

export default function () {
  const endpoints = [
    { method: 'GET', path: '/api/health' },
    { method: 'GET', path: '/api/companies?limit=10' },
    { method: 'GET', path: '/api/contacts?limit=10' },
    { method: 'GET', path: '/api/dashboard/stats' },
    { method: 'GET', path: '/api/signals?limit=10' },
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE_URL}${endpoint.path}`, { headers: COMMON_HEADERS });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(res.status !== 200);
  sleep(Math.random() * 0.5);
}
