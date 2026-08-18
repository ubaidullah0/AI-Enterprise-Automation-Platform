import { prisma } from '../utils/prisma';
import { AIService } from './ai.service';

export class WorkflowEngine {
  // Evaluates a single node
  async executeNode(node: any, context: any, organizationId: string): Promise<any> {
    const { type, data } = node;

    // Simple templating: replace {{key}} with context value
    const templateString = (str: string) => {
      if (!str) return str;
      return str.replace(/\{\{(.*?)\}\}/g, (_, path) => {
        return path.split('.').reduce((acc: any, part: string) => acc && acc[part], context) || '';
      });
    };

    switch (type) {
      case 'trigger_webhook':
      case 'trigger_manual':
        return context.trigger || {};

      case 'action_email':
        const to = templateString(data.to);
        const subject = templateString(data.subject);
        const body = templateString(data.body);
        console.log(`[WorkflowEngine] Simulate sending email to ${to} | Subject: ${subject}`);
        return { success: true, to, subject, body };

      case 'action_http':
        const url = templateString(data.url);
        const method = (data.method || 'GET').toUpperCase();
        let headers = {};
        let requestBody = undefined;
        try {
          if (data.headers) headers = JSON.parse(templateString(data.headers));
          if (data.body) requestBody = JSON.parse(templateString(data.body));
        } catch(e) {
          console.warn('Failed to parse HTTP node JSON data', e);
        }
        
        try {
          const fetchRes = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', ...headers },
            body: requestBody ? JSON.stringify(requestBody) : undefined,
          });
          const responseData = await fetchRes.json().catch(() => null);
          return { status: fetchRes.status, data: responseData };
        } catch (e: any) {
          return { error: e.message };
        }

      case 'action_ai':
        const prompt = templateString(data.prompt);
        const provider = data.provider || 'openai';
        const aiService = new AIService();
        try {
          const result = await aiService.chat(provider as any, [{ role: 'user', content: prompt }], {
            systemPrompt: data.systemPrompt || 'You are an AI in an automated workflow.',
            model: data.model
          });
          return { response: result };
        } catch (e: any) {
          return { error: e.message };
        }

      case 'logic_condition':
        const conditionValue1 = templateString(data.value1);
        const conditionValue2 = templateString(data.value2);
        const operator = data.operator; // "equals", "not_equals", "contains"
        let isTrue = false;
        if (operator === 'equals') isTrue = conditionValue1 === conditionValue2;
        else if (operator === 'not_equals') isTrue = conditionValue1 !== conditionValue2;
        else if (operator === 'contains') isTrue = String(conditionValue1).includes(String(conditionValue2));
        
        return { result: isTrue };

      default:
        console.warn(`[WorkflowEngine] Unknown node type: ${type}`);
        return { error: `Unknown type: ${type}` };
    }
  }

  // BFS graph traversal
  async execute(workflowId: string, triggerData: any = {}): Promise<any> {
    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow || !workflow.nodes || !workflow.edges) {
      throw new Error('Workflow not found or missing nodes/edges');
    }

    const run = await prisma.workflowRun.create({
      data: {
        workflowId,
        status: 'RUNNING',
        inputData: triggerData,
      }
    });

    const nodes = workflow.nodes as any[];
    const edges = workflow.edges as any[];

    // find trigger node
    const triggerNode = nodes.find(n => n.type?.startsWith('trigger_'));
    if (!triggerNode) {
      await this.failRun(run.id, 'No trigger node found');
      return;
    }

    const context: any = { trigger: triggerData };
    const logs: any[] = [];
    
    // BFS queue (queue of node IDs)
    const queue: string[] = [triggerNode.id];
    const visited = new Set<string>();
    
    // Dependency tracking: tracks edge resolution states to ensure nodes wait for all incoming data
    const edgeStates = new Map<string, 'TRAVERSED' | 'SKIPPED'>();

    let currentError = null;

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;

      const node = nodes.find(n => n.id === nodeId);
      if (!node) continue;

      // --- DEPENDENCY COMPLETION CHECK ---
      if (nodeId !== triggerNode.id) {
        const incomingEdges = edges.filter(e => e.target === nodeId);
        
        // Check if all incoming edges have resolved (either traversed or intentionally skipped)
        const allResolved = incomingEdges.every(e => edgeStates.has(e.id));
        
        if (!allResolved) {
          // Wait for pending incoming edges. We will process this node later when the final edge resolves and pushes it again.
          continue; 
        }

        // If ALL incoming edges were skipped (dead path), skip this node and propagate SKIP downstream
        const allSkipped = incomingEdges.length > 0 && incomingEdges.every(e => edgeStates.get(e.id) === 'SKIPPED');
        if (allSkipped) {
          visited.add(nodeId);
          const outgoingEdges = edges.filter(e => e.source === nodeId);
          for (const edge of outgoingEdges) {
            edgeStates.set(edge.id, 'SKIPPED');
            queue.push(edge.target);
          }
          continue;
        }
      }

      visited.add(nodeId);

      logs.push({ time: new Date(), nodeId, type: node.type, message: 'Executing' });

      try {
        let retries = parseInt(node.data?.retries, 10);
        if (isNaN(retries) || retries < 0) retries = 0;
        
        let attempts = 0;
        let result: any;
        let lastError: Error | null = null;
        
        while (attempts <= retries) {
          attempts++;
          try {
            result = await this.executeNode(node, context, workflow.organizationId);
            if (result && result.error) {
              throw new Error(result.error);
            }
            lastError = null;
            break; // Success, break out of retry loop
          } catch (e: any) {
            lastError = e;
            if (attempts <= retries) {
               logs.push({ time: new Date(), nodeId, type: node.type, message: `Retry ${attempts}/${retries}` });
            }
          }
        }
        
        if (lastError) {
           throw lastError; // Exhausted retries or 0 retries
        }
        
        // Use node ID as variable namespace e.g. {{node_1.response}}
        // Also support user-defined output keys if needed in the future
        context[nodeId] = result;
        
        logs.push({ time: new Date(), nodeId, type: node.type, result });

        const outgoingEdges = edges.filter(e => e.source === nodeId);

        if (node.type === 'logic_condition') {
          const isTrue = result.result;
          for (const edge of outgoingEdges) {
            // Traverse the matching branch, skip the non-matching branch
            if (edge.sourceHandle === (isTrue ? 'true' : 'false')) {
              edgeStates.set(edge.id, 'TRAVERSED');
            } else {
              edgeStates.set(edge.id, 'SKIPPED');
            }
            queue.push(edge.target);
          }
        } else {
          for (const edge of outgoingEdges) {
            edgeStates.set(edge.id, 'TRAVERSED');
            queue.push(edge.target);
          }
        }

      } catch (err: any) {
        logs.push({ time: new Date(), nodeId, type: node.type, error: err.message });
        currentError = err.message;
        break; // stop execution on first error
      }
    }

    const updatedRun = await prisma.workflowRun.update({
      where: { id: run.id },
      data: {
        status: currentError ? 'FAILED' : 'COMPLETED',
        outputData: context,
        errorDetails: currentError,
        durationMs: Date.now() - run.startedAt.getTime(),
        // We'd store detailed logs elsewhere or serialize them in a new field, 
        // but for now context and errorDetails is what schema supports.
      }
    });

    return { success: !currentError, run: updatedRun, logs, context };
  }

  private async failRun(runId: string, errorMsg: string) {
    await prisma.workflowRun.update({
      where: { id: runId },
      data: { status: 'FAILED', errorDetails: errorMsg }
    });
  }
}

export const workflowEngine = new WorkflowEngine();
