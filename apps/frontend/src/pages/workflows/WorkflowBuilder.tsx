import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, Panel } from '@xyflow/react';
import type { Connection, Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Play, Save, ArrowLeft, Settings } from 'lucide-react';
import api from '../../lib/api';

const initialNodes = [
  { id: '1', type: 'trigger_webhook', data: { label: 'Webhook Trigger' }, position: { x: 250, y: 50 } },
];

export default function WorkflowBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [workflow, setWorkflow] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const reactFlowWrapper = useRef(null);

  useEffect(() => {
    // Fetch workflow data
    const fetchWorkflow = async () => {
      try {
        const res = await api.get(`/workflows`);
        const wf = res.data.data.find((w: any) => w.id === id);
        if (wf) {
          setWorkflow(wf);
          if (Array.isArray(wf.nodes) && wf.nodes.length > 0) setNodes(wf.nodes);
          if (Array.isArray(wf.edges)) setEdges(wf.edges);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchWorkflow();
  }, [id, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/workflows/${id}/canvas`, { nodes, edges });
      alert('Workflow saved!');
    } catch {
      alert('Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  const handleExecute = async () => {
    setRunning(true);
    try {
      await api.put(`/workflows/${id}/canvas`, { nodes, edges });
      const res = await api.post(`/workflows/${id}/execute`, { triggerData: { test: true } });
      alert('Workflow executed successfully!\n' + JSON.stringify(res.data.data, null, 2));
    } catch (err: any) {
      alert('Execution failed:\n' + (err.response?.data?.message || err.message));
    } finally {
      setRunning(false);
    }
  };

  const addNode = (type: string, label: string) => {
    const newNode = {
      id: `${Date.now()}`,
      type,
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      data: { label },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const onNodeClick = (_: any, node: Node) => {
    setSelectedNode(node);
  };

  const updateNodeData = (key: string, value: string) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNode.id) {
          return { ...n, data: { ...n.data, [key]: value } };
        }
        return n;
      })
    );
    setSelectedNode((prev: any) => ({ ...prev, data: { ...prev.data, [key]: value } }));
  };

  const updateNodeType = (newType: string) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNode.id) {
          return { ...n, type: newType };
        }
        return n;
      })
    );
    setSelectedNode((prev: any) => ({ ...prev, type: newType }));
  }

  if (!workflow) return <div className="p-8 text-white">Loading builder...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-gray-800 bg-gray-950 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/workflows')} className="p-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-bold text-white">{workflow.name}</h2>
            <p className="text-xs text-gray-500">Native Engine</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {workflow.webhookToken && (
            <div className="text-xs bg-gray-800 text-gray-400 px-3 py-1.5 rounded-lg border border-gray-700 font-mono">
              Webhook: /api/v1/webhooks/{workflow.webhookToken}
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors border border-gray-700 text-sm"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleExecute}
            disabled={running}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <Play size={16} />
            {running ? 'Running...' : 'Run Test'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar Palette */}
        <div className="w-64 border-r border-gray-800 bg-gray-950 p-4 flex flex-col gap-4 overflow-y-auto">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Add Nodes</h3>
          
          <button onClick={() => addNode('action_http', 'HTTP Request')} className="text-left bg-gray-900 border border-gray-800 hover:border-blue-500 p-3 rounded-xl transition-all">
            <div className="text-blue-400 font-semibold mb-1">HTTP Request</div>
            <div className="text-xs text-gray-500">Make an external API call</div>
          </button>
          
          <button onClick={() => addNode('action_ai', 'AI Prompt')} className="text-left bg-gray-900 border border-gray-800 hover:border-purple-500 p-3 rounded-xl transition-all">
            <div className="text-purple-400 font-semibold mb-1">AI Prompt</div>
            <div className="text-xs text-gray-500">Generate text with OpenAI/Ollama</div>
          </button>
          
          <button onClick={() => addNode('action_email', 'Send Email')} className="text-left bg-gray-900 border border-gray-800 hover:border-emerald-500 p-3 rounded-xl transition-all">
            <div className="text-emerald-400 font-semibold mb-1">Send Email</div>
            <div className="text-xs text-gray-500">Send an automated email</div>
          </button>

          <button onClick={() => addNode('logic_condition', 'Condition')} className="text-left bg-gray-900 border border-gray-800 hover:border-amber-500 p-3 rounded-xl transition-all">
            <div className="text-amber-400 font-semibold mb-1">Condition (If/Else)</div>
            <div className="text-xs text-gray-500">Branch based on logic</div>
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            fitView
            className="bg-gray-900"
            colorMode="dark"
          >
            <Background color="#374151" gap={16} />
            <Controls />
            <MiniMap nodeColor="#4b5563" maskColor="#11182780" />
            
            <Panel position="top-center" className="bg-gray-800/80 backdrop-blur text-xs px-4 py-2 rounded-full border border-gray-700 text-gray-300">
              Drag nodes to the canvas and connect them to build your workflow.
            </Panel>
          </ReactFlow>
        </div>

        {/* Right Sidebar - Config */}
        {selectedNode && (
          <div className="w-80 border-l border-gray-800 bg-gray-950 flex flex-col">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Settings size={16} className="text-gray-400" />
                Configure Node
              </h3>
              <button onClick={() => setSelectedNode(null)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Node Type (Execution)</label>
                <select 
                  value={selectedNode.type} 
                  onChange={(e) => updateNodeType(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white text-sm"
                >
                  <option value="default">Visual Only (No-op)</option>
                  <option value="trigger_webhook">Webhook Trigger</option>
                  <option value="action_http">HTTP Request</option>
                  <option value="action_ai">AI Prompt</option>
                  <option value="action_email">Send Email</option>
                  <option value="logic_condition">Condition</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Label</label>
                <input 
                  type="text" 
                  value={selectedNode.data.label as string || ''} 
                  onChange={(e) => updateNodeData('label', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white text-sm"
                />
              </div>

              {selectedNode.type === 'action_http' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Method</label>
                    <input type="text" placeholder="GET" value={selectedNode.data.method as string || ''} onChange={(e) => updateNodeData('method', e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">URL</label>
                    <input type="text" placeholder="https://api.example.com" value={selectedNode.data.url as string || ''} onChange={(e) => updateNodeData('url', e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">JSON Body</label>
                    <textarea rows={4} value={selectedNode.data.body as string || ''} onChange={(e) => updateNodeData('body', e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white text-sm font-mono" placeholder='{"key": "{{1.response}}"}' />
                  </div>
                </>
              )}

              {selectedNode.type === 'action_ai' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Prompt</label>
                    <textarea rows={4} value={selectedNode.data.prompt as string || ''} onChange={(e) => updateNodeData('prompt', e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white text-sm font-mono" placeholder="Summarize {{1.data.text}}" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Provider</label>
                    <select value={selectedNode.data.provider as string || 'openai'} onChange={(e) => updateNodeData('provider', e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white text-sm">
                      <option value="openai">OpenAI</option>
                      <option value="gemini">Gemini</option>
                      <option value="anthropic">Anthropic</option>
                    </select>
                  </div>
                </>
              )}

              {selectedNode.type === 'action_email' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">To</label>
                    <input type="text" value={selectedNode.data.to as string || ''} onChange={(e) => updateNodeData('to', e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Subject</label>
                    <input type="text" value={selectedNode.data.subject as string || ''} onChange={(e) => updateNodeData('subject', e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Body</label>
                    <textarea rows={4} value={selectedNode.data.body as string || ''} onChange={(e) => updateNodeData('body', e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white text-sm" />
                  </div>
                </>
              )}

              <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg text-xs text-blue-300">
                <strong className="block mb-1">Tip: Use variables!</strong>
                You can inject output from previous nodes using <code>{"{{nodeId.result}}"}</code>. Example: <code>{"{{1.response}}"}</code>
                <br/>Your Node ID is: <code className="font-mono bg-blue-900/50 px-1 rounded">{selectedNode.id}</code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
