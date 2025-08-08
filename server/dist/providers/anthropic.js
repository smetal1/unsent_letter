"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.anthropicProvider = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
class AnthropicProvider {
    apiKey;
    model;
    constructor() {
        this.apiKey = process.env.ANTHROPIC_API_KEY || '';
        this.model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20240620';
        if (!this.apiKey) {
            console.warn('ANTHROPIC_API_KEY not configured. Anthropic provider will not work.');
        }
    }
    isConfigured() {
        return !!this.apiKey;
    }
    convertMessages(messages) {
        const systemMessage = messages.find(m => m.role === 'system');
        const conversationMessages = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
            role: m.role,
            content: m.content,
        }));
        const payload = {
            messages: conversationMessages,
        };
        if (systemMessage?.content) {
            payload.system = systemMessage.content;
        }
        return payload;
    }
    async getResponse(messages) {
        if (!this.isConfigured()) {
            throw new Error('Anthropic not configured');
        }
        try {
            const { system, messages: anthropicMessages } = this.convertMessages(messages);
            const requestBody = {
                model: this.model,
                max_tokens: 2000,
                temperature: 0.7,
                messages: anthropicMessages,
            };
            if (system) {
                requestBody.system = system;
            }
            const response = await (0, node_fetch_1.default)('https://api.anthropic.com/v1/messages', {
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
            const data = await response.json();
            if (!data.content || data.content.length === 0) {
                throw new Error('No response from Anthropic');
            }
            return data.content[0]?.text || '';
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Anthropic request failed: ${error.message}`);
            }
            throw new Error('Anthropic request failed: Unknown error');
        }
    }
    async streamResponse(messages, res) {
        if (!this.isConfigured()) {
            throw new Error('Anthropic not configured');
        }
        try {
            const { system, messages: anthropicMessages } = this.convertMessages(messages);
            const requestBody = {
                model: this.model,
                max_tokens: 2000,
                temperature: 0.7,
                messages: anthropicMessages,
                stream: true,
            };
            if (system) {
                requestBody.system = system;
            }
            const response = await (0, node_fetch_1.default)('https://api.anthropic.com/v1/messages', {
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
                            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                                res.write('event: chunk\n');
                                res.write(`data: ${JSON.stringify({ content: parsed.delta.text })}\n\n`);
                            }
                            if (parsed.type === 'message_stop') {
                                res.write('event: done\n');
                                res.write('data: {"finished": true}\n\n');
                                res.end();
                                return;
                            }
                        }
                        catch (parseError) {
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
            res.on('close', () => {
                console.log('Client disconnected from Anthropic stream');
            });
        }
        catch (error) {
            console.error('Anthropic streaming error:', error);
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
        };
    }
}
exports.anthropicProvider = new AnthropicProvider();
