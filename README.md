# Unsent Letters

A privacy-first AI-powered journaling app where you write letters to anyone (living or not) and receive thoughtful AI responses. All letters are stored **locally and encrypted** on your device. The server acts only as a stateless AI proxy and auth token issuer.

## Architecture

- **Mobile App** (Flutter): Local encrypted storage, Google/Apple Sign-In, SSE streaming
- **Server** (Node.js/TypeScript): Stateless AI proxy + JWT auth, no user data persistence
- **AI Providers**: OpenAI, Anthropic, Ollama, LM Studio, vLLM

## Features

### Privacy & Security
- ✅ Letters stored locally with AES-256 encryption
- ✅ Server never sees or stores letter content
- ✅ JWT-based stateless authentication
- ✅ Google Sign-In and Sign in with Apple
- ✅ No user profiling or data collection

### AI Integration
- ✅ Multiple AI providers (OpenAI, Anthropic, local models)
- ✅ Streaming responses via Server-Sent Events
- ✅ Configurable models and parameters
- ✅ Rate limiting and content size limits

### Developer Experience
- ✅ Docker Compose with Ollama, LM Studio, vLLM
- ✅ Comprehensive test coverage
- ✅ Admin status page for monitoring
- ✅ Hot reload in development

## Quick Start

### Prerequisites
- Flutter SDK (3.16+)
- Node.js (18+)
- Docker & Docker Compose (optional, for local AI)

### 1. Clone and Setup
```bash
git clone <repo>
cd unsent-letters
```

### 2. Server Setup
```bash
cd server
npm install
cp .env.example .env
# Edit .env with your API keys and JWT settings
npm run dev
```

### 3. Mobile Setup
```bash
cd mobile
flutter pub get
# iOS: Add GoogleService-Info.plist and configure Sign in with Apple
# Android: Add google-services.json and configure OAuth
flutter run
```

### 4. Docker Compose (Optional)
```bash
# For Ollama
docker-compose up ollama server

# For LM Studio
LOCAL_PROVIDER=lmstudio docker-compose up lmstudio server

# For vLLM
LOCAL_PROVIDER=vllm docker-compose up vllm server
```

## Configuration

### Server Environment Variables
```bash
# Core
PORT=8080
NODE_ENV=development
ALLOW_ORIGINS=http://localhost:5173,capacitor://localhost

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
ANTHROPIC_MODEL=claude-3-5-sonnet-20240620

# Local AI (choose one)
OLLAMA_BASE_URL=http://ollama:11434
LMSTUDIO_BASE_URL=http://lmstudio:1234
VLLM_BASE_URL=http://vllm:8000
LOCAL_PROVIDER=ollama|lmstudio|vllm|none

# Auth & Security
JWT_ISSUER=https://unsent-letters.example
JWT_AUDIENCE=unsent-letters-mobile
JWT_EXPIRES_IN=3600
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Google Sign-In
GOOGLE_CLIENT_ID_IOS=...
GOOGLE_CLIENT_ID_ANDROID=...

# Apple Sign-In
APPLE_AUDIENCE_BUNDLE_ID=com.example.unsentletters
APPLE_AUDIENCE_SERVICE_ID=...
APPLE_TEAM_ID=...
APPLE_KEY_ID=...

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
MAX_LETTER_CHARS=6000
```

### Mobile Configuration
The app automatically detects development/production environments and configures API endpoints accordingly.

## Authentication Flow

1. **Mobile App** uses native Google/Apple Sign-In to obtain ID tokens
2. **Token Exchange**: App calls `POST /v1/auth/exchange` with provider + ID token
3. **Server Verification**: Server verifies ID token against provider JWKS
4. **JWT Issuance**: Server returns short-lived JWT (1 hour) for AI API access
5. **API Calls**: Mobile includes JWT in Authorization header for AI endpoints

## API Endpoints

### Authentication
- `POST /v1/auth/exchange` - Exchange provider ID token for server JWT
- `GET /.well-known/jwks.json` - Server's public keys (optional)

### AI Proxy
- `POST /v1/ai/reply` - Get AI response (requires auth)
- `POST /v1/ai/reply/stream` - Get streaming AI response (requires auth)

### Status
- `GET /v1/health` - Health check
- `GET /v1/config/public` - Public configuration
- `GET /admin` - Admin status page (no auth required)

## Mobile App Structure

```
mobile/
├── lib/
│   ├── main.dart
│   ├── pages/
│   │   ├── login_page.dart
│   │   ├── home_page.dart
│   │   ├── write_letter_page.dart
│   │   ├── ai_reply_page.dart
│   │   └── settings_page.dart
│   ├── services/
│   │   ├── api_client.dart
│   │   ├── encryption_service.dart
│   │   ├── sse_client.dart
│   │   └── storage_service.dart
│   └── state/
│       ├── auth_notifier.dart
│       ├── letters_notifier.dart
│       └── providers.dart
├── ios/
│   └── Runner/
│       ├── GoogleService-Info.plist
│       └── Info.plist (with Sign in with Apple)
└── android/
    └── app/
        └── google-services.json
```

## Server Structure

```
server/
├── src/
│   ├── app.ts
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── ai.ts
│   │   └── admin.ts
│   ├── middleware/
│   │   ├── authRequired.ts
│   │   └── authOptional.ts
│   ├── lib/
│   │   ├── jwt.ts
│   │   ├── google.ts
│   │   ├── apple.ts
│   │   └── jwks.ts
│   └── providers/
│       ├── openai.ts
│       ├── anthropic.ts
│       └── local.ts
├── public/
│   └── admin.html
└── test/
    ├── auth.exchange.spec.ts
    └── ai.reply.auth.spec.ts
```

## Development

### Running Tests
```bash
# Server tests
cd server && npm test

# Mobile tests
cd mobile && flutter test
```

### Code Generation
```bash
# Generate JWT key pair
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

### iOS Setup
1. Enable Sign in with Apple in Xcode capabilities
2. Add GoogleService-Info.plist to ios/Runner/
3. Configure URL schemes for Google Sign-In

### Android Setup
1. Add google-services.json to android/app/
2. Configure SHA-1/SHA-256 fingerprints in Google Cloud Console
3. Add OAuth client for Android in Google Cloud Console

## Docker Services

### Ollama
```yaml
ollama:
  image: ollama/ollama:latest
  ports: ["11434:11434"]
  volumes: ["ollama_data:/root/.ollama"]
```

### LM Studio
```yaml
lmstudio:
  image: lmstudio/server:latest
  ports: ["1234:1234"]
  environment:
    - MODEL_PATH=/models/your-model.gguf
```

### vLLM
```yaml
vllm:
  image: vllm/vllm-openai:latest
  ports: ["8000:8000"]
  command: --model microsoft/DialoGPT-medium
```

## Privacy Guarantees

1. **No Letter Storage**: Server never receives or stores letter content
2. **Stateless Auth**: Server only validates tokens, no user sessions
3. **Local Encryption**: All letters encrypted with device-specific keys
4. **No Analytics**: No tracking, profiling, or behavioral analysis
5. **Minimal Logging**: Only errors and system health, no content

## Security Considerations

- JWT tokens expire after 1 hour
- Rate limiting prevents abuse
- CORS and security headers configured
- All external API calls proxied through server
- No sensitive data in logs or error messages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details