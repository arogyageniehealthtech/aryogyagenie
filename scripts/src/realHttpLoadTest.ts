/**
 * REAL HTTP Load Test for AarogyaGenie Backend
 * 
 * This script performs ACTUAL HTTP requests to a running backend server.
 * It measures real network latency, server response times, and error rates.
 * 
 * IMPORTANT: This requires a running backend server on the specified URL.
 * 
 * Prerequisites:
 * 1. Backend running (e.g., on http://localhost:3000)
 * 2. Database configured and accessible
 * 3. Clerk/Gemini keys configured (for authenticated tests)
 */

import http from "http";
import https from "https";

interface LoadTestConfig {
  baseUrl: string;
  totalRequests: number;
  concurrency: number;
  endpoints: string[];
  warmupRequests?: number;
}

interface LoadTestResult {
  scenario: string;
  baseUrl: string;
  totalRequests: number;
  concurrency: number;
  successCount: number;
  errorCount: number;
  latencies: number[];
  statusCodes: Map<number, number>;
  durationMs: number;
  requestsPerSecond: number;
  p50: number;
  p95: number;
  p99: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
}

function parseUrl(urlString: string): { protocol: string; host: string; port: string; path: string } {
  const url = new URL(urlString);
  return {
    protocol: url.protocol,
    host: url.hostname,
    port: url.port || (url.protocol === "https:" ? "443" : "80"),
    path: url.pathname + url.search,
  };
}

function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)];
}

async function makeHttpRequest(url: string): Promise<{ statusCode: number; latency: number; error?: string }> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const urlParts = parseUrl(url);
    const client = urlParts.protocol === "https:" ? https : http;

    const req = client.get(url, { timeout: 30000 }, (res) => {
      const latency = Date.now() - startTime;
      res.on("data", () => {
        // Consume data to complete the request
      });
      res.on("end", () => {
        resolve({ statusCode: res.statusCode || 0, latency });
      });
      res.on("error", (err) => {
        resolve({ statusCode: 0, latency: Date.now() - startTime, error: err.message });
      });
    });

    req.on("error", (err) => {
      resolve({ statusCode: 0, latency: Date.now() - startTime, error: err.message });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({ statusCode: 0, latency: Date.now() - startTime, error: "Timeout" });
    });
  });
}

async function runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
  const results: LoadTestResult = {
    scenario: config.endpoints.join(", "),
    baseUrl: config.baseUrl,
    totalRequests: config.totalRequests,
    concurrency: config.concurrency,
    successCount: 0,
    errorCount: 0,
    latencies: [],
    statusCodes: new Map(),
    durationMs: 0,
    requestsPerSecond: 0,
    p50: 0,
    p95: 0,
    p99: 0,
    avgLatency: 0,
    minLatency: Infinity,
    maxLatency: 0,
  };

  const startTime = Date.now();
  let completedRequests = 0;
  let requestIndex = 0;
  const queue: Promise<void>[] = [];

  // Warmup requests (not counted in results)
  if (config.warmupRequests && config.warmupRequests > 0) {
    console.log(`  [Warmup] Sending ${config.warmupRequests} warmup requests...`);
    const warmupResults = [];
    for (let i = 0; i < config.warmupRequests; i++) {
      const endpoint = config.endpoints[i % config.endpoints.length];
      const url = `${config.baseUrl}${endpoint}`;
      warmupResults.push(makeHttpRequest(url));
    }
    await Promise.allSettled(warmupResults);
    console.log(`  [Warmup] Completed`);
  }

  async function worker() {
    while (requestIndex < config.totalRequests) {
      const idx = requestIndex++;
      const endpoint = config.endpoints[idx % config.endpoints.length];
      const url = `${config.baseUrl}${endpoint}`;

      try {
        const response = await makeHttpRequest(url);
        results.latencies.push(response.latency);
        results.minLatency = Math.min(results.minLatency, response.latency);
        results.maxLatency = Math.max(results.maxLatency, response.latency);

        if (response.statusCode >= 200 && response.statusCode < 400) {
          results.successCount++;
        } else if (response.statusCode > 0) {
          results.errorCount++;
          results.statusCodes.set(response.statusCode, (results.statusCodes.get(response.statusCode) || 0) + 1);
        } else {
          results.errorCount++;
          results.statusCodes.set(-1, (results.statusCodes.get(-1) || 0) + 1); // -1 = network error
        }
      } catch (err) {
        results.errorCount++;
      }

      completedRequests++;
      if (completedRequests % 100 === 0) {
        process.stdout.write(`    Completed: ${completedRequests}/${config.totalRequests}\r`);
      }
    }
  }

  // Start workers
  const workers = Array.from({ length: config.concurrency }, () => worker());
  queue.push(...workers.map((w) => w));

  await Promise.allSettled(queue);

  const endTime = Date.now();
  results.durationMs = endTime - startTime;
  results.requestsPerSecond = Math.round((config.totalRequests / results.durationMs) * 1000 * 100) / 100;

  // Calculate percentiles
  const sortedLatencies = [...results.latencies].sort((a, b) => a - b);
  results.p50 = calculatePercentile(sortedLatencies, 50);
  results.p95 = calculatePercentile(sortedLatencies, 95);
  results.p99 = calculatePercentile(sortedLatencies, 99);
  results.avgLatency = Math.round((results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length) * 100) / 100;

  return results;
}

export async function executeRealHttpLoadTests() {
  const baseUrl = process.env.BACKEND_URL || "http://localhost:3000";

  console.log("\n=================================================");
  console.log("REAL HTTP LOAD TEST SUITE FOR AAROGYAGENIE");
  console.log("=================================================");
  console.log(`\nBackend URL: ${baseUrl}`);
  console.log("Note: This test sends ACTUAL HTTP requests to a running server\n");

  // First, verify the backend is running
  console.log("[Pre-Test] Verifying backend connectivity...");
  const healthCheck = await makeHttpRequest(`${baseUrl}/health`);
  if (healthCheck.statusCode !== 200) {
    console.error(
      `\n❌ ERROR: Backend is not accessible at ${baseUrl}`
    );
    console.error(`Health check returned status ${healthCheck.statusCode}`);
    console.error("Please ensure:");
    console.error("1. Backend is running: cd artifacts/api-server && pnpm run start");
    console.error("2. DATABASE_URL environment variable is configured");
    console.error("3. Backend is listening on port 3000 (or BACKEND_URL is set correctly)");
    console.error("\nWithout a running backend, real HTTP tests cannot be executed.");
    return;
  }
  console.log(`✅ Backend is reachable (response time: ${healthCheck.latency}ms)\n`);

  const results: LoadTestResult[] = [];

  // Test 1: Health Check Endpoint (Public, No Auth)
  console.log("[Test 1/4] Health Check Endpoint (100 reqs, 10 concurrent)...");
  const result1 = await runLoadTest({
    baseUrl,
    totalRequests: 100,
    concurrency: 10,
    endpoints: ["/health"],
    warmupRequests: 5,
  });
  results.push(result1);
  console.log(`  ✅ Completed: ${result1.successCount}/${result1.totalRequests} succeeded\n`);

  // Test 2: Progressive Load (Increase Concurrency)
  console.log("[Test 2/4] Progressive Load Test (500 reqs, 20 concurrent)...");
  const result2 = await runLoadTest({
    baseUrl,
    totalRequests: 500,
    concurrency: 20,
    endpoints: ["/health", "/health/ready"],
    warmupRequests: 10,
  });
  results.push(result2);
  console.log(`  ✅ Completed: ${result2.successCount}/${result2.totalRequests} succeeded\n`);

  // Test 3: Higher Concurrency
  console.log("[Test 3/4] Higher Concurrency Test (300 reqs, 50 concurrent)...");
  const result3 = await runLoadTest({
    baseUrl,
    totalRequests: 300,
    concurrency: 50,
    endpoints: ["/health"],
  });
  results.push(result3);
  console.log(`  ✅ Completed: ${result3.successCount}/${result3.totalRequests} succeeded\n`);

  // Test 4: Spike Test
  console.log("[Test 4/4] Traffic Spike Test (500 reqs, 100 concurrent)...");
  const result4 = await runLoadTest({
    baseUrl,
    totalRequests: 500,
    concurrency: 100,
    endpoints: ["/health"],
  });
  results.push(result4);
  console.log(`  ✅ Completed: ${result4.successCount}/${result4.totalRequests} succeeded\n`);

  // Print results
  console.log("=================================================");
  console.log("REAL HTTP LOAD TEST RESULTS");
  console.log("=================================================\n");

  console.log("Results Table:");
  console.table(
    results.map((r) => ({
      Scenario: r.scenario,
      "Total Reqs": r.totalRequests,
      Concurrency: r.concurrency,
      Success: r.successCount,
      Errors: r.errorCount,
      "Req/sec": r.requestsPerSecond,
      "Avg (ms)": r.avgLatency,
      "p50 (ms)": r.p50,
      "p95 (ms)": r.p95,
      "p99 (ms)": r.p99,
      "Min (ms)": r.minLatency === Infinity ? 0 : r.minLatency,
      "Max (ms)": r.maxLatency,
    }))
  );

  console.log("\nDetailed Results:");
  for (const result of results) {
    console.log(`\n${result.scenario}`);
    console.log(`  Total Requests: ${result.totalRequests}`);
    console.log(`  Concurrency: ${result.concurrency}`);
    console.log(`  Success Rate: ${((result.successCount / result.totalRequests) * 100).toFixed(2)}%`);
    console.log(`  Requests/sec: ${result.requestsPerSecond}`);
    console.log(`  Latency Percentiles:`);
    console.log(`    - p50:  ${result.p50}ms`);
    console.log(`    - p95:  ${result.p95}ms`);
    console.log(`    - p99:  ${result.p99}ms`);
    console.log(`    - Avg:  ${result.avgLatency}ms`);
    console.log(`    - Min:  ${result.minLatency === Infinity ? 0 : result.minLatency}ms`);
    console.log(`    - Max:  ${result.maxLatency}ms`);

    if (result.statusCodes.size > 0) {
      console.log(`  Status Codes:`);
      for (const [code, count] of Array.from(result.statusCodes.entries()).sort()) {
        const codeLabel = code === -1 ? "Network Error" : `${code}`;
        console.log(`    - ${codeLabel}: ${count}`);
      }
    }
  }

  console.log("\n=================================================");
  console.log("INTERPRETATION GUIDE");
  console.log("=================================================");
  console.log(`
For 50,000 Monthly Active Users:
- Estimated DAU: ~3,300 users
- Estimated Peak Concurrency: 20-100 concurrent requests
- Estimated Peak QPS: 30-100 requests/second

Guidelines:
- p95 latency < 100ms: Excellent for user experience
- p95 latency 100-500ms: Acceptable for most operations
- p95 latency > 500ms: May cause user frustration
- Error rate should be < 1%
- Max latency should not exceed 5000ms for most requests
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  executeRealHttpLoadTests().catch((err) => {
    console.error("Load test failed:", err);
    process.exit(1);
  });
}
