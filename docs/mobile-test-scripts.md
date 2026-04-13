# Mobile App Testing Scripts

This document explains the mobile app testing scripts available in the Bedrock Express project.

## Available Scripts

### 1. test-mobile-web.sh
Simple web server for testing the mobile app in a browser.

**Usage:**
```bash
# Default (development environment, port 8080)
./test-mobile-web.sh

# Custom environment
MOBILE_ENV=staging ./test-mobile-web.sh

# Custom port
PORT=3000 ./test-mobile-web.sh
```

**Features:**
- Builds the mobile app with the specified environment
- Starts a local HTTP server (Python or Node.js)
- Accessible at `http://localhost:8080/mobile-app.html`
- Simple and quick testing

### 2. test-mobile-capacitor.sh
Advanced testing with Capacitor device emulation.

**Usage:**
```bash
# Run on Android emulator (default)
./test-mobile-capacitor.sh

# Run on iOS simulator (macOS only)
./test-mobile-capacitor.sh ios

# Run in web browser with device frame
./test-mobile-capacitor.sh web

# Run on connected Android device
./test-mobile-capacitor.sh android --device

# List available devices
./test-mobile-capacitor.sh android --list

# Custom environment
./test-mobile-capacitor.sh android --env=staging
```

**Features:**
- Device frame simulation in web mode
- Portrait/landscape rotation
- Native device/emulator support
- Real mobile app experience

## Prerequisites

### For test-mobile-web.sh:
- Python 3 or Python 2 (preferred)
- OR Node.js (fallback)
- build-mobile.sh script

### For test-mobile-capacitor.sh:
- Node.js and npm
- Capacitor dependencies (`npm install`)
- For Android: Android Studio and SDK
- For iOS: macOS with Xcode (iOS testing only)

## Environment Variables

Both scripts support:
- `MOBILE_ENV`: Set to 'development', 'staging', or 'production'
- `PORT`: Custom port for the web server (test-mobile-web.sh only)

## Examples

### Quick Local Testing
```bash
# Build and serve for development
./test-mobile-web.sh

# Open in browser
# Navigate to: http://localhost:8080/mobile-app.html
```

### Capacitor Web Testing with Device Frame
```bash
# Start Capacitor web test
./test-mobile-capacitor.sh web

# Features available:
# - Toggle device frame on/off
# - Rotate between portrait/landscape
# - Quick refresh button
```

### Android Testing
```bash
# Check connected devices
adb devices

# Run on emulator
./test-mobile-capacitor.sh android

# Run on connected device
./test-mobile-capacitor.sh android --device
```

### Production Environment Testing
```bash
# Test with production settings
MOBILE_ENV=production ./test-mobile-web.sh
```

## Troubleshooting

### Port Already in Use
If port 8080 is busy:
```bash
PORT=3000 ./test-mobile-web.sh
```

### Android Emulator Issues
1. Ensure Android Studio is installed
2. Create an AVD (Android Virtual Device) if needed
3. Check available emulators: `./test-mobile-capacitor.sh android --list`

### iOS Simulator Issues (macOS only)
1. Ensure Xcode is installed
2. Open Xcode once to install additional components
3. Check available simulators: `./test-mobile-capacitor.sh ios --list`

### Build Failures
1. Check that build-mobile.sh exists and is executable
2. Ensure all npm dependencies are installed: `npm install`
3. Verify environment variables are set correctly

## CI/CD Integration

These scripts are designed for local development. For CI/CD:
- Use GitHub Actions workflow for automated APK/IPA generation
- See `.github/workflows/build-and-deploy-with-mobile.yml`

## Related Documentation
- [Mobile App Development Guide](./mobile-app-development.md)
- [Google OAuth Setup](./google-oauth-setup.md)
- [GitHub Actions Mobile Build](../.github/workflows/README.md)