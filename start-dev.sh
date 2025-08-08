#!/bin/bash

# Unsent Letters Development Startup Script
# Starts both server and mobile app in development mode

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
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

echo -e "${BLUE}🚀 Starting Unsent Letters Development Environment${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ] && [ ! -d "server" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Function to cleanup background processes
cleanup() {
    echo -e "\n${BLUE}🛑 Shutting down services...${NC}"
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null || true
    fi
    if [ ! -z "$FLUTTER_PID" ]; then
        kill $FLUTTER_PID 2>/dev/null || true
    fi
    exit 0
}

# Setup signal handlers
trap cleanup SIGINT SIGTERM

# Start server in background
print_info "Starting server..."
cd server
npm run dev &
SERVER_PID=$!
cd ..

# Wait a moment for server to start
sleep 3

# Start mobile app in background
print_info "Starting mobile app..."
cd mobile
flutter run &
FLUTTER_PID=$!
cd ..

print_status "Development environment started!"
echo -e "\n${BLUE}Services running:${NC}"
echo "📊 Server: http://localhost:8080"
echo "📊 Admin: http://localhost:8080/admin"
echo "📱 Mobile app: Running on connected device/emulator"

echo -e "\n${BLUE}Logs:${NC}"
echo "Press Ctrl+C to stop all services"

# Wait for background processes
wait