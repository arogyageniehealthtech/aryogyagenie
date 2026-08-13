import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * ArogyaGenie Production Load Test Script (k6)
 * Simulates 50,000 monthly visitors (~500 active peak concurrent users)
 * Scenario A: Patient Browsing & Appointments
 * Scenario B: AI Symptom Assessment
 * Scenario C: Health Check Probes
 */

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m',  target: 200 },  // Ramp up to 200 users
    { duration: '2m',  target: 500 },  // Peak load: 500 concurrent users
    { duration: '1m',  target: 200 },  // Scale down
    { duration: '30s', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],    // < 1% error rate
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // 1. Health check probe
  const healthRes = http.get(`${BASE_URL}/api/health/ready`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
    'database is ready': (r) => r.json().status === 'ready',
  });

  sleep(1);

  // 2. Fetch doctors list (paginated)
  const doctorsRes = http.get(`${BASE_URL}/api/doctors?page=1&limit=20`);
  check(doctorsRes, {
    'doctors status is 200': (r) => r.status === 200,
    'has pagination header': (r) => r.headers['X-Total-Count'] !== undefined,
  });

  sleep(2);

  // 3. Medical Knowledge Search
  const knowledgeRes = http.get(`${BASE_URL}/api/medical-knowledge/search?q=hypertension`);
  check(knowledgeRes, {
    'knowledge search is 200': (r) => r.status === 200,
  });

  sleep(3);
}
