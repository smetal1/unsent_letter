#!/bin/bash

# Unsent Letters Server Startup Script
# Starts only the server in development mode

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

echo -e "${BLUE}🚀 Starting Unsent Letters Server${NC}"

# Check if we're in the right directory
if [ ! -d "server" ]; then
    print_error "Server directory not found. Please run this script from the project root directory"
    exit 1
fi

cd server

# Check if .env exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_info "Please edit server/.env with your API keys and configuration"
    else
        print_error ".env.example not found. Please create .env manually."
        exit 1
    fi
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    print_info "Installing dependencies..."
    npm install
fi

# Build if needed
if [ ! -d "dist" ]; then
    print_info "Building server..."
    npm run build
fi

# Start server
print_info "Starting server in development mode..."
print_status "Server starting..."

echo -e "\n${BLUE}Server will be available at:${NC}"
echo "📊 API: http://localhost:8080"
echo "📊 Admin: http://localhost:8080/admin"
echo "📊 Health: http://localhost:8080/v1/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev