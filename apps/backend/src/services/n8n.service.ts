import axios from 'axios';

class N8nService {
  private client;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.N8N_URL ? `${process.env.N8N_URL}/api/v1` : 'http://localhost:5678/api/v1',
    });

    // Read API key dynamically on every request so .env changes are always used
    this.client.interceptors.request.use((config) => {
      config.headers['X-N8N-API-KEY'] = process.env.N8N_API_KEY || '';
      return config;
    });
  }

  async listWorkflows() {
    const res = await this.client.get('/workflows');
    return res.data;
  }

  async getWorkflow(id: string) {
    const res = await this.client.get(`/workflows/${id}`);
    return res.data;
  }

  async createWorkflow(name: string, nodes: any[] = [], connections: any = {}) {
    const res = await this.client.post('/workflows', {
      name,
      nodes,
      connections,
      settings: {}
    });
    return res.data;
  }

  async updateWorkflow(id: string, data: any) {
    const res = await this.client.put(`/workflows/${id}`, data);
    return res.data;
  }

  async deleteWorkflow(id: string) {
    const res = await this.client.delete(`/workflows/${id}`);
    return res.data;
  }

  async activateWorkflow(id: string) {
    const res = await this.client.post(`/workflows/${id}/activate`);
    return res.data;
  }

  async deactivateWorkflow(id: string) {
    const res = await this.client.post(`/workflows/${id}/deactivate`);
    return res.data;
  }

  async executeWorkflow(id: string) {
    // There are a few ways to execute in n8n, typically POST /workflows/{id}/execute
    // Assuming standard n8n REST API or Webhook trigger.
    // For n8n API v1, there's no direct "execute" endpoint via REST unless using a webhook node, 
    // but newer versions support execution via API if enterprise/cloud, or we can use the trigger URL.
    // We'll mock the execute call or attempt a standard trigger.
    console.warn('Executing workflow via API may require webhook nodes.');
    const res = await this.client.post(`/workflows/${id}/execute`);
    return res.data;
  }

  async getExecutions(workflowId?: string) {
    const url = workflowId ? `/executions?workflowId=${workflowId}` : '/executions';
    const res = await this.client.get(url);
    return res.data;
  }
}

export const n8nService = new N8nService();
