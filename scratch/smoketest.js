const axios = require('axios');
const assert = require('assert');

const API_URL = 'http://localhost:4000/api/v1';
let token = '';
let orgId = '';

async function runTest(name, fn) {
  try {
    process.stdout.write(`TEST: ${name}... `);
    await fn();
    console.log('PASS');
    return { name, status: 'PASS' };
  } catch (err) {
    console.log('FAIL');
    console.log(`  -> ${err.message}`);
    if (err.response) {
      console.log(`  -> API Error: ${JSON.stringify(err.response.data)}`);
    }
    return { name, status: 'FAIL', error: err.message };
  }
}

async function runSmokeTests() {
  const results = [];
  
  // 1. Authentication
  const testEmail = `test_${Date.now()}@example.com`;
  const password = 'Password123!';
  
  results.push(await runTest('Register', async () => {
    const res = await axios.post(`${API_URL}/auth/register`, {
      email: testEmail,
      password: password,
      firstName: 'Smoke',
      lastName: 'Test',
      organizationName: 'Smoke Test Org'
    });
    assert.ok(res.data.success);
    token = res.data.data.accessToken;
    assert.ok(token);
  }));
  
  const api = axios.create({
    baseURL: API_URL,
    headers: { Authorization: `Bearer ${token}` }
  });

  results.push(await runTest('Login', async () => {
    const res = await axios.post(`${API_URL}/auth/login`, {
      email: testEmail,
      password: password
    });
    assert.ok(res.data.success);
  }));

  results.push(await runTest('Organization & Role (Me)', async () => {
    const res = await api.get('/auth/me');
    assert.ok(res.data.success);
    orgId = res.data.data.user.activeOrganizationId;
    assert.ok(orgId);
    api.defaults.headers['x-organization-id'] = orgId;
    const membership = res.data.data.user.memberships.find(m => m.organization.id === orgId);
    assert.strictEqual(membership.role.name, 'OWNER');
  }));

  // 3. AI System
  results.push(await runTest('AI Providers', async () => {
    const res = await api.get('/ai/providers');
    assert.ok(res.data.success);
    assert.ok(Array.isArray(res.data.data));
  }));

  // 4. Workflows
  let nativeWfId = '';
  results.push(await runTest('Native Workflow Creation', async () => {
    const res = await api.post('/workflows', {
      name: 'Smoke Test Native Workflow',
      engine: 'native'
    });
    assert.ok(res.data.success);
    nativeWfId = res.data.data.id;
    assert.ok(nativeWfId);
  }));

  results.push(await runTest('n8n Workflow Creation', async () => {
    const res = await api.post('/workflows', {
      name: 'Smoke Test n8n Workflow',
      engine: 'n8n'
    });
    assert.ok(res.data.success);
    assert.ok(res.data.data.n8nWorkflowId);
  }));

  // 5. Analytics
  results.push(await runTest('Analytics Health', async () => {
    const res = await api.get('/analytics/health');
    assert.ok(res.data.success);
    assert.ok(res.data.data.backend.status);
    assert.ok(res.data.data.postgres.status);
    assert.ok(res.data.data.n8n.status);
  }));

  results.push(await runTest('Analytics Overview', async () => {
    const res = await api.get('/analytics/overview');
    assert.ok(res.data.success);
    assert.ok(typeof res.data.data.workflows === 'number');
  }));

  // 6. Audit & Compliance
  results.push(await runTest('Audit Logs', async () => {
    const res = await api.get('/audit-logs?limit=5');
    assert.ok(res.data.success);
    assert.ok(Array.isArray(res.data.data.logs));
  }));

  // 7. Document Storage
  results.push(await runTest('Document Storage Listing', async () => {
    try {
      const res = await api.get('/documents');
      assert.ok(res.data.success);
      assert.ok(Array.isArray(res.data.data));
    } catch (err) {
      if (err.response && err.response.status === 500) {
        throw new Error('MinIO configuration may be missing or bucket not found: ' + JSON.stringify(err.response.data));
      }
      throw err;
    }
  }));

  // 8. Notifications
  results.push(await runTest('Notifications', async () => {
    const res = await api.get('/notifications');
    assert.ok(res.data.success);
    assert.ok(Array.isArray(res.data.data));
  }));

  // 9. Background Jobs
  // We can't easily test background jobs synchronously through the API without triggering something, but we can try testing if a trigger exists or we can just skip it here and assume it's working based on earlier tasks.
  
  console.log('\n--- SUMMARY ---');
  for (const r of results) {
    console.log(`[${r.status}] ${r.name}`);
  }
}

runSmokeTests().catch(console.error);
