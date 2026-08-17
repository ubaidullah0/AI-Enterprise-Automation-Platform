import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import api, { getApiBaseUrl } from '../../lib/api';
import ReactMarkdown from 'react-markdown';
import {
  Send, Bot, User, MessageSquare, Plus, Loader2, Trash2, Sparkles, ChevronDown, Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

interface AIProvider {
  id: string;
  name: string;
  color: string;
}

const providerBadge: Record<string, string> = {
  gemini: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  openai: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  ollama: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};


const DEFAULT_PROVIDERS: AIProvider[] = [
  { id: 'openai', name: 'GPT-4o', color: 'from-emerald-500 to-teal-400' },
  { id: 'gemini', name: 'Gemini 2.0 Flash', color: 'from-blue-500 to-cyan-400' },
];

export default function AssistantDashboard() {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<AIProvider[]>(DEFAULT_PROVIDERS);
  const [provider, setProvider] = useState('openai');
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeProvider = providers.find(p => p.id === provider) || providers[0] || DEFAULT_PROVIDERS[0];

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await api.get('/ai/providers');
        if (res.data.success && res.data.data.length > 0) {
          setProviders(res.data.data);
          if (!res.data.data.find((p: AIProvider) => p.id === provider)) {
            setProvider(res.data.data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch providers', err);
      }
    };
    fetchProviders();
  }, []);

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
      const authToken = useAuthStore.getState().accessToken;
      // Use absolute backend URL (works in both local dev and production)
      const streamUrl = `${getApiBaseUrl()}/ai/chat/stream`;
      const response = await fetch(streamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'x-organization-id': user.activeOrganizationId,
        },
        body: JSON.stringify({
          prompt: userContent,
          conversationId: activeConversationId,
          provider,
        })
      });


      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to communicate with AI');
      }

      // Add a placeholder message for the assistant's stream
      const tempMessageId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: tempMessageId,
        role: 'assistant' as const,
        content: ''
      }]);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No readable stream');

      let currentText = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('data: ')) {
            const dataStr = trimmedLine.slice(6);
            if (!dataStr) continue;
            
            let data: any = null;
            try {
              data = JSON.parse(dataStr);
            } catch (e) {
              console.error('SSE JSON parse error', e, dataStr);
              continue;
            }
            
            if (data.error) {
              setMessages(prev => prev.map(msg => 
                msg.id === tempMessageId ? { ...msg, content: `⚠️ **API Error:** ${data.error}` } : msg
              ));
              return; // Stop reading the stream completely
            }
            
            if (data.token) {
              currentText += data.token;
              setMessages(prev => prev.map(msg => 
                msg.id === tempMessageId ? { ...msg, content: currentText } : msg
              ));
            }
            if (data.done) {
              if (!activeConversationId) {
                setActiveConversationId(data.conversationId);
                fetchConversations();
              }
              setMessages(prev => prev.map(msg => 
                msg.id === tempMessageId ? { ...msg, id: data.messageId } : msg
              ));
            }
          }
        }
      }
    } catch (error: any) {
      const isNetworkError = !error.response && (
        error.message?.includes('fetch') ||
        error.message?.includes('network') ||
        error.message?.includes('Failed') ||
        error.name === 'TypeError'
      );
      const errMsg = isNetworkError
        ? 'Unable to reach the AI service. The backend may be starting up — please wait 30 seconds and try again.'
        : error.message || 'Unknown error occurred';
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant' as const,
        content: `⚠️ **Error:** ${errMsg}`
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
    <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-7rem)] border border-gray-800 rounded-xl overflow-hidden shadow-2xl relative" style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0d1117 100%)' }}>

      {/* ── Mobile Sidebar Overlay ────────────────────────────────────────── */}
      {chatSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden"
          onClick={() => setChatSidebarOpen(false)}
        />
      )}

      {/* ── Conversations Sidebar ─────────────────────────────────────────── */}
      <div className={`fixed md:relative inset-y-0 left-0 z-30 md:z-auto w-72 h-full bg-gray-900/95 md:bg-gray-900/80 border-r border-gray-800 flex flex-col backdrop-blur-md transition-transform duration-300 ${chatSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-4 border-b border-gray-800 flex items-center justify-between gap-2">
          <button
            onClick={() => { handleNewChat(); setChatSidebarOpen(false); }}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-500/10 text-sm"
          >
            <Plus size={16} />
            New Chat
          </button>
          <button 
            className="md:hidden p-2 rounded-xl bg-gray-800 text-gray-400 hover:text-white transition-colors"
            onClick={() => setChatSidebarOpen(false)}
          >
            <Menu size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {conversations.length === 0 && (
            <p className="text-center text-gray-500 text-xs py-8">No conversations yet</p>
          )}
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => { setActiveConversationId(conv.id); setChatSidebarOpen(false); }}
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
      <div className="flex-1 flex flex-col overflow-hidden relative min-w-0">

        {/* Header */}
        <div className="h-14 border-b border-gray-800 bg-gray-900/40 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              className="md:hidden p-1.5 rounded-lg bg-gray-800/50 text-gray-400 hover:text-white"
              onClick={() => setChatSidebarOpen(true)}
              title="Open Chat History"
            >
              <Menu size={18} />
            </button>
            <Sparkles size={18} className="text-blue-400 hidden sm:block" />
            <span className="font-semibold text-gray-200 text-sm sm:text-base">AI Assistant</span>
          </div>

          {/* Provider Selector */}
          <div className="relative">
            <button
              onClick={() => setProviderDropdownOpen(!providerDropdownOpen)}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors"
            >
              <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${activeProvider.color}`} />
              <span className="text-gray-300 truncate max-w-[120px] sm:max-w-none">{activeProvider.name}</span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>
            {providerDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProviderDropdownOpen(false)} />
                <div className="absolute top-full right-0 mt-2 w-52 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-700">
                    Select Provider
                  </div>
                  <div className="py-2">
                    {providers.length === 0 ? (
                      <div className="px-4 py-2 text-sm text-gray-400">No providers configured in Settings.</div>
                    ) : (
                      providers.map(p => (
                        <button
                          key={p.id}
                          onClick={() => { setProvider(p.id); setProviderDropdownOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-gray-700/50 transition-colors ${provider === p.id ? 'text-white bg-gray-700/30' : 'text-gray-300'}`}
                        >
                          <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${p.color}`} />
                          {p.name}
                          {provider === p.id && <span className="ml-auto text-xs text-blue-400">Active</span>}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
          {messages.length === 0 && !loading ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-2 py-6">
              <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br ${activeProvider.color} flex items-center justify-center mb-4 sm:mb-6 shadow-2xl`}>
                <Bot size={30} className="text-white sm:w-9 sm:h-9" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold mb-2 text-white">How can I help you?</h2>
              <p className="text-gray-400 max-w-md mb-6 text-xs sm:text-sm">
                I'm your enterprise AI assistant powered by <strong className="text-gray-200">{activeProvider.name}</strong>. Ask me anything.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl w-full">
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(prompt)}
                    className="text-left bg-gray-900/60 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl p-3 sm:p-4 text-xs sm:text-sm text-gray-400 hover:text-gray-200 transition-all"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div 
                  key={msg.id} 
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3, type: "spring", bounce: 0.4 }}
                  className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${activeProvider.color} shadow-lg`}>
                      <Bot size={18} className="text-white" />
                    </div>
                  )}
                  <div className={`max-w-[85%] md:max-w-[75%] px-5 py-4 rounded-2xl text-sm leading-relaxed overflow-x-auto ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm shadow-md'
                      : 'bg-gray-900 border border-gray-800 text-gray-200 rounded-bl-sm shadow-md'
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
                </motion.div>
              ))}
            </AnimatePresence>
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
        <div className="shrink-0 px-3 sm:px-6 py-3 sm:py-4 border-t border-gray-800 bg-gray-900/40 backdrop-blur-md">
          <form onSubmit={handleSend} className="flex items-end gap-2 sm:gap-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
              }}
              placeholder={`Message ${activeProvider.name}... (Shift+Enter for newline)`}
              className="flex-1 bg-gray-950/80 border border-gray-700 focus:border-blue-500 rounded-xl py-2.5 sm:py-3 px-3 sm:px-4 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none min-h-[46px] sm:min-h-[52px] max-h-32 text-xs sm:text-sm transition-all"
              rows={1}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className={`h-[46px] w-[46px] sm:h-[52px] sm:w-[52px] rounded-xl flex items-center justify-center transition-all shrink-0 shadow-lg ${
                input.trim() && !loading
                  ? 'bg-gradient-to-br from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
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
