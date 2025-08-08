#!/bin/bash

# Unsent Letters Setup Script
# This script sets up the development environment for the Unsent Letters app

set -e

echo "🚀 Setting up Unsent Letters development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check prerequisites
echo -e "\n${BLUE}🔍 Checking prerequisites...${NC}"

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    print_status "Node.js found: $NODE_VERSION"
else
    print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Check Flutter
if command_exists flutter; then
    FLUTTER_VERSION=$(flutter --version | head -n 1)
    print_status "Flutter found: $FLUTTER_VERSION"
else
    print_error "Flutter is not installed. Please install Flutter from https://flutter.dev/docs/get-started/install"
    exit 1
fi

# Check Docker (optional)
if command_exists docker; then
    print_status "Docker found"
    DOCKER_AVAILABLE=true
else
    print_warning "Docker not found. Local AI providers (Ollama, LM Studio, vLLM) will not be available."
    DOCKER_AVAILABLE=false
fi

# Setup server
echo -e "\n${BLUE}📦 Setting up server...${NC}"
cd server

if [ ! -f package.json ]; then
    print_error "Server package.json not found. Make sure you're running this from the project root."
    exit 1
fi

print_info "Installing server dependencies..."
npm install

# Generate JWT key pair if not exists
if [ ! -f private.pem ]; then
    print_info "Generating JWT key pair..."
    openssl genrsa -out private.pem 2048
    openssl rsa -in private.pem -pubout -out public.pem
    print_status "JWT keys generated"
fi

# Create .env file if not exists
if [ ! -f .env ]; then
    print_info "Creating server .env file..."
    if [ -f .env.example ]; then
        cp .env.example .env
    else
        # Fallback minimal template
        cat > .env << EOF
JWT_ISSUER=https://unsent-letters.local
JWT_AUDIENCE=unsent-letters-mobile
JWT_EXPIRES_IN=3600
JWT_PRIVATE_KEY=""
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
LOCAL_PROVIDER=ollama
OLLAMA_BASE_URL=http://ollama:11434
LMSTUDIO_BASE_URL=http://lmstudio:1234
VLLM_BASE_URL=http://vllm:8000
EOF
    fi
    
    # Insert the generated private key into .env
    PRIVATE_KEY=$(cat private.pem | sed ':a;N;$!ba;s/\n/\\n/g')
    sed -i.bak "s|JWT_PRIVATE_KEY=.*|JWT_PRIVATE_KEY=\"$PRIVATE_KEY\"|" .env
    rm .env.bak
    
    print_status "Server .env file created"
    print_warning "Please edit server/.env and add your API keys for OpenAI, Anthropic, and auth providers"
else
    print_status "Server .env file already exists"
fi

# Build server
print_info "Building server..."
npm run build
print_status "Server built successfully"

cd ..

# Setup mobile app
echo -e "\n${BLUE}📱 Setting up mobile app...${NC}"
cd mobile

if [ ! -f pubspec.yaml ]; then
    print_error "Mobile pubspec.yaml not found."
    exit 1
fi

print_info "Installing mobile dependencies..."
flutter pub get

print_info "Running code generation..."
flutter pub run build_runner build --delete-conflicting-outputs

print_status "Mobile app setup complete"

cd ..

# Docker setup
if [ "$DOCKER_AVAILABLE" = true ]; then
    echo -e "\n${BLUE}🐳 Setting up Docker services...${NC}"
    
    # Create docker-compose override for development
    if [ ! -f docker-compose.override.yml ]; then
        cat > docker-compose.override.yml << EOF
version: '3.8'

services:
  server:
    environment:
      - NODE_ENV=development
    volumes:
      - ./server:/app
      - /app/node_modules
    ports:
      - "8080:8080"
    command: npm run dev
    
  ollama:
    profiles:
      - ollama
      - default
EOF
        print_status "Docker Compose override created for development"
    fi
    
    print_info "Pulling Docker images (this may take a while)..."
    docker-compose pull server ollama
    print_status "Docker images pulled"
else
    print_warning "Skipping Docker setup (Docker not available)"
fi

# Final instructions
echo -e "\n${GREEN}🎉 Setup complete!${NC}"
echo -e "\n${BLUE}Next steps:${NC}"
echo "1. Configure your API keys in server/.env"
echo "2. For Google Sign-In:"
echo "   - Add GoogleService-Info.plist to mobile/ios/Runner/"
echo "   - Add google-services.json to mobile/android/app/"
echo "   - Update GOOGLE_CLIENT_ID_* in server/.env"
echo "3. For Apple Sign-In:"
echo "   - Enable Sign in with Apple capability in Xcode"
echo "   - Update APPLE_* configuration in server/.env"
echo ""
echo "${BLUE}To start development:${NC}"
echo "# Terminal 1 - Start server"
echo "cd server && npm run dev"
echo ""
echo "# Terminal 2 - Start mobile app"
echo "cd mobile && flutter run"
echo ""
if [ "$DOCKER_AVAILABLE" = true ]; then
    echo "# Alternative - Use Docker Compose"
    echo "docker-compose up server ollama"
    echo ""
fi
echo "${BLUE}Admin dashboard:${NC} http://localhost:8080/admin"
echo "${BLUE}API health check:${NC} http://localhost:8080/v1/health"
echo ""
echo "${GREEN}Happy coding! 🚀${NC}"