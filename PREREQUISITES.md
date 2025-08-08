# Prerequisites and Setup Guide

This document outlines all the prerequisites and setup steps needed to run the Unsent Letters application.

## System Requirements

### Required Software

#### Node.js (18.0.0 or higher)
- **Download**: https://nodejs.org/
- **Verify**: `node --version && npm --version`
- **Recommended**: Use Node Version Manager (nvm) for version management

#### Flutter (3.16.0 or higher)
- **Download**: https://flutter.dev/docs/get-started/install
- **Verify**: `flutter doctor`
- **Note**: Ensure all dependencies are resolved (Android SDK, Xcode for iOS)

### Optional Software

#### Docker & Docker Compose (for local AI providers)
- **Docker**: https://docs.docker.com/get-docker/
- **Docker Compose**: Usually included with Docker Desktop
- **Verify**: `docker --version && docker-compose --version`

#### OpenSSL (for JWT key generation)
- **Linux/macOS**: Usually pre-installed
- **Windows**: Install via Git for Windows or WSL
- **Verify**: `openssl version`

## Development Environment Setup

### 1. Platform-Specific Setup

#### macOS
```bash
# Install Xcode from App Store (for iOS development)
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node

# Install Flutter
brew install --cask flutter

# Install Docker Desktop
brew install --cask docker
```

#### Ubuntu/Debian
```bash
# Update package list
sudo apt update

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Flutter dependencies
sudo apt-get install -y curl git unzip xz-utils zip libglu1-mesa

# Download and install Flutter
cd ~/development
git clone https://github.com/flutter/flutter.git -b stable
echo 'export PATH="$PATH:$HOME/development/flutter/bin"' >> ~/.bashrc
source ~/.bashrc

# Install Docker
sudo apt-get install -y docker.io docker-compose
sudo usermod -aG docker $USER
```

#### Windows
1. Install Node.js from https://nodejs.org/
2. Install Flutter from https://flutter.dev/docs/get-started/install/windows
3. Install Docker Desktop from https://www.docker.com/products/docker-desktop
4. Install Git for Windows (includes OpenSSL)

### 2. Mobile Development Setup

#### Android Development
```bash
# Install Android Studio
# Download from: https://developer.android.com/studio

# Accept Android licenses
flutter doctor --android-licenses

# Create Android Virtual Device (AVD)
# Open Android Studio > AVD Manager > Create Virtual Device
```

#### iOS Development (macOS only)
```bash
# Install Xcode from App Store
# Install iOS Simulator
xcode-select --install

# Accept Xcode license
sudo xcodebuild -license accept

# Install CocoaPods
sudo gem install cocoapods
```

## API Keys and External Services

### Required for Production

#### OpenAI API
- **Sign up**: https://platform.openai.com/
- **Get API key**: https://platform.openai.com/api-keys
- **Add to**: `server/.env` as `OPENAI_API_KEY`

#### Anthropic API (Claude)
- **Sign up**: https://console.anthropic.com/
- **Get API key**: https://console.anthropic.com/settings/keys
- **Add to**: `server/.env` as `ANTHROPIC_API_KEY`

### Authentication Providers

#### Google Sign-In
1. **Google Cloud Console**: https://console.cloud.google.com/
2. **Create project** or select existing project
3. **Enable Google Sign-In API**
4. **Create OAuth 2.0 credentials**:
   - Web client (for server verification)
   - iOS client (for iOS app)
   - Android client (for Android app)
5. **Download configuration files**:
   - `GoogleService-Info.plist` → `mobile/ios/Runner/`
   - `google-services.json` → `mobile/android/app/`
6. **Add client IDs** to `server/.env`

#### Apple Sign-In (iOS only)
1. **Apple Developer Account**: https://developer.apple.com/
2. **App ID Configuration**:
   - Enable "Sign In with Apple" capability
   - Configure service ID and key
3. **Add configuration** to `server/.env`

## Quick Start

### Option 1: Automatic Setup (Recommended)
```bash
# Clone the repository
git clone <repository-url>
cd unsent-letters

# Run the setup script
chmod +x setup.sh
./setup.sh
```

### Option 2: Manual Setup

#### Server Setup
```bash
cd server

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Generate JWT key pair
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# Add the private key to .env (replace newlines with \n)
# Edit .env and add your API keys

# Build the server
npm run build

# Start development server
npm run dev
```

#### Mobile Setup
```bash
cd mobile

# Install dependencies
flutter pub get

# Run code generation
flutter pub run build_runner build --delete-conflicting-outputs

# Start the app (with device/emulator connected)
flutter run
```

## Startup Scripts

### Development Mode
```bash
# Start both server and mobile app
./start-dev.sh

# Start only server
./start-server.sh

# Start with Docker (includes local AI)
./start-docker.sh [ollama|lmstudio|vllm|server-only]
```

### Production Mode
```bash
# Build for production
cd server && npm run build
cd ../mobile && flutter build apk  # Android
cd ../mobile && flutter build ios  # iOS

# Start production server
cd server && npm start
```

## Verification Steps

### 1. Server Health Check
```bash
curl http://localhost:8080/v1/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. Flutter Doctor
```bash
flutter doctor -v
```

All items should show ✓ (or at least no critical errors)

### 3. Mobile App Connection
- Start the server
- Start the mobile app
- Check if the app can reach the server API

## Troubleshooting

### Common Issues

#### "Flutter command not found"
```bash
# Add Flutter to PATH
export PATH="$PATH:/path/to/flutter/bin"
# Or add to ~/.bashrc, ~/.zshrc, etc.
```

#### "Node version too old"
```bash
# Update Node.js using nvm
nvm install 18
nvm use 18
```

#### "Docker permission denied"
```bash
# Add user to docker group (Linux)
sudo usermod -aG docker $USER
# Log out and log back in
```

#### "iOS build fails"
```bash
# Clean and rebuild
cd mobile/ios
rm -rf Pods Podfile.lock
cd ..
flutter clean
flutter pub get
cd ios
pod install
cd ..
flutter run
```

#### "Android build fails"
```bash
# Accept all licenses
flutter doctor --android-licenses

# Clean and rebuild
flutter clean
flutter pub get
flutter run
```

### Getting Help

1. **Check logs**: Server logs in terminal, mobile logs in `flutter run` output
2. **Run diagnostics**: `flutter doctor -v`
3. **Check dependencies**: Ensure all prerequisites are installed
4. **Environment variables**: Verify all required variables are set in `server/.env`

## Next Steps

After completing the setup:

1. **Configure API keys** in `server/.env`
2. **Set up authentication** (Google/Apple Sign-In)
3. **Test the application** with different AI providers
4. **Deploy to production** when ready

For detailed API documentation and architecture information, see the main README.md file.