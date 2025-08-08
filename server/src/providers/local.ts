import fetch from 'node-fetch';
import { Response } from 'express';

export interface LocalMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LocalStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string;
    };
    finish_reason?: string;
  }>;
  // Ollama format
  message?: {
    content?: string;
  };
  done?: boolean;
}

export interface LocalResponse {
  choices?: Array<{
    message: {
      content: string;
    };
    finish_reason?: string;
  }>;
  // Ollama format
  message?: {
    content: string;
  };
}

type LocalProvider = 'ollama' | 'lmstudio' | 'vllm' | 'none';

class LocalAIProvider {
  private provider: LocalProvider;
  private baseUrl: string;
  private model: string;

  constructor() {
    this.provider = (process.env.LOCAL_PROVIDER as LocalProvider) || 'ollama';
    
    switch (this.provider) {
      case 'ollama':
        this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
        this.model = 'llama2'; // Default Ollama model
        break;
      case 'lmstudio':
        this.baseUrl = process.env.LMSTUDIO_BASE_URL || 'http://lmstudio:1234';
        this.model = 'local-model'; // LM Studio uses local model
        break;
      case 'vllm':
        this.baseUrl = process.env.VLLM_BASE_URL || 'http://vllm:8000';
        this.model = 'microsoft/DialoGPT-medium'; // Default vLLM model
        break;
      default:
        this.baseUrl = '';
        this.model = '';
    }

    if (this.provider === 'none') {
      console.warn('Local AI provider disabled (LOCAL_PROVIDER=none)');
    } else if (!this.baseUrl) {
      console.warn(`Local AI provider ${this.provider} not configured properly`);
    }
  }

  /**
   * Check if provider is configured
   */
  isConfigured(): boolean {
    return this.provider !== 'none' && !!this.baseUrl;
  }

  /**
   * Get non-streaming AI response
   */
  async getResponse(messages: LocalMessage[]): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Local AI provider not configured');
    }

    try {
      if (this.provider === 'ollama') {
        return await this.getOllamaResponse(messages);
      } else {
        // LM Studio and vLLM use OpenAI-compatible API
        return await this.getOpenAICompatibleResponse(messages);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Local AI request failed: ${error.message}`);
      }
      throw new Error('Local AI request failed: Unknown error');
    }
  }

  /**
   * Stream AI response using Server-Sent Events
   */
  async streamResponse(messages: LocalMessage[], res: Response): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Local AI provider not configured');
    }

    try {
      if (this.provider === 'ollama') {
        await this.streamOllamaResponse(messages, res);
      } else {
        // LM Studio and vLLM use OpenAI-compatible streaming
        await this.streamOpenAICompatibleResponse(messages, res);
      }
    } catch (error) {
      console.error('Local AI streaming error:', error);
      res.write('event: error\n');
      res.write(`data: ${JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })}\n\n`);
      res.end();
    }
  }

  /**
   * Get response from Ollama
   */
  private async getOllamaResponse(messages: LocalMessage[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json() as LocalResponse;
    return data.message?.content || '';
  }

  /**
   * Get response from OpenAI-compatible providers (LM Studio, vLLM)
   */
  private async getOpenAICompatibleResponse(messages: LocalMessage[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`${this.provider} API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json() as LocalResponse;
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * Stream response from Ollama
   */
  private async streamOllamaResponse(messages: LocalMessage[], res: Response): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${errorData}`);
    }

    if (!response.body) {
      throw new Error('No response body from Ollama');
    }

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Send initial connected event
    res.write('event: connected\n');
    res.write('data: {"status": "connected"}\n\n');

    let buffer = '';
    
    response.body.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line) as LocalStreamChunk;
            
            if (parsed.message?.content) {
              res.write('event: chunk\n');
              res.write(`data: ${JSON.stringify({ content: parsed.message.content })}\n\n`);
            }

            if (parsed.done) {
              res.write('event: done\n');
              res.write('data: {"finished": true}\n\n');
              res.end();
              return;
            }
          } catch (parseError) {
            console.warn('Failed to parse Ollama stream chunk:', parseError);
          }
        }
      }
    });

    response.body.on('end', () => {
      res.write('event: done\n');
      res.write('data: {"finished": true}\n\n');
      res.end();
    });

    response.body.on('error', (error) => {
      console.error('Ollama stream error:', error);
      res.write('event: error\n');
      res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
      res.end();
    });

    res.on('close', () => {
      console.log('Client disconnected from Ollama stream');
    });
  }

  /**
   * Stream response from OpenAI-compatible providers
   */
  private async streamOpenAICompatibleResponse(messages: LocalMessage[], res: Response): Promise<void> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`${this.provider} API error: ${response.status} - ${errorData}`);
    }

    if (!response.body) {
      throw new Error(`No response body from ${this.provider}`);
    }

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Send initial connected event
    res.write('event: connected\n');
    res.write('data: {"status": "connected"}\n\n');

    let buffer = '';
    
    response.body.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            res.write('event: done\n');
            res.write('data: {"finished": true}\n\n');
            res.end();
            return;
          }

          try {
            const parsed = JSON.parse(data) as LocalStreamChunk;
            const content = parsed.choices?.[0]?.delta?.content;
            
            if (content) {
              res.write('event: chunk\n');
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }

            if (parsed.choices?.[0]?.finish_reason) {
              res.write('event: done\n');
              res.write('data: {"finished": true}\n\n');
              res.end();
              return;
            }
          } catch (parseError) {
            console.warn(`Failed to parse ${this.provider} stream chunk:`, parseError);
          }
        }
      }
    });

    response.body.on('end', () => {
      res.write('event: done\n');
      res.write('data: {"finished": true}\n\n');
      res.end();
    });

    response.body.on('error', (error) => {
      console.error(`${this.provider} stream error:`, error);
      res.write('event: error\n');
      res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
      res.end();
    });

    res.on('close', () => {
      console.log(`Client disconnected from ${this.provider} stream`);
    });
  }

  /**
   * Get provider configuration
   */
  getConfig(): { enabled: boolean; provider: string; model: string; baseUrl: string } {
    return {
      enabled: this.isConfigured(),
      provider: this.provider,
      model: this.model,
      baseUrl: this.baseUrl,
    };
  }
}

export const localProvider = new LocalAIProvider();