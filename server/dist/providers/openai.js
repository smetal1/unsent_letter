"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openaiProvider = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
class OpenAIProvider {
    apiKey;
    baseUrl;
    model;
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY || '';
        this.baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
        this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        if (!this.apiKey) {
            console.warn('OPENAI_API_KEY not configured. OpenAI provider will not work.');
        }
    }
    isConfigured() {
        return !!this.apiKey;
    }
    async getResponse(messages) {
        if (!this.isConfigured()) {
            throw new Error('OpenAI not configured');
        }
        try {
            const response = await (0, node_fetch_1.default)(`${this.baseUrl}/chat/completions`, {
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
            const data = await response.json();
            if (!data.choices || data.choices.length === 0) {
                throw new Error('No response from OpenAI');
            }
            return data.choices[0]?.message?.content || '';
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`OpenAI request failed: ${error.message}`);
            }
            throw new Error('OpenAI request failed: Unknown error');
        }
    }
    async streamResponse(messages, res) {
        if (!this.isConfigured()) {
            throw new Error('OpenAI not configured');
        }
        try {
            const response = await (0, node_fetch_1.default)(`${this.baseUrl}/chat/completions`, {
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
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control',
            });
            res.write('event: connected\n');
            res.write('data: {"status": "connected"}\n\n');
            let buffer = '';
            response.body.on('data', (chunk) => {
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
                            const parsed = JSON.parse(data);
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
                        }
                        catch (parseError) {
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
            res.on('close', () => {
                console.log('Client disconnected from OpenAI stream');
            });
        }
        catch (error) {
            console.error('OpenAI streaming error:', error);
            res.write('event: error\n');
            res.write(`data: ${JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error'
            })}\n\n`);
            res.end();
        }
    }
    getConfig() {
        return {
            enabled: this.isConfigured(),
            model: this.model,
            baseUrl: this.baseUrl,
        };
    }
}
exports.openaiProvider = new OpenAIProvider();
