import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';
import ReactMarkdown from 'react-markdown';
import {
  Send, Bot, User, MessageSquare, Plus, Loader2, Trash2, Sparkles, ChevronDown
} from 'lucide-react';

interface Conversation {
  id: string;
  title: string;
  provider: string;
  updatedAt: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const PROVIDERS = [
  { id: 'openai', name: 'GPT-4o', color: 'from-emerald-500 to-teal-400' },
  // Gemini: add back once a billing-enabled key is configured
  // { id: 'gemini', name: 'Gemini 2.0 Flash', color: 'from-blue-500 to-cyan-400' },
];

const providerBadge: Record<string, string> = {
  gemini: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  openai: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  ollama: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};


export default function AssistantDashboard() {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState('openai');
  const [providerOpen, setProviderOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeProvider = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0];

  useEffect(() => {
    if (user?.activeOrganizationId) fetchConversations();
  }, [user?.activeOrganizationId]);

  useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 128) + 'px';
    }
  }, [input]);

  const fetchConversations = async () => {
    try {
      const res = await api.get('/ai/conversations');
      if (res.data.success) setConversations(res.data.data);
    } catch {}
  };

  const fetchMessages = async (id: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/ai/conversations/${id}/messages`);
      if (res.data.success) setMessages(res.data.data);
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setInput('');
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    try {
      await api.delete(`/ai/conversations/${id}`);
      if (activeConversationId === id) handleNewChat();
      fetchConversations();
    } catch {}
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    // Guard: no org selected
    if (!user?.activeOrganizationId) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant' as const,
        content: '⚠️ **No organization selected.**\n\nPlease click "Select Organization" in the top header and create or select an organization before using the AI assistant.'
      }]);
      return;
    }

    const userContent = input.trim();
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user' as const, content: userContent }]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', {
        prompt: userContent,
        conversationId: activeConversationId,
        provider,
      });

      if (res.data.success) {
        if (!activeConversationId) {
          setActiveConversationId(res.data.data.conversationId);
          fetchConversations();
        }
        setMessages(prev => [...prev, {
          id: res.data.data.messageId || (Date.now() + 1).toString(),
          role: 'assistant' as const,
          content: res.data.data.response
        }]);
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message || 'Unknown error';
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: `⚠️ **Error:** ${errMsg}\n\nCheck that your API keys are set in the backend .env file and the selected provider is configured.`
      }]);
    } finally {
      setLoading(false);
    }
  };

  const SUGGESTED_PROMPTS = [
    'Summarize my active automation workflows',
    'How can I set up a lead nurturing automation?',
    'What are best practices for multi-tenant SaaS security?',
    'Write a SQL query to get active users from last 30 days',
  ];

  return (
    <div className="flex h-[calc(100vh-8rem)] border border-gray-800 rounded-xl overflow-hidden shadow-2xl" style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0d1117 100%)' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <div className="w-72 bg-gray-900/80 border-r border-gray-800 flex flex-col backdrop-blur-md">
        <div className="p-4 border-b border-gray-800">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-500/10"
          >
            <Plus size={18} />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {conversations.length === 0 && (
            <p className="text-center text-gray-500 text-xs py-8">No conversations yet</p>
          )}
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => setActiveConversationId(conv.id)}
              className={`w-full group text-left px-3 py-2.5 rounded-lg flex items-start gap-3 transition-all ${
                activeConversationId === conv.id
                  ? 'bg-blue-600/10 border border-blue-500/20 text-blue-300'
                  : 'text-gray-400 hover:bg-gray-800/60 border border-transparent'
              }`}
            >
              <MessageSquare size={15} className="shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium truncate block">{conv.title}</span>
                <span className={`text-xs mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded border ${providerBadge[conv.provider] || providerBadge['gemini']}`}>
                  {conv.provider}
                </span>
              </div>
              <button
                onClick={(e) => handleDeleteConversation(conv.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 rounded transition-all shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Chat Area ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="h-14 border-b border-gray-800 bg-gray-900/40 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-blue-400" />
            <span className="font-semibold text-gray-200">AI Assistant</span>
          </div>

          {/* Provider Selector */}
          <div className="relative">
            <button
              onClick={() => setProviderOpen(!providerOpen)}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm px-3 py-1.5 rounded-lg transition-colors"
            >
              <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${activeProvider.color}`} />
              <span className="text-gray-300">{activeProvider.name}</span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>
            {providerOpen && (
              <div className="absolute top-full right-0 mt-2 w-52 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-700">
                  Select Provider
                </div>
                {PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setProvider(p.id); setProviderOpen(false); }}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                      provider === p.id ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-750'
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${p.color} shrink-0`} />
                    {p.name}
                    {provider === p.id && <span className="ml-auto text-xs text-blue-400">Active</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {messages.length === 0 && !loading ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${activeProvider.color} flex items-center justify-center mb-6 shadow-2xl`}>
                <Bot size={36} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-white">How can I help you?</h2>
              <p className="text-gray-400 max-w-md mb-8">
                I'm your enterprise AI assistant powered by <strong className="text-gray-200">{activeProvider.name}</strong>. Ask me anything.
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-xl w-full">
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(prompt)}
                    className="text-left bg-gray-900/60 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl p-4 text-sm text-gray-400 hover:text-gray-200 transition-all"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${activeProvider.color} shadow-lg`}>
                    <Bot size={18} className="text-white" />
                  </div>
                )}
                <div className={`max-w-[75%] px-5 py-4 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-900 border border-gray-800 text-gray-200 rounded-bl-sm'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-gray-950 prose-pre:border prose-pre:border-gray-700 prose-code:bg-gray-800 prose-code:px-1 prose-code:rounded">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-tr from-blue-500 to-purple-500 shadow-lg">
                    <User size={18} className="text-white" />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="flex gap-4 justify-start">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${activeProvider.color}`}>
                <Bot size={18} className="text-white" />
              </div>
              <div className="px-5 py-4 rounded-2xl rounded-bl-sm bg-gray-900 border border-gray-800 flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 px-6 py-4 border-t border-gray-800 bg-gray-900/40 backdrop-blur-md">
          <form onSubmit={handleSend} className="flex items-end gap-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
              }}
              placeholder={`Message ${activeProvider.name}... (Shift+Enter for newline)`}
              className="flex-1 bg-gray-950/80 border border-gray-700 focus:border-blue-500 rounded-xl py-3 px-4 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none min-h-[52px] max-h-32 text-sm transition-all"
              rows={1}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className={`h-[52px] w-[52px] rounded-xl flex items-center justify-center transition-all shrink-0 shadow-lg ${
                input.trim() && !loading
                  ? 'bg-gradient-to-br from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            </button>
          </form>
          <p className="text-center text-xs text-gray-600 mt-2">
            AI responses may be inaccurate. Always verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}
