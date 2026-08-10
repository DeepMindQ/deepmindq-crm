// P5.2 — Shared Load Test Configuration
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const API_KEY = __ENV.API_KEY || 'test';
export const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export const THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<3000'],
  http_req_failed: ['rate<0.01'],
};

export const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${AUTH_TOKEN}`,
};
