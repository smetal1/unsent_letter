#!/bin/bash

# Unsent Letters Environment Check
# Verifies all prerequisites are installed and configured

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

print_header() {
    echo -e "\n${BLUE}$1${NC}"
    echo "$(printf '%*s' ${#1} | tr ' ' '=')"
}

echo -e "${BLUE}🔍 Unsent Letters Environment Check${NC}"

# Track overall status
ALL_GOOD=true

print_header "System Requirements"

# Check Node.js
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    NODE_MAJOR=$(echo $NODE_VERSION | sed 's/v\([0-9]*\).*/\1/')
    if [ "$NODE_MAJOR" -ge 18 ]; then
        print_status "Node.js $NODE_VERSION (✓ >= 18.0.0)"
    else
        print_error "Node.js $NODE_VERSION (✗ need >= 18.0.0)"
        ALL_GOOD=false
    fi
else
    print_error "Node.js not found"
    ALL_GOOD=false
fi

# Check npm
if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    print_status "npm $NPM_VERSION"
else
    print_error "npm not found"
    ALL_GOOD=false
fi

# Check Flutter
if command -v flutter >/dev/null 2>&1; then
    FLUTTER_VERSION=$(flutter --version --machine 2>/dev/null | grep -o '"flutterVersion":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
    print_status "Flutter $FLUTTER_VERSION"
    
    # Run flutter doctor
    print_info "Running Flutter doctor..."
    flutter doctor --machine >/dev/null 2>&1
    if [ $? -eq 0 ]; then
        print_status "Flutter doctor passed"
    else
        print_warning "Flutter doctor found issues (run 'flutter doctor' for details)"
    fi
else
    print_error "Flutter not found"
    ALL_GOOD=false
fi

# Check Docker (optional)
if command -v docker >/dev/null 2>&1; then
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
    print_status "Docker $DOCKER_VERSION (optional)"
    
    if command -v docker-compose >/dev/null 2>&1; then
        COMPOSE_VERSION=$(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)
        print_status "Docker Compose $COMPOSE_VERSION (optional)"
    else
        print_warning "Docker Compose not found (optional for local AI)"
    fi
else
    print_warning "Docker not found (optional for local AI)"
fi

# Check OpenSSL
if command -v openssl >/dev/null 2>&1; then
    OPENSSL_VERSION=$(openssl version | cut -d' ' -f2)
    print_status "OpenSSL $OPENSSL_VERSION"
else
    print_error "OpenSSL not found (needed for JWT key generation)"
    ALL_GOOD=false
fi

print_header "Project Structure"

# Check project directories
if [ -d "server" ]; then
    print_status "Server directory found"
    
    if [ -f "server/package.json" ]; then
        print_status "Server package.json found"
    else
        print_error "Server package.json missing"
        ALL_GOOD=false
    fi
    
    if [ -f "server/.env" ]; then
        print_status "Server .env found"
    else
        print_warning "Server .env not found (will be created during setup)"
    fi
else
    print_error "Server directory missing"
    ALL_GOOD=false
fi

if [ -d "mobile" ]; then
    print_status "Mobile directory found"
    
    if [ -f "mobile/pubspec.yaml" ]; then
        print_status "Mobile pubspec.yaml found"
    else
        print_error "Mobile pubspec.yaml missing"
        ALL_GOOD=false
    fi
else
    print_error "Mobile directory missing"
    ALL_GOOD=false
fi

print_header "Dependencies Status"

# Check server dependencies
if [ -d "server/node_modules" ]; then
    print_status "Server dependencies installed"
else
    print_warning "Server dependencies not installed (run 'npm install' in server/)"
fi

# Check mobile dependencies
if [ -f "mobile/.packages" ] || [ -f "mobile/.dart_tool/package_config.json" ]; then
    print_status "Mobile dependencies installed"
else
    print_warning "Mobile dependencies not installed (run 'flutter pub get' in mobile/)"
fi

print_header "Configuration Files"

# Check environment example
if [ -f "server/.env.example" ]; then
    print_status "Server .env.example found"
else
    print_warning "Server .env.example missing"
fi

# Check Docker files
if [ -f "docker-compose.yml" ]; then
    print_status "docker-compose.yml found"
else
    print_warning "docker-compose.yml missing"
fi

print_header "Platform-Specific"

# Check platform
case "$(uname -s)" in
    Darwin)
        print_info "Platform: macOS"
        if command -v xcode-select >/dev/null 2>&1; then
            if xcode-select -p >/dev/null 2>&1; then
                print_status "Xcode command line tools installed"
            else
                print_warning "Xcode command line tools not installed"
            fi
        fi
        ;;
    Linux)
        print_info "Platform: Linux"
        ;;
    CYGWIN*|MINGW32*|MSYS*|MINGW*)
        print_info "Platform: Windows"
        ;;
    *)
        print_info "Platform: Unknown"
        ;;
esac

# Summary
print_header "Summary"

if [ "$ALL_GOOD" = true ]; then
    print_status "Environment check passed! ✨"
    echo -e "\n${GREEN}You're ready to start development!${NC}"
    echo -e "\n${BLUE}Next steps:${NC}"
    echo "1. Run './setup.sh' to complete the setup"
    echo "2. Configure API keys in server/.env"
    echo "3. Start development with './start-dev.sh'"
else
    print_error "Environment check failed"
    echo -e "\n${RED}Please install missing prerequisites and try again.${NC}"
    echo -e "\n${BLUE}See PREREQUISITES.md for detailed installation instructions.${NC}"
fi

echo ""