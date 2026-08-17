class N8nService {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.N8N_URL
      ? `${process.env.N8N_URL}/api/v1`
      : 'http://localhost:5680/api/v1';
  }

  private async request(method: string, path: string, body?: any) {
    const apiKey = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjZDQxMTRhYS1iZWY2LTQ2YjEtOTZlNC1mNGI0NWJjMjZlY2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNWRlNWI4MjUtYzZkZC00ZmQ4LTg3ZmMtZWE0M2VhM2MzMmQ4IiwiaWF0IjoxNzg2NzkyNzM4fQ.lWxalIURpiwxYo34rycEyvEk4TF9Sa0w9XbM6rSJx2k';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch(`${this.baseURL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`n8n API error ${res.status}: ${text}`);
      }
      return res.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  async listWorkflows() {
    return this.request('GET', '/workflows');
  }

  async getWorkflow(id: string) {
    return this.request('GET', `/workflows/${id}`);
  }

  async createWorkflow(name: string, nodes: any[] = [], connections: any = {}) {
    return this.request('POST', '/workflows', { name, nodes, connections, settings: {} });
  }

  async updateWorkflow(id: string, data: any) {
    return this.request('PUT', `/workflows/${id}`, data);
  }

  async deleteWorkflow(id: string) {
    return this.request('DELETE', `/workflows/${id}`);
  }

  async activateWorkflow(id: string) {
    return this.request('POST', `/workflows/${id}/activate`);
  }

  async deactivateWorkflow(id: string) {
    return this.request('POST', `/workflows/${id}/deactivate`);
  }

  async executeWorkflow(id: string) {
    console.warn('Executing workflow via API may require webhook nodes.');
    return this.request('POST', `/workflows/${id}/execute`);
  }

  async getExecutions(workflowId?: string) {
    const path = workflowId ? `/executions?workflowId=${workflowId}` : '/executions';
    return this.request('GET', path);
  }
}

export const n8nService = new N8nService();
