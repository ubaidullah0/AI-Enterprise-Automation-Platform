/**
 * ApiKeyManager.tsx
 *
 * Settings panel for managing organization-level AI provider API keys.
 * Keys are encrypted server-side (AES-256-GCM) â€” only key hints are displayed.
 *
 * Providers: OpenAI | Gemini | Anthropic | Azure OpenAI
 * Access: OWNER and ADMIN roles only.
 */

import React, { useState, useEffect, useCallback } from 'react';
import api from '../../../lib/api';
import {
  Key, Plus, Trash2, CheckCircle2, XCircle, RefreshCw,
  Star, StarOff, ChevronDown, ChevronUp, Loader2, Eye, EyeOff,
  Info, AlertTriangle, Zap
} from 'lucide-react';

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface OrgApiKey {
  id: string;
  provider: string;
  model: string | null;
  label: string;
  keyHint: string;
  status: 'ACTIVE' | 'INACTIVE' | 'INVALID';
  isDefault: boolean;
  lastUsedAt: string | null;
  lastValidatedAt: string | null;
  createdAt: string;
  creator: { id: string; firstName: string | null; lastName: string | null; email: string };
}

interface ValidationResult {
  valid: boolean;
  message: string;
  latencyMs?: number;
}

// â”€â”€ Provider config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ProviderConfig {
  name: string;
  color: string;          // border + accent
  bg: string;             // card bg gradient
  logo: string;           // emoji placeholder
  keyPrefix: string;      // hint for users
  defaultModel: string;
  modelOptions: string[];
  docsUrl: string;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  openai: {
    name: 'OpenAI',
    color: 'border-emerald-500/30',
    bg: 'from-emerald-950/30 to-transparent',
    logo: 'ðŸ¤–',
    keyPrefix: 'sk-...',
    defaultModel: 'gpt-4o',
    modelOptions: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  gemini: {
    name: 'Google Gemini',
    color: 'border-blue-500/30',
    bg: 'from-blue-950/30 to-transparent',
    logo: 'âœ¨',
    keyPrefix: 'AIza...',
    defaultModel: 'gemini-2.0-flash',
    modelOptions: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'],
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
  anthropic: {
    name: 'Anthropic Claude',
    color: 'border-amber-500/30',
    bg: 'from-amber-950/20 to-transparent',
    logo: 'ðŸ§ ',
    keyPrefix: 'sk-ant-...',
    defaultModel: 'claude-3-5-sonnet-20241022',
    modelOptions: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  'azure-openai': {
    name: 'Azure OpenAI',
    color: 'border-sky-500/30',
    bg: 'from-sky-950/20 to-transparent',
    logo: 'â˜ï¸',
    keyPrefix: '32-char key...',
    defaultModel: 'gpt-4o',
    modelOptions: ['gpt-4o', 'gpt-4-turbo', 'gpt-35-turbo'],
    docsUrl: 'https://portal.azure.com/#view/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/~/OpenAI',
  },
};

// â”€â”€ Status badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    ACTIVE:   { cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: <CheckCircle2 size={11} />, label: 'Active' },
    INACTIVE: { cls: 'bg-gray-700/50 text-gray-500 border-gray-700',             icon: <XCircle size={11} />,      label: 'Inactive' },
    INVALID:  { cls: 'bg-red-500/10 text-red-400 border-red-500/20',             icon: <AlertTriangle size={11} />, label: 'Invalid' },
  };
  const { cls, icon, label } = map[status] || map['INACTIVE'];
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cls}`}>
      {icon} {label}
    </span>
  );
};

// â”€â”€ Add Key Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface AddKeyFormProps {
  provider: string;
  config: ProviderConfig;
  onSuccess: () => void;
  onCancel: () => void;
}

const AddKeyForm: React.FC<AddKeyFormProps> = ({ provider, config, onSuccess, onCancel }) => {
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(config.defaultModel);
  const [isDefault, setIsDefault] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !apiKey.trim()) return;
    setLoading(true);
    setError(null);
    setValidation(null);

    try {
      const res = await api.post('/org-api-keys', { provider, label: label.trim(), apiKey: apiKey.trim(), model, isDefault });
      if (res.data.success) {
        setValidation(res.data.data.validation);
        setTimeout(() => onSuccess(), 1000);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.message || 'Failed to add key';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 p-4 bg-gray-950 border border-gray-800 rounded-xl space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 font-medium mb-1 block">Label *</label>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder='e.g. "Production Key"'
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
            required
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium mb-1 block">Default Model</label>
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
          >
            {config.modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 font-medium mb-1 block">
          API Key * <span className="text-gray-600">({config.keyPrefix})</span>
        </label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={`Your ${config.name} API key`}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-gray-600 font-mono focus:outline-none focus:border-blue-500 transition-colors"
            required
          />
          <button
            type="button"
            onClick={() => setShowKey(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={e => setIsDefault(e.target.checked)}
          className="w-4 h-4 rounded accent-blue-500"
        />
        Set as default key for {config.name}
      </label>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <XCircle size={14} />
          {error}
        </div>
      )}

      {validation && (
        <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 border ${
          validation.valid
            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            : 'text-red-400 bg-red-500/10 border-red-500/20'
        }`}>
          {validation.valid ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {validation.message}
          {validation.latencyMs && <span className="text-gray-500 ml-1">({validation.latencyMs}ms)</span>}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !label.trim() || !apiKey.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {loading ? 'Validating & Saving...' : 'Add Key'}
        </button>
      </div>
    </form>
  );
};

// â”€â”€ Key Row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface KeyRowProps {
  keyData: OrgApiKey;
  onRefresh: () => void;
}

const KeyRow: React.FC<KeyRowProps> = ({ keyData, onRefresh }) => {
  const [validating, setValidating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [settingDefault, setSettingDefault] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const handleValidate = async () => {
    setValidating(true);
    setValidationResult(null);
    try {
      const res = await api.post(`/org-api-keys/${keyData.id}/validate`);
      if (res.data.success) {
        setValidationResult(res.data.data);
        onRefresh();
      }
    } catch {
      setValidationResult({ valid: false, message: 'Validation request failed' });
    } finally {
      setValidating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete key "${keyData.label}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/org-api-keys/${keyData.id}`);
      onRefresh();
    } catch {
      setDeleting(false);
    }
  };

  const handleSetDefault = async () => {
    setSettingDefault(true);
    try {
      await api.post(`/org-api-keys/${keyData.id}/default`);
      onRefresh();
    } catch {
      setSettingDefault(false);
    }
  };

  return (
    <div className="group px-4 py-3 hover:bg-gray-800/30 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white">{keyData.label}</span>
            <StatusBadge status={keyData.status} />
            {keyData.isDefault && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20 font-medium">
                <Star size={10} /> Default
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span className="font-mono bg-gray-800 px-1.5 py-0.5 rounded">{keyData.keyHint}</span>
            {keyData.model && <span>{keyData.model}</span>}
            {keyData.lastUsedAt && (
              <span>Used {new Date(keyData.lastUsedAt).toLocaleDateString()}</span>
            )}
            <span>Added by {keyData.creator.firstName || keyData.creator.email}</span>
          </div>
          {validationResult && (
            <div className={`mt-1.5 flex items-center gap-1.5 text-xs ${validationResult.valid ? 'text-emerald-400' : 'text-red-400'}`}>
              {validationResult.valid ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
              {validationResult.message}
              {validationResult.latencyMs && <span className="text-gray-600">({validationResult.latencyMs}ms)</span>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!keyData.isDefault && (
            <button
              onClick={handleSetDefault}
              disabled={settingDefault}
              title="Set as default"
              className="p-1.5 text-gray-500 hover:text-amber-400 disabled:opacity-50 transition-colors rounded-lg hover:bg-gray-800"
            >
              {settingDefault ? <Loader2 size={14} className="animate-spin" /> : <StarOff size={14} />}
            </button>
          )}
          <button
            onClick={handleValidate}
            disabled={validating}
            title="Validate key"
            className="p-1.5 text-gray-500 hover:text-blue-400 disabled:opacity-50 transition-colors rounded-lg hover:bg-gray-800"
          >
            {validating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Delete key"
            className="p-1.5 text-gray-500 hover:text-red-400 disabled:opacity-50 transition-colors rounded-lg hover:bg-gray-800"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
};

// â”€â”€ Provider Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ProviderCardProps {
  providerKey: string;
  config: ProviderConfig;
  keys: OrgApiKey[];
  onRefresh: () => void;
}

const ProviderCard: React.FC<ProviderCardProps> = ({ providerKey, config, keys, onRefresh }) => {
  const [expanded, setExpanded] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const activeKeys = keys.filter(k => k.status === 'ACTIVE');
  const hasDefault = keys.some(k => k.isDefault && k.status === 'ACTIVE');

  const handleAddSuccess = () => {
    setShowAddForm(false);
    onRefresh();
  };

  return (
    <div className={`border rounded-2xl overflow-hidden ${config.color} bg-gradient-to-br ${config.bg}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{config.logo}</span>
          <div>
            <h4 className="text-sm font-semibold text-white">{config.name}</h4>
            <p className="text-xs text-gray-500">
              {keys.length === 0
                ? 'No keys â€” using .env fallback'
                : `${keys.length} key${keys.length !== 1 ? 's' : ''} Â· ${activeKeys.length} active`
              }
              {!hasDefault && keys.length > 0 && ' Â· âš  No default set'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {keys.length === 0 && (
            <span className="text-xs text-gray-600 bg-gray-800/60 px-2 py-1 rounded-full border border-gray-700">
              .env fallback
            </span>
          )}
          {expanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-800/50">
          {keys.length > 0 && (
            <div className="divide-y divide-gray-800/40">
              {keys.map(k => (
                <KeyRow key={k.id} keyData={k} onRefresh={onRefresh} />
              ))}
            </div>
          )}

          {keys.length === 0 && !showAddForm && (
            <div className="px-5 py-5 text-center">
              <Key size={28} className="mx-auto text-gray-700 mb-2" />
              <p className="text-sm text-gray-500">No org key configured.</p>
              <p className="text-xs text-gray-600 mt-0.5">
                AI calls will use the <code className="text-gray-500">.env</code> key as fallback.
              </p>
            </div>
          )}

          {showAddForm ? (
            <div className="px-4 pb-4">
              <AddKeyForm
                provider={providerKey}
                config={config}
                onSuccess={handleAddSuccess}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          ) : (
            <div className="px-4 pb-4 pt-3 flex items-center justify-between">
              <a
                href={config.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1 transition-colors"
              >
                <Info size={12} /> Get {config.name} key
              </a>
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={13} /> Add Key
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function ApiKeyManager() {
  const [keys, setKeys] = useState<OrgApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/org-api-keys');
      if (res.data.success) setKeys(res.data.data);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Only OWNER and ADMIN roles can manage API keys.');
      } else {
        setError('Failed to load API keys.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const keysByProvider = (provider: string) => keys.filter(k => k.provider === provider);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Key size={18} className="text-blue-400" />
              AI Provider API Keys
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Store encrypted API keys per provider. Organization keys take priority over server .env keys.
              Keys are encrypted with AES-256-GCM and never exposed after saving.
            </p>
          </div>
          <button
            onClick={fetchKeys}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-white disabled:opacity-40 transition-colors rounded-lg hover:bg-gray-800"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Key resolution info */}
        <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl flex gap-2.5">
          <Zap size={14} className="text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400">
            <strong className="text-white">Key resolution order:</strong>{' '}
            Org default key â†’ Most recent org key â†’ Server .env key â†’ Error.
            Setting a key as &quot;default&quot; ensures it&apos;s always used first for that provider.
          </p>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !error && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-900 border border-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Provider cards */}
      {!loading && !error && (
        <div className="space-y-4">
          {Object.entries(PROVIDERS).map(([providerKey, config]) => (
            <ProviderCard
              key={providerKey}
              providerKey={providerKey}
              config={config}
              keys={keysByProvider(providerKey)}
              onRefresh={fetchKeys}
            />
          ))}
        </div>
      )}

      {/* Security notice */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex gap-3">
        <Info size={16} className="text-gray-500 shrink-0 mt-0.5" />
        <div className="text-xs text-gray-500 space-y-1">
          <p><strong className="text-gray-400">Security:</strong> Keys are encrypted with AES-256-GCM before storage. Plaintext keys are never logged or returned after creation.</p>
          <p><strong className="text-gray-400">Access:</strong> Only OWNER and ADMIN roles can view and manage API keys. MEMBER and MANAGER roles cannot access this panel.</p>
          <p><strong className="text-gray-400">Key hints:</strong> Only the last 4 characters of your key are stored for identification. Use labels to distinguish between keys.</p>
        </div>
      </div>
    </div>
  );
}

