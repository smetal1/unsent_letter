"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.localProvider = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
class LocalAIProvider {
    provider;
    baseUrl;
    model;
    constructor() {
        this.provider = process.env.LOCAL_PROVIDER || 'ollama';
        switch (this.provider) {
            case 'ollama':
                this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
                this.model = 'llama2';
                break;
            case 'lmstudio':
                this.baseUrl = process.env.LMSTUDIO_BASE_URL || 'http://lmstudio:1234';
                this.model = 'local-model';
                break;
            case 'vllm':
                this.baseUrl = process.env.VLLM_BASE_URL || 'http://vllm:8000';
                this.model = 'microsoft/DialoGPT-medium';
                break;
            default:
                this.baseUrl = '';
                this.model = '';
        }
        if (this.provider === 'none') {
            console.warn('Local AI provider disabled (LOCAL_PROVIDER=none)');
        }
        else if (!this.baseUrl) {
            console.warn(`Local AI provider ${this.provider} not configured properly`);
        }
    }
    isConfigured() {
        return this.provider !== 'none' && !!this.baseUrl;
    }
    async getResponse(messages) {
        if (!this.isConfigured()) {
            throw new Error('Local AI provider not configured');
        }
        try {
            if (this.provider === 'ollama') {
                return await this.getOllamaResponse(messages);
            }
            else {
                return await this.getOpenAICompatibleResponse(messages);
            }
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Local AI request failed: ${error.message}`);
            }
            throw new Error('Local AI request failed: Unknown error');
        }
    }
    async streamResponse(messages, res) {
        if (!this.isConfigured()) {
            throw new Error('Local AI provider not configured');
        }
        try {
            if (this.provider === 'ollama') {
                await this.streamOllamaResponse(messages, res);
            }
            else {
                await this.streamOpenAICompatibleResponse(messages, res);
            }
        }
        catch (error) {
            console.error('Local AI streaming error:', error);
            res.write('event: error\n');
            res.write(`data: ${JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error'
            })}\n\n`);
            res.end();
        }
    }
    async getOllamaResponse(messages) {
        const response = await (0, node_fetch_1.default)(`${this.baseUrl}/api/chat`, {
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
        const data = await response.json();
        return data.message?.content || '';
    }
    async getOpenAICompatibleResponse(messages) {
        const response = await (0, node_fetch_1.default)(`${this.baseUrl}/v1/chat/completions`, {
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
        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }
    async streamOllamaResponse(messages, res) {
        const response = await (0, node_fetch_1.default)(`${this.baseUrl}/api/chat`, {
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
                if (line.trim()) {
                    try {
                        const parsed = JSON.parse(line);
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
                    }
                    catch (parseError) {
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
    async streamOpenAICompatibleResponse(messages, res) {
        const response = await (0, node_fetch_1.default)(`${this.baseUrl}/v1/chat/completions`, {
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
                    }
                    catch (parseError) {
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
    getConfig() {
        return {
            enabled: this.isConfigured(),
            provider: this.provider,
            model: this.model,
            baseUrl: this.baseUrl,
        };
    }
}
exports.localProvider = new LocalAIProvider();
