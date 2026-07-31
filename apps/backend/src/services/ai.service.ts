import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AICompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  /** Optional org-level key override. If set, takes precedence over process.env key. */
  apiKey?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export abstract class AIProvider {
  abstract generateText(prompt: string, options?: AICompletionOptions): Promise<string>;
  abstract generateChatResponse(messages: ChatMessage[], options?: AICompletionOptions): Promise<string>;
  abstract streamChatResponse(messages: ChatMessage[], onToken: (token: string) => void, options?: AICompletionOptions): Promise<void>;
}

// ─── Ollama Provider ─────────────────────────────────────────────────────────
export class OllamaProvider extends AIProvider {
  private baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

  async generateText(prompt: string, options?: AICompletionOptions): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: options?.model || 'llama3', prompt, stream: false })
    });
    if (!res.ok) throw new Error(`Ollama error: ${res.statusText}`);
    const data = await res.json() as { response: string };
    return data.response;
  }

  async generateChatResponse(messages: ChatMessage[], options?: AICompletionOptions): Promise<string> {
    const formatted = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    return this.generateText(formatted, options);
  }

  async streamChatResponse(messages: ChatMessage[], onToken: (token: string) => void, options?: AICompletionOptions): Promise<void> {
    const formatted = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: options?.model || 'llama3', prompt: formatted, stream: true })
    });
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try { const parsed = JSON.parse(line); if (parsed.response) onToken(parsed.response); } catch {}
      }
    }
  }
}

// ─── OpenAI Provider ─────────────────────────────────────────────────────────
export class OpenAIProvider extends AIProvider {
  private openai: OpenAI;

  /** @param apiKeyOverride - If provided, used instead of process.env.OPENAI_API_KEY */
  constructor(apiKeyOverride?: string) {
    super();
    const key = apiKeyOverride || process.env.OPENAI_API_KEY;
    if (!key || !key.startsWith('sk-')) {
      throw new Error('Invalid or missing OPENAI_API_KEY. Please set a valid OpenAI API key (starts with sk-) in your .env file or add an org-level key in Settings.');
    }
    this.openai = new OpenAI({ apiKey: key });
  }

  async generateText(prompt: string, options?: AICompletionOptions): Promise<string> {
    return this.generateChatResponse([{ role: 'user', content: prompt }], options);
  }

  async generateChatResponse(messages: ChatMessage[], options?: AICompletionOptions): Promise<string> {
    const systemMsg: OpenAI.Chat.ChatCompletionMessageParam = {
      role: 'system',
      content: options?.systemPrompt || 'You are a helpful enterprise AI assistant. Be concise, professional, and informative.'
    };
    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map(m => ({ role: m.role, content: m.content }));
    const response = await this.openai.chat.completions.create({
      model: options?.model || 'gpt-4o',
      messages: [systemMsg, ...chatMessages],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
    });
    return response.choices[0].message?.content || '';
  }

  async streamChatResponse(messages: ChatMessage[], onToken: (token: string) => void, options?: AICompletionOptions): Promise<void> {
    const systemMsg: OpenAI.Chat.ChatCompletionMessageParam = {
      role: 'system',
      content: options?.systemPrompt || 'You are a helpful enterprise AI assistant.'
    };
    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map(m => ({ role: m.role, content: m.content }));
    const stream = await this.openai.chat.completions.create({
      model: options?.model || 'gpt-4o',
      messages: [systemMsg, ...chatMessages],
      temperature: options?.temperature ?? 0.7,
      stream: true,
    });
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) onToken(content);
    }
  }
}

// ─── Google Gemini Provider ───────────────────────────────────────────────────
export class GeminiProvider extends AIProvider {
  private genAI: GoogleGenerativeAI;

  /** @param apiKeyOverride - If provided, used instead of process.env.GEMINI_API_KEY */
  constructor(apiKeyOverride?: string) {
    super();
    const key = apiKeyOverride || process.env.GEMINI_API_KEY;
    if (!key || key.startsWith('REPLACE_') || key.length < 10) {
      throw new Error(
        'Missing or invalid GEMINI_API_KEY. ' +
        'Please get your key from https://aistudio.google.com/app/apikey and set it in your .env file or add an org-level key in Settings.'
      );
    }
    this.genAI = new GoogleGenerativeAI(key);
  }

  async generateText(prompt: string, options?: AICompletionOptions): Promise<string> {
    return this.generateChatResponse([{ role: 'user', content: prompt }], options);
  }

  async generateChatResponse(messages: ChatMessage[], options?: AICompletionOptions): Promise<string> {
    const modelName = options?.model || 'gemini-2.0-flash';
    const model = this.genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: options?.systemPrompt || 'You are an expert enterprise AI assistant. Help users manage workflows, automations, and business processes. Be professional, concise, and helpful. Format code in markdown code blocks.'
    });

    // Build history (all except last user message)
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const lastMessage = messages[messages.length - 1];
    const chat = model.startChat({
      history,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 2048,
      }
    });

    const result = await chat.sendMessage(lastMessage.content);
    return result.response.text();
  }

  async streamChatResponse(messages: ChatMessage[], onToken: (token: string) => void, options?: AICompletionOptions): Promise<void> {
    const modelName = options?.model || 'gemini-2.0-flash';
    const model = this.genAI.getGenerativeModel({ model: modelName });
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    const lastMessage = messages[messages.length - 1];
    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(lastMessage.content);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) onToken(text);
    }
  }
}

// ─── AI Service (Factory) ─────────────────────────────────────────────────────
export class AIService {
  public getProvider(providerName: string, apiKeyOverride?: string): AIProvider {
    switch (providerName) {
      case 'openai': return new OpenAIProvider(apiKeyOverride);
      case 'gemini': return new GeminiProvider(apiKeyOverride);
      case 'ollama': return new OllamaProvider();
      default: throw new Error(`Unsupported AI provider: "${providerName}". Valid options: openai, gemini, ollama`);
    }
  }

  async generate(providerName: string, prompt: string, options?: AICompletionOptions): Promise<string> {
    return this.getProvider(providerName, options?.apiKey).generateText(prompt, options);
  }

  async chat(providerName: string, messages: ChatMessage[], options?: AICompletionOptions): Promise<string> {
    return this.getProvider(providerName, options?.apiKey).generateChatResponse(messages, options);
  }
}

export const aiService = new AIService();
