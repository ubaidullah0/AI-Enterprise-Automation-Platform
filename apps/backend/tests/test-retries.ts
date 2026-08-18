import { WorkflowEngine } from '../src/services/workflow-engine.service';
import { prisma } from '../src/utils/prisma';

const engine = new WorkflowEngine();
const executionOrder: string[] = [];
let executeCount = 0;
let failUntil = 0;

const originalExecuteNode = engine.executeNode.bind(engine);
engine.executeNode = async (node: any, context: any, org: any) => {
  executionOrder.push(node.id);
  
  if (node.type === 'action_http') {
    executeCount++;
    if (executeCount <= failUntil) {
      return { error: 'Simulated API failure' };
    }
  }
  
  if (node.type === 'logic_condition') {
    return { result: node.data?.isTrue ?? true };
  }
  
  return { success: true };
};

(prisma.workflow.findUnique as any) = async () => null;
(prisma.workflowRun.create as any) = async () => ({ id: 'run_1', startedAt: new Date() });
(prisma.workflowRun.update as any) = async (opts: any) => {
  if (opts.data.status === 'FAILED') executionOrder.push('FAILED');
  return {};
};

async function runTests() {
  console.log('--- Test 1: retries=2 (Success on 3rd attempt) ---');
  executionOrder.length = 0;
  executeCount = 0;
  failUntil = 2; // Fails attempt 1 and 2, succeeds on 3
  
  (prisma.workflow.findUnique as any) = async () => ({
    id: 'wf_1', organizationId: 'org_1',
    nodes: [
      { id: '1', type: 'trigger_manual' },
      { id: '2', type: 'action_http', data: { retries: 2 } },
      { id: '3', type: 'action_email' }
    ],
    edges: [
      { id: 'e1', source: '1', target: '2' },
      { id: 'e2', source: '2', target: '3' }
    ]
  });

  await engine.execute('wf_1');
  console.log('Execution Order:', executionOrder);
  // Expected: 1, 2, 2, 2, 3
  if (executeCount === 3 && executionOrder.includes('3') && !executionOrder.includes('FAILED')) {
    console.log('PASS: Retried exactly 3 times and continued downstream.');
  } else {
    console.log('FAIL');
  }

  console.log('\n--- Test 2: retries=1 (Exhaustion) ---');
  executionOrder.length = 0;
  executeCount = 0;
  failUntil = 5; // Fails all attempts
  
  (prisma.workflow.findUnique as any) = async () => ({
    id: 'wf_2', organizationId: 'org_1',
    nodes: [
      { id: '1', type: 'trigger_manual' },
      { id: '2', type: 'action_http', data: { retries: 1 } },
      { id: '3', type: 'action_email' }
    ],
    edges: [
      { id: 'e1', source: '1', target: '2' },
      { id: 'e2', source: '2', target: '3' }
    ]
  });

  await engine.execute('wf_2');
  console.log('Execution Order:', executionOrder);
  // Expected: 1, 2, 2, FAILED
  if (executeCount === 2 && !executionOrder.includes('3') && executionOrder.includes('FAILED')) {
    console.log('PASS: Retried exactly 2 times and failed workflow.');
  } else {
    console.log('FAIL');
  }

  console.log('\n--- Test 3: missing retries (Immediate Failure) ---');
  executionOrder.length = 0;
  executeCount = 0;
  failUntil = 5; 
  
  (prisma.workflow.findUnique as any) = async () => ({
    id: 'wf_3', organizationId: 'org_1',
    nodes: [
      { id: '1', type: 'trigger_manual' },
      { id: '2', type: 'action_http' }, // no retries
      { id: '3', type: 'action_email' }
    ],
    edges: [
      { id: 'e1', source: '1', target: '2' },
      { id: 'e2', source: '2', target: '3' }
    ]
  });

  await engine.execute('wf_3');
  console.log('Execution Order:', executionOrder);
  // Expected: 1, 2, FAILED
  if (executeCount === 1 && !executionOrder.includes('3') && executionOrder.includes('FAILED')) {
    console.log('PASS: Executed exactly 1 time and failed workflow.');
  } else {
    console.log('FAIL');
  }
}

runTests().catch(console.error);
