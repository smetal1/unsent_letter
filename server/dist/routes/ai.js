"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const authRequired_1 = require("../middleware/authRequired");
const openai_1 = require("../providers/openai");
const anthropic_1 = require("../providers/anthropic");
const local_1 = require("../providers/local");
const router = (0, express_1.Router)();
const messageSchema = zod_1.z.object({
    role: zod_1.z.enum(['system', 'user', 'assistant']),
    content: zod_1.z.string().min(1, 'Message content is required'),
});
const aiRequestSchema = zod_1.z.object({
    messages: zod_1.z.array(messageSchema).min(1, 'At least one message is required'),
    provider: zod_1.z.enum(['openai', 'anthropic', 'local']).optional(),
    stream: zod_1.z.boolean().optional().default(false),
});
const MAX_LETTER_CHARS = parseInt(process.env.MAX_LETTER_CHARS || '6000', 10);
function validateContentLength(messages) {
    const totalContent = messages
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .join('');
    if (totalContent.length > MAX_LETTER_CHARS) {
        throw new Error(`Letter content too long. Maximum ${MAX_LETTER_CHARS} characters allowed.`);
    }
}
function getAIProvider(providerName) {
    switch (providerName) {
        case 'openai':
            return openai_1.openaiProvider;
        case 'anthropic':
            return anthropic_1.anthropicProvider;
        case 'local':
            return local_1.localProvider;
        default:
            if (openai_1.openaiProvider.isConfigured())
                return openai_1.openaiProvider;
            if (anthropic_1.anthropicProvider.isConfigured())
                return anthropic_1.anthropicProvider;
            if (local_1.localProvider.isConfigured())
                return local_1.localProvider;
            throw new Error('No AI provider configured');
    }
}
function addSystemPrompt(messages) {
    const hasSystemMessage = messages.some(m => m.role === 'system');
    if (!hasSystemMessage) {
        const systemPrompt = `You are a compassionate AI assistant helping someone process their thoughts and emotions through letter writing. The user has written a letter to someone (living or not), and you should respond thoughtfully and empathetically as if you're that person or entity they're writing to.

Guidelines:
- Be warm, understanding, and supportive
- Acknowledge their feelings and experiences
- Offer gentle insights or perspectives when appropriate
- Keep responses conversational and heartfelt
- If writing as someone who has passed away, be comforting and wise
- If writing as a living person, be authentic to how they might respond
- Keep responses to a reasonable length (1-3 paragraphs typically)

Remember: This is a safe space for emotional expression and healing.`;
        return [{ role: 'system', content: systemPrompt }, ...messages];
    }
    return messages;
}
router.post('/reply', authRequired_1.authRequired, async (req, res) => {
    const authenticatedReq = req;
    try {
        const { messages, provider: requestedProvider } = aiRequestSchema.parse(req.body);
        validateContentLength(messages);
        const messagesWithSystem = addSystemPrompt(messages);
        const provider = getAIProvider(requestedProvider);
        const response = await provider.getResponse(messagesWithSystem);
        console.info('AI reply generated:', {
            userId: authenticatedReq.user.userId.substring(0, 8) + '...',
            provider: requestedProvider || 'auto',
            messageCount: messages.length,
            timestamp: new Date().toISOString(),
        });
        res.json({
            reply: response,
            provider: requestedProvider || 'auto',
        });
    }
    catch (error) {
        console.error('AI reply failed:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: authenticatedReq?.user?.userId?.substring(0, 8) + '...' || 'unknown',
            provider: req.body?.provider,
            timestamp: new Date().toISOString(),
        });
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                error: 'Invalid request body',
                code: 'VALIDATION_ERROR',
                details: error.errors,
            });
            return;
        }
        if (error instanceof Error) {
            if (error.message.includes('content too long')) {
                res.status(400).json({
                    error: error.message,
                    code: 'CONTENT_TOO_LONG',
                });
                return;
            }
            if (error.message.includes('not configured')) {
                res.status(503).json({
                    error: 'AI service temporarily unavailable',
                    code: 'SERVICE_UNAVAILABLE',
                });
                return;
            }
        }
        res.status(500).json({
            error: 'Failed to generate AI response',
            code: 'AI_ERROR',
        });
    }
});
router.post('/reply/stream', authRequired_1.authRequired, async (req, res) => {
    const authenticatedReq = req;
    try {
        const { messages, provider: requestedProvider } = aiRequestSchema.parse(req.body);
        validateContentLength(messages);
        const messagesWithSystem = addSystemPrompt(messages);
        const provider = getAIProvider(requestedProvider);
        console.info('AI stream started:', {
            userId: authenticatedReq.user.userId.substring(0, 8) + '...',
            provider: requestedProvider || 'auto',
            messageCount: messages.length,
            timestamp: new Date().toISOString(),
        });
        await provider.streamResponse(messagesWithSystem, res);
    }
    catch (error) {
        console.error('AI streaming failed:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: authenticatedReq?.user?.userId?.substring(0, 8) + '...' || 'unknown',
            provider: req.body?.provider,
            timestamp: new Date().toISOString(),
        });
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                error: 'Invalid request body',
                code: 'VALIDATION_ERROR',
                details: error.errors,
            });
            return;
        }
        if (error instanceof Error) {
            if (error.message.includes('content too long')) {
                res.status(400).json({
                    error: error.message,
                    code: 'CONTENT_TOO_LONG',
                });
                return;
            }
            if (error.message.includes('not configured')) {
                res.status(503).json({
                    error: 'AI service temporarily unavailable',
                    code: 'SERVICE_UNAVAILABLE',
                });
                return;
            }
        }
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to start AI streaming',
                code: 'STREAM_ERROR',
            });
        }
        else {
            res.write('event: error\n');
            res.write(`data: ${JSON.stringify({ error: 'Streaming failed' })}\n\n`);
            res.end();
        }
    }
});
router.get('/providers', authRequired_1.authRequired, (req, res) => {
    res.json({
        openai: openai_1.openaiProvider.getConfig(),
        anthropic: anthropic_1.anthropicProvider.getConfig(),
        local: local_1.localProvider.getConfig(),
        limits: {
            maxLetterChars: MAX_LETTER_CHARS,
        },
    });
});
exports.default = router;
