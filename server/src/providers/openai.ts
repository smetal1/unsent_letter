import fetch from 'node-fetch';
import { Response } from 'express';

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIStreamChunk {
  choices: Array<{
    delta: {
      content?: string;
    };
    finish_reason?: string;
  }>;
}

export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class OpenAIProvider {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    if (!this.apiKey) {
      console.warn('OPENAI_API_KEY not configured. OpenAI provider will not work.');
    }
  }

  /**
   * Check if provider is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get non-streaming AI response
   */
  async getResponse(messages: OpenAIMessage[]): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
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
        throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json() as OpenAIResponse;
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from OpenAI');
      }

      return data.choices[0]?.message?.content || '';
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI request failed: ${error.message}`);
      }
      throw new Error('OpenAI request failed: Unknown error');
    }
  }

  /**
   * Stream AI response using Server-Sent Events
   */
  async streamResponse(messages: OpenAIMessage[], res: Response): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
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
        throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
      }

      if (!response.body) {
        throw new Error('No response body from OpenAI');
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
      
      // Process the stream
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
              const parsed = JSON.parse(data) as OpenAIStreamChunk;
              const content = parsed.choices[0]?.delta?.content;
              
              if (content) {
                res.write('event: chunk\n');
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }

              if (parsed.choices[0]?.finish_reason) {
                res.write('event: done\n');
                res.write('data: {"finished": true}\n\n');
                res.end();
                return;
              }
            } catch (parseError) {
              console.warn('Failed to parse OpenAI stream chunk:', parseError);
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
        console.error('OpenAI stream error:', error);
        res.write('event: error\n');
        res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
        res.end();
      });

      // Handle client disconnect
      res.on('close', () => {
        console.log('Client disconnected from OpenAI stream');
      });

    } catch (error) {
      console.error('OpenAI streaming error:', error);
      res.write('event: error\n');
      res.write(`data: ${JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })}\n\n`);
      res.end();
    }
  }

  /**
   * Get provider configuration
   */
  getConfig(): { enabled: boolean; model: string; baseUrl: string } {
    return {
      enabled: this.isConfigured(),
      model: this.model,
      baseUrl: this.baseUrl,
    };
  }
}

export const openaiProvider = new OpenAIProvider();