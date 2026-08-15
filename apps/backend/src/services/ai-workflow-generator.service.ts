import { aiService } from './ai.service';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const GeneratedGraphSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  explanation: z.string().min(1, 'Explanation is required'),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.enum(['triggerNode', 'actionNode']),
    position: z.object({ x: z.number(), y: z.number() }).optional(),
    data: z.object({
      label: z.string(),
      actionType: z.enum(['webhook', 'schedule', 'manual', 'http', 'email', 'ai', 'condition']),
      config: z.record(z.string(), z.any()).optional().default({})
    })
  })),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    type: z.string().optional().default('smoothstep')
  }))
});

export type GeneratedGraph = z.infer<typeof GeneratedGraphSchema>;

const SYSTEM_PROMPT = `You are an expert Automation Workflow Architect.
Your task is to take a natural language description of an automation workflow and convert it into a valid JSON representation of a React Flow graph.
Do not wrap your response in markdown code blocks. Output ONLY raw JSON.

The JSON schema must exactly match this interface:
{
  "name": "A short, concise name for the workflow",
  "description": "A brief description of what the workflow does",
  "explanation": "A user-friendly explanation of how the generated workflow works step-by-step.",
  "nodes": [
    {
      "id": "node-1",
      "type": "triggerNode" | "actionNode",
      "position": { "x": 0, "y": 0 },
      "data": {
        "label": "Name of the step",
        "actionType": "webhook" | "schedule" | "manual" | "http" | "email" | "ai" | "condition",
        "config": {}
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2",
      "type": "smoothstep"
    }
  ]
}

Rules:
1. Every workflow MUST start with exactly one "triggerNode" (actionType: webhook, schedule, or manual).
2. Following nodes should be "actionNode".
3. Assign incremental positions to nodes (e.g., y: 0, y: 150, y: 300) so they stack nicely vertically.
4. Provide sensible defaults in the "config" object based on the user's prompt (e.g. dummy email addresses, API URLs).
5. Ensure that all edges point to valid node IDs that exist in the "nodes" array.
6. Output ONLY valid JSON.
`;

export class AiWorkflowGeneratorService {
  async generateWorkflowFromJson(prompt: string, provider: string = 'openai', apiKeyOverride?: string): Promise<GeneratedGraph> {
    const aiProvider = aiService.getProvider(provider, apiKeyOverride);
    
    // We request the AI to generate the graph
    const rawResponse = await aiProvider.generateChatResponse([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ], {
      // It's recommended to use a low temperature for predictable JSON schemas
      temperature: 0.1,
      maxTokens: 2000,
    });

    try {
      // Clean up markdown wrapping if the AI ignored instructions
      let cleaned = rawResponse.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\n?/, '');
      if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\n?/, '');
      if (cleaned.endsWith('```')) cleaned = cleaned.replace(/\n?```$/, '');
      
      const parsed = JSON.parse(cleaned.trim());

      // 1. Zod Validation
      const validated = GeneratedGraphSchema.parse(parsed);

      // 2. Graph Integrity Validation
      const triggerNodes = validated.nodes.filter(n => n.type === 'triggerNode');
      if (triggerNodes.length !== 1) {
        throw new Error(`Graph must contain exactly 1 triggerNode. Found ${triggerNodes.length}.`);
      }

      const nodeIds = new Set(validated.nodes.map(n => n.id));
      for (const edge of validated.edges) {
        if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
          throw new Error(`Invalid edge connecting ${edge.source} to ${edge.target}. Node does not exist.`);
        }
      }

      // Ensure every node has a unique ID and proper format
      const idMap = new Map<string, string>();
      const processedNodes = validated.nodes.map((node, index) => {
        const newId = randomUUID();
        idMap.set(node.id, newId);
        return {
          ...node,
          id: newId,
          position: node.position || { x: 250, y: index * 150 },
        };
      });

      const processedEdges = validated.edges.map(edge => ({
        ...edge,
        id: randomUUID(),
        source: idMap.get(edge.source) || edge.source,
        target: idMap.get(edge.target) || edge.target,
      }));

      return {
        ...validated,
        nodes: processedNodes,
        edges: processedEdges,
      };
    } catch (error: any) {
      console.error('Failed to parse AI generated workflow:', error.message, rawResponse);
      throw new Error('Failed to generate workflow. The AI produced an invalid graph format: ' + error.message);
    }
  }
}

export const aiWorkflowGenerator = new AiWorkflowGeneratorService();
