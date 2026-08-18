import { WorkflowEngine } from '../src/services/workflow-engine.service';
import { prisma } from '../src/utils/prisma';

// Create instance
const engine = new WorkflowEngine();
const executionOrder: string[] = [];

// Override executeNode
const originalExecuteNode = engine.executeNode.bind(engine);
engine.executeNode = async (node: any, context: any, org: any) => {
  executionOrder.push(node.id);
  if (node.type === 'logic_condition') {
    return { result: node.data?.isTrue ?? true };
  }
  return { success: true };
};

// Mock prisma
(prisma.workflow.findUnique as any) = async () => null;
(prisma.workflowRun.create as any) = async () => ({ id: 'run_1', startedAt: new Date() });
(prisma.workflowRun.update as any) = async () => ({});

async function runTests() {
  console.log('--- Test 1: Multiple Dependencies (Merge) ---');
  executionOrder.length = 0;
  
  (prisma.workflow.findUnique as any) = async () => ({
    id: 'wf_1',
    organizationId: 'org_1',
    nodes: [
      { id: '1', type: 'trigger_manual' },
      { id: '2', type: 'action_http' },
      { id: '3', type: 'action_http' },
      { id: '4', type: 'action_http' } 
    ],
    edges: [
      { id: 'e1', source: '1', target: '2' },
      { id: 'e2', source: '1', target: '3' },
      { id: 'e3', source: '2', target: '4' },
      { id: 'e4', source: '3', target: '4' }
    ]
  });

  await engine.execute('wf_1');
  console.log('Execution Order:', executionOrder);
  const indexOf4 = executionOrder.indexOf('4');
  const indexOf2 = executionOrder.indexOf('2');
  const indexOf3 = executionOrder.indexOf('3');
  if (indexOf4 > indexOf2 && indexOf4 > indexOf3) {
    console.log('PASS: Node 4 waited for 2 and 3.');
  } else {
    console.log('FAIL: Node 4 executed prematurely.');
  }

  console.log('\n--- Test 2: Dead Path Elimination ---');
  executionOrder.length = 0;

  (prisma.workflow.findUnique as any) = async () => ({
    id: 'wf_2',
    organizationId: 'org_1',
    nodes: [
      { id: '1', type: 'trigger_manual' },
      { id: '2', type: 'logic_condition', data: { isTrue: false } },
      { id: '3', type: 'action_http' }, 
      { id: '4', type: 'action_http' }, 
      { id: '5', type: 'action_http' }  
    ],
    edges: [
      { id: 'e1', source: '1', target: '2' },
      { id: 'e2', source: '2', target: '3', sourceHandle: 'true' },
      { id: 'e3', source: '2', target: '4', sourceHandle: 'false' },
      { id: 'e4', source: '3', target: '5' },
      { id: 'e5', source: '4', target: '5' }
    ]
  });

  await engine.execute('wf_2');
  console.log('Execution Order:', executionOrder);
  if (executionOrder.includes('5') && !executionOrder.includes('3')) {
    console.log('PASS: Node 5 executed despite Node 3 being skipped.');
  } else {
    console.log('FAIL: Node 5 did not execute properly.');
  }
}

runTests().catch(console.error);
