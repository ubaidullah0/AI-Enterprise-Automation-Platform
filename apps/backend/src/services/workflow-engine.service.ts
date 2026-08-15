import { prisma } from '../utils/prisma';
import { AIService } from './ai.service';
import axios from 'axios';

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
          const res = await axios({ method, url, headers, data: requestBody });
          return { status: res.status, data: res.data };
        } catch (e: any) {
          return { error: e.message, response: e.response?.data };
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

    let currentError = null;

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const node = nodes.find(n => n.id === nodeId);
      if (!node) continue;

      logs.push({ time: new Date(), nodeId, type: node.type, message: 'Executing' });

      try {
        const result = await this.executeNode(node, context, workflow.organizationId);
        
        // Use node ID as variable namespace e.g. {{node_1.response}}
        // Also support user-defined output keys if needed in the future
        context[nodeId] = result;
        
        logs.push({ time: new Date(), nodeId, type: node.type, result });

        if (node.type === 'logic_condition') {
          const isTrue = result.result;
          const relevantEdges = edges.filter(e => e.source === nodeId && e.sourceHandle === (isTrue ? 'true' : 'false'));
          for (const edge of relevantEdges) queue.push(edge.target);
        } else {
          const nextEdges = edges.filter(e => e.source === nodeId);
          for (const edge of nextEdges) queue.push(edge.target);
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
