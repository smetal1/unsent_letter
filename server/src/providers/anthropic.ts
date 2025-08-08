import fetch from 'node-fetch';
import { Response } from 'express';

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicStreamChunk {
  type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop';
  delta?: {
    text?: string;
  };
  content_block?: {
    text?: string;
  };
}

export interface AnthropicResponse {
  content: Array<{
    text: string;
    type: 'text';
  }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

class AnthropicProvider {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    this.model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20240620';

    if (!this.apiKey) {
      console.warn('ANTHROPIC_API_KEY not configured. Anthropic provider will not work.');
    }
  }

  /**
   * Check if provider is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Convert OpenAI-style messages to Anthropic format
   */
  private convertMessages(messages: { role: string; content: string }[]): {
    system?: string;
    messages: AnthropicMessage[];
  } {
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    return {
      system: systemMessage?.content,
      messages: conversationMessages,
    };
  }

  /**
   * Get non-streaming AI response
   */
  async getResponse(messages: { role: string; content: string }[]): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Anthropic not configured');
    }

    try {
      const { system, messages: anthropicMessages } = this.convertMessages(messages);

      const requestBody: any = {
        model: this.model,
        max_tokens: 2000,
        temperature: 0.7,
        messages: anthropicMessages,
      };

      if (system) {
        requestBody.system = system;
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json() as AnthropicResponse;
      
      if (!data.content || data.content.length === 0) {
        throw new Error('No response from Anthropic');
      }

      return data.content[0]?.text || '';
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Anthropic request failed: ${error.message}`);
      }
      throw new Error('Anthropic request failed: Unknown error');
    }
  }

  /**
   * Stream AI response using Server-Sent Events
   */
  async streamResponse(messages: { role: string; content: string }[], res: Response): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Anthropic not configured');
    }

    try {
      const { system, messages: anthropicMessages } = this.convertMessages(messages);

      const requestBody: any = {
        model: this.model,
        max_tokens: 2000,
        temperature: 0.7,
        messages: anthropicMessages,
        stream: true,
      };

      if (system) {
        requestBody.system = system;
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${errorData}`);
      }

      if (!response.body) {
        throw new Error('No response body from Anthropic');
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
              const parsed = JSON.parse(data) as AnthropicStreamChunk;
              
              // Handle content delta chunks
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                res.write('event: chunk\n');
                res.write(`data: ${JSON.stringify({ content: parsed.delta.text })}\n\n`);
              }

              // Handle message stop (end of stream)
              if (parsed.type === 'message_stop') {
                res.write('event: done\n');
                res.write('data: {"finished": true}\n\n');
                res.end();
                return;
              }
            } catch (parseError) {
              console.warn('Failed to parse Anthropic stream chunk:', parseError);
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
        console.error('Anthropic stream error:', error);
        res.write('event: error\n');
        res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
        res.end();
      });

      // Handle client disconnect
      res.on('close', () => {
        console.log('Client disconnected from Anthropic stream');
      });

    } catch (error) {
      console.error('Anthropic streaming error:', error);
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
  getConfig(): { enabled: boolean; model: string } {
    return {
      enabled: this.isConfigured(),
      model: this.model,
    };
  }
}

export const anthropicProvider = new AnthropicProvider();