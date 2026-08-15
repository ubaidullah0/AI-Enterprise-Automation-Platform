import React, { useState } from 'react';
import { X, Sparkles, Loader2, ArrowRight, Check } from 'lucide-react';
import api from '../../../lib/api';
import { useNavigate } from 'react-router-dom';

interface AiWorkflowWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AiWorkflowWizard({ isOpen, onClose, onSuccess }: AiWorkflowWizardProps) {
  const [step, setStep] = useState<'prompt' | 'preview'>('prompt');
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState('openai');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedData, setGeneratedData] = useState<any>(null);
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const res = await api.post('/workflows/generate', { prompt, provider });
      
      if (res.data.success && res.data.data) {
        setGeneratedData(res.data.data);
        setStep('preview');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate workflow. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!generatedData) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.post('/workflows', {
        name: generatedData.name,
        description: generatedData.description,
        engine: 'native',
        nodes: generatedData.nodes,
        edges: generatedData.edges,
        triggerType: generatedData.nodes[0]?.data?.actionType || 'manual',
        aiGenerated: true,
        aiPrompt: generatedData.aiPrompt,
        aiExplanation: generatedData.explanation,
        aiProvider: generatedData.aiProvider,
        aiModel: generatedData.aiModel,
      });

      if (res.data.success && res.data.data) {
        if (onSuccess) onSuccess();
        onClose();
        navigate(`/workflows/${res.data.data.id}/builder`);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save workflow.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('prompt');
    setGeneratedData(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div 
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-800 bg-gray-800/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Sparkles size={18} />
            </div>
            <h2 className="text-lg font-semibold text-white">
              {step === 'prompt' ? 'Generate with AI ✨' : 'Preview Workflow'}
            </h2>
          </div>
          <button 
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'prompt' ? (
            <form onSubmit={handleGenerate}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Describe your automation
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g. Create a workflow that triggers every hour, fetches data from an API, and sends an email to the sales team."
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none transition-all h-32"
                    disabled={loading}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    AI Provider
                  </label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    disabled={loading}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="openai">OpenAI (gpt-4o)</option>
                    <option value="gemini">Google Gemini (gemini-2.0-flash)</option>
                    <option value="ollama">Ollama (llama3 - local)</option>
                  </select>
                  <p className="mt-1.5 text-xs text-gray-500">
                    OpenAI is recommended for the most accurate JSON graph generation.
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                    {error}
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="px-5 py-2.5 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Generating Magic...
                    </>
                  ) : (
                    <>
                      Preview Workflow
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">{generatedData?.name}</h3>
                <p className="text-sm text-gray-400">{generatedData?.description}</p>
              </div>

              <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">AI Explanation</h4>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {generatedData?.explanation}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                  <span className="block text-xs text-gray-500 mb-1">Nodes</span>
                  <span className="text-lg font-semibold text-gray-200">{generatedData?.nodes?.length || 0}</span>
                </div>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                  <span className="block text-xs text-gray-500 mb-1">Edges</span>
                  <span className="text-lg font-semibold text-gray-200">{generatedData?.edges?.length || 0}</span>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={reset}
                  disabled={loading}
                  className="px-5 py-2.5 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={handleApprove}
                  disabled={loading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  Approve & Build
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
