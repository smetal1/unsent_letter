#!/bin/bash

# Unsent Letters Docker Startup Script
# Starts server with Docker-based AI providers

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo -e "${BLUE}🐳 Starting Unsent Letters with Docker${NC}"

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "docker-compose.yml not found. Please run this script from the project root directory"
    exit 1
fi

# Parse command line arguments
PROVIDER=${1:-ollama}
PROFILE=""

case $PROVIDER in
    ollama)
        PROFILE="ollama"
        print_info "Starting with Ollama (local LLM)"
        ;;
    lmstudio)
        PROFILE="lmstudio"
        print_info "Starting with LM Studio"
        ;;
    vllm)
        PROFILE="vllm"
        print_info "Starting with vLLM"
        ;;
    server-only)
        PROFILE="server-only"
        print_info "Starting server only (no local AI)"
        ;;
    *)
        echo "Usage: $0 [ollama|lmstudio|vllm|server-only]"
        echo ""
        echo "Available options:"
        echo "  ollama      - Start with Ollama (default)"
        echo "  lmstudio    - Start with LM Studio"
        echo "  vllm        - Start with vLLM"
        echo "  server-only - Start only the server"
        exit 1
        ;;
esac

# Function to cleanup
cleanup() {
    echo -e "\n${BLUE}🛑 Shutting down Docker services...${NC}"
    if [ "$PROFILE" = "server-only" ]; then
        docker-compose down
    else
        docker-compose --profile $PROFILE down
    fi
    exit 0
}

# Setup signal handlers
trap cleanup SIGINT SIGTERM

# Set environment variable for the chosen provider
export LOCAL_PROVIDER=$PROVIDER

# Start services
print_info "Starting Docker services..."
if [ "$PROFILE" = "server-only" ]; then
    docker-compose up server
else
    docker-compose --profile $PROFILE up
fi