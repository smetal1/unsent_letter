#!/bin/bash

# Unsent Letters Test Runner
# Runs all tests for both server and mobile app

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

print_header() {
    echo -e "\n${BLUE}$1${NC}"
    echo "$(printf '%*s' ${#1} | tr ' ' '=')"
}

echo -e "${BLUE}🧪 Running Unsent Letters Test Suite${NC}"

# Track test results
SERVER_TESTS_PASSED=false
MOBILE_TESTS_PASSED=false

# Server Tests
print_header "Running Server Tests"
cd server

if [ ! -d "node_modules" ]; then
    print_info "Installing server dependencies..."
    npm install
fi

print_info "Running server unit tests..."
if npm test; then
    print_status "Server tests passed"
    SERVER_TESTS_PASSED=true
else
    print_error "Server tests failed"
fi

print_info "Running server linting..."
if npm run lint; then
    print_status "Server linting passed"
else
    print_warning "Server linting issues found"
fi

print_info "Running server type checking..."
if npx tsc --noEmit; then
    print_status "Server type checking passed"
else
    print_error "Server type checking failed"
fi

cd ..

# Mobile Tests
print_header "Running Mobile Tests"

# Check if Flutter is available
if ! command -v flutter &> /dev/null; then
    print_error "Flutter not found. Skipping mobile tests."
else
    cd mobile
    
    print_info "Getting mobile dependencies..."
    flutter pub get
    
    print_info "Running mobile unit tests..."
    if flutter test; then
        print_status "Mobile tests passed"
        MOBILE_TESTS_PASSED=true
    else
        print_error "Mobile tests failed"
    fi
    
    print_info "Running mobile analysis..."
    if flutter analyze; then
        print_status "Mobile analysis passed"
    else
        print_warning "Mobile analysis issues found"
    fi
    
    cd ..
fi

# Integration Tests (if available)
print_header "Integration Tests"
print_info "Integration tests not yet implemented"

# Summary
print_header "Test Summary"

if [ "$SERVER_TESTS_PASSED" = true ]; then
    print_status "Server tests: PASSED"
else
    print_error "Server tests: FAILED"
fi

if [ "$MOBILE_TESTS_PASSED" = true ]; then
    print_status "Mobile tests: PASSED"
elif command -v flutter &> /dev/null; then
    print_error "Mobile tests: FAILED"
else
    print_warning "Mobile tests: SKIPPED (Flutter not available)"
fi

# Exit with appropriate code
if [ "$SERVER_TESTS_PASSED" = true ] && ([ "$MOBILE_TESTS_PASSED" = true ] || ! command -v flutter &> /dev/null); then
    echo -e "\n${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed${NC}"
    exit 1
fi