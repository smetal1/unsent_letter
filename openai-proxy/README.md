# OpenAI Proxy Service

This directory contains the configuration for the OpenAI API proxy service.

## Purpose

The OpenAI proxy service provides:
- **Caching**: Reduces API calls by caching responses for 5 minutes
- **Rate Limiting**: Prevents excessive API usage (10 requests per minute per IP)
- **Monitoring**: Basic metrics endpoint at `/metrics`
- **Health Checks**: Health endpoint at `/health`

## Usage

The proxy is available on port 8081 when running with the `openai` profile:

```bash
# Start with OpenAI proxy
docker-compose --profile openai up

# Or start specific services
docker-compose up server openai-proxy
```

## Endpoints

- `http://localhost:8081/v1/` - Proxied OpenAI API endpoints
- `http://localhost:8081/health` - Health check
- `http://localhost:8081/metrics` - Basic metrics

## Configuration

The proxy forwards requests to the OpenAI API while adding:
- Request caching for GET requests
- Rate limiting (10 req/min per IP, burst of 5)
- SSL termination
- Request/response buffering

## Environment Variables

- `OPENAI_API_KEY` - Your OpenAI API key
- `OPENAI_BASE_URL` - OpenAI API base URL (default: https://api.openai.com)