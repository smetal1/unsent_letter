import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authRequired, AuthenticatedRequest } from '../middleware/authRequired';
import { openaiProvider } from '../providers/openai';
import { anthropicProvider } from '../providers/anthropic';
import { localProvider } from '../providers/local';

const router = Router();

// Validation schemas
const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1, 'Message content is required'),
});

const aiRequestSchema = z.object({
  messages: z.array(messageSchema).min(1, 'At least one message is required'),
  provider: z.enum(['openai', 'anthropic', 'local']).optional(),
  stream: z.boolean().optional().default(false),
});

// Content length validation
const MAX_LETTER_CHARS = parseInt(process.env.MAX_LETTER_CHARS || '6000', 10);

/**
 * Validate letter content length
 */
function validateContentLength(messages: { role: string; content: string }[]): void {
  const totalContent = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('');

  if (totalContent.length > MAX_LETTER_CHARS) {
    throw new Error(`Letter content too long. Maximum ${MAX_LETTER_CHARS} characters allowed.`);
  }
}

/**
 * Get the appropriate AI provider
 */
function getAIProvider(providerName?: string) {
  switch (providerName) {
    case 'openai':
      return openaiProvider;
    case 'anthropic':
      return anthropicProvider;
    case 'local':
      return localProvider;
    default:
      // Default priority: OpenAI > Anthropic > Local
      if (openaiProvider.isConfigured()) return openaiProvider;
      if (anthropicProvider.isConfigured()) return anthropicProvider;
      if (localProvider.isConfigured()) return localProvider;
      throw new Error('No AI provider configured');
  }
}

/**
 * Add system prompt for letter responses
 */
function addSystemPrompt(messages: { role: string; content: string }[]): { role: string; content: string }[] {
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

/**
 * POST /v1/ai/reply
 * Get AI response to a letter (non-streaming)
 */
router.post('/reply', authRequired, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Validate request body
    const { messages, provider: requestedProvider } = aiRequestSchema.parse(req.body);

    // Validate content length
    validateContentLength(messages);

    // Add system prompt if needed
    const messagesWithSystem = addSystemPrompt(messages);

    // Get AI provider
    const provider = getAIProvider(requestedProvider);

    // Get response
    const response = await provider.getResponse(messagesWithSystem as any);

    // Log successful request (no content)
    console.info('AI reply generated:', {
      userId: req.user.userId.substring(0, 8) + '...',
      provider: requestedProvider || 'auto',
      messageCount: messages.length,
      timestamp: new Date().toISOString(),
    });

    res.json({
      reply: response,
      provider: requestedProvider || 'auto',
    });

  } catch (error) {
    // Log error (no sensitive content)
    console.error('AI reply failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.userId?.substring(0, 8) + '...' || 'unknown',
      provider: req.body?.provider,
      timestamp: new Date().toISOString(),
    });

    if (error instanceof z.ZodError) {
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

/**
 * POST /v1/ai/reply/stream
 * Get streaming AI response to a letter
 */
router.post('/reply/stream', authRequired, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Validate request body
    const { messages, provider: requestedProvider } = aiRequestSchema.parse(req.body);

    // Validate content length
    validateContentLength(messages);

    // Add system prompt if needed
    const messagesWithSystem = addSystemPrompt(messages);

    // Get AI provider
    const provider = getAIProvider(requestedProvider);

    // Log stream start (no content)
    console.info('AI stream started:', {
      userId: req.user.userId.substring(0, 8) + '...',
      provider: requestedProvider || 'auto',
      messageCount: messages.length,
      timestamp: new Date().toISOString(),
    });

    // Start streaming response
    await provider.streamResponse(messagesWithSystem as any, res);

  } catch (error) {
    // Log error (no sensitive content)
    console.error('AI streaming failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.userId?.substring(0, 8) + '...' || 'unknown',
      provider: req.body?.provider,
      timestamp: new Date().toISOString(),
    });

    if (error instanceof z.ZodError) {
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

    // If headers haven't been sent yet, send error as JSON
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to start AI streaming',
        code: 'STREAM_ERROR',
      });
    } else {
      // If streaming has started, send error as SSE
      res.write('event: error\n');
      res.write(`data: ${JSON.stringify({ error: 'Streaming failed' })}\n\n`);
      res.end();
    }
  }
});

/**
 * GET /v1/ai/providers
 * Get available AI providers and their status
 */
router.get('/providers', authRequired, (req: AuthenticatedRequest, res: Response): void => {
  res.json({
    openai: openaiProvider.getConfig(),
    anthropic: anthropicProvider.getConfig(),
    local: localProvider.getConfig(),
    limits: {
      maxLetterChars: MAX_LETTER_CHARS,
    },
  });
});

export default router;