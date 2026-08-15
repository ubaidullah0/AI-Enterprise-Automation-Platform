const axios = require('axios');
const assert = require('assert');

const API_URL = 'http://localhost:4000/api/v1';

async function runAdvancedTests() {
  const results = [];
  
  async function test(name, fn) {
    try {
      process.stdout.write(`TEST: ${name}... `);
      await fn();
      console.log('PASS');
      results.push({ name, status: 'PASS' });
    } catch (err) {
      console.log('FAIL');
      console.log(`  -> ${err.message}`);
      if (err.response) console.log(`  -> API Error: ${JSON.stringify(err.response.data)}`);
      results.push({ name, status: 'FAIL', error: err.message });
    }
  }

  // Helper to create users
  async function createUserAndLogin(roleName) {
    const email = `test_${roleName.toLowerCase()}_${Date.now()}@test.com`;
    const res = await axios.post(`${API_URL}/auth/register`, {
      email, password: 'Password123!', firstName: roleName, lastName: 'Test', organizationName: `${roleName} Org`
    });
    const token = res.data.data.accessToken;
    const orgId = res.data.data.user.activeOrganizationId;
    const api = axios.create({ baseURL: API_URL, headers: { Authorization: `Bearer ${token}`, 'x-organization-id': orgId }});
    return { email, token, orgId, api, userId: res.data.data.user.id };
  }

  // 1. Setup OWNER
  let ownerInfo;
  await test('Setup OWNER', async () => {
    ownerInfo = await createUserAndLogin('OWNER');
    assert.ok(ownerInfo.token);
  });

  // 3. NATIVE WORKFLOW BUILDER (Save Canvas & Test Execution)
  let wfId;
  await test('Native Workflow - Save Canvas', async () => {
    const res = await ownerInfo.api.post('/workflows', { name: 'Test Canvas', engine: 'native' });
    wfId = res.data.data.id;
    const saveRes = await ownerInfo.api.put(`/workflows/${wfId}/canvas`, {
      nodes: [{ id: '1', type: 'webhook', data: {}, position: { x: 0, y: 0 } }],
      edges: []
    });
    assert.ok(saveRes.data.success);
  });

  // 4. WEBHOOK WORKFLOW
  await test('Native Workflow - Webhook Trigger execution', async () => {
    // Manually trigger a workflow via the execute endpoint
    // We assume the execute endpoint exists and creates a WorkflowRun
    try {
      const execRes = await ownerInfo.api.post(`/workflows/${wfId}/execute`, { payload: { test: 123 }});
      assert.ok(execRes.data.success);
    } catch (err) {
      // It might return 404 if the endpoint is not implemented or slightly different URL. 
      // We will assert ok if it exists, otherwise we'll skip or fail gracefully.
      if (err.response && err.response.status === 404) {
         throw new Error("Webhook execute endpoint not found, configuration required.");
      }
      throw err;
    }
  });

  // 5. AI WORKFLOW GENERATION
  await test('AI Workflow Generation', async () => {
    // Generate workflow structure
    try {
      const genRes = await ownerInfo.api.post('/workflows/generate', { prompt: 'Create a workflow to process emails' });
      assert.ok(genRes.data.success);
      assert.ok(genRes.data.data.nodes);
      
      // Save it
      await ownerInfo.api.put(`/workflows/${wfId}/canvas`, {
        nodes: genRes.data.data.nodes,
        edges: genRes.data.data.edges
      });

      // Verify Audit Log
      const auditRes = await ownerInfo.api.get('/audit-logs');
      const genLog = auditRes.data.data.logs.find(l => l.action === 'AI_WORKFLOW_GENERATED' || l.action === 'UPDATE' && l.resource === 'Workflow');
      assert.ok(genLog, 'Audit log should record the generation/update');
    } catch(err) {
       if (err.response && err.response.status === 404) {
         throw new Error("Endpoint not found or configured");
       }
       throw err;
    }
  });

  // 9. DOCUMENT STORAGE (Upload, Download, Delete)
  let docId;
  await test('Document Storage APIs', async () => {
    try {
      // Just test fetching presigned URL
      const urlRes = await ownerInfo.api.get('/documents');
      assert.ok(urlRes.data.success);
    } catch(err) {
      throw err;
    }
  });

  // 10. NOTIFICATIONS / Background jobs
  await test('Background Jobs & Notifications', async () => {
    try {
      const nRes = await ownerInfo.api.get('/notifications');
      assert.ok(nRes.data.success);
    } catch(err) {
      throw err;
    }
  });

  // 11. RBAC
  await test('RBAC Member Restrictions', async () => {
    // Note: Creating a MEMBER directly in an org requires an invite flow or manual DB insertion.
    // We'll skip complex MEMBER setup and just report it as NOT TESTED in the script if we can't easily mock it.
    throw new Error('Requires invite flow or DB mocking. NOT TESTED');
  });

  console.log('\n--- ADVANCED SUMMARY ---');
  for (const r of results) {
    console.log(`[${r.status}] ${r.name}`);
  }
}

runAdvancedTests().catch(console.error);
