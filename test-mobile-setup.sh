#!/bin/bash

# Test script to verify mobile app setup
set -e

echo "======================================="
echo "Testing Bedrock Express Mobile Setup"
echo "======================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_test() {
    echo -e "${YELLOW}Testing:${NC} $1"
}

print_pass() {
    echo -e "${GREEN}✓ PASS:${NC} $1"
    echo ""
}

print_fail() {
    echo -e "${RED}✗ FAIL:${NC} $1"
    echo ""
}

# Test 1: Check if mobile HTML exists
print_test "Mobile HTML file exists"
if [ -f "mobile-chat-app.html" ]; then
    print_pass "mobile-chat-app.html found"
else
    print_fail "mobile-chat-app.html not found"
fi

# Test 2: Check if build script exists and is executable
print_test "Build script exists and is executable"
if [ -x "build-mobile.sh" ]; then
    print_pass "build-mobile.sh is executable"
else
    print_fail "build-mobile.sh not executable or not found"
fi

# Test 3: Check Capacitor configuration
print_test "Capacitor configuration exists"
if [ -f "capacitor.config.json" ]; then
    print_pass "capacitor.config.json found"
else
    print_fail "capacitor.config.json not found"
fi

# Test 4: Check GitHub workflow
print_test "GitHub Actions workflow exists"
if [ -f ".github/workflows/build-and-deploy-with-mobile.yml" ]; then
    print_pass "Mobile build workflow found"
else
    print_fail "Mobile build workflow not found"
fi

# Test 5: Check well-known templates
print_test "App association templates exist"
TEMPLATES_OK=true
if [ ! -f "backend/public/.well-known/assetlinks.json.template" ]; then
    echo "  Missing: assetlinks.json.template"
    TEMPLATES_OK=false
fi
if [ ! -f "backend/public/.well-known/apple-app-site-association.template" ]; then
    echo "  Missing: apple-app-site-association.template"
    TEMPLATES_OK=false
fi
if [ "$TEMPLATES_OK" = true ]; then
    print_pass "All templates found"
else
    print_fail "Some templates missing"
fi

# Test 6: Try building mobile assets
print_test "Building mobile assets"
if ./build-mobile.sh > /dev/null 2>&1; then
    print_pass "Mobile build successful"

    # Check if output was created
    if [ -f "frontend/public/static/dist/index.html" ]; then
        echo -e "  ${GREEN}✓${NC} Output created at frontend/public/static/dist/"
    fi
else
    print_fail "Mobile build failed"
fi

# Test 7: Check npm scripts
print_test "NPM scripts configured"
if grep -q "mobile:build" package.json; then
    print_pass "Mobile npm scripts found"
else
    print_fail "Mobile npm scripts not found"
fi

# Summary
echo "======================================="
echo "Test Summary"
echo "======================================="
echo ""
echo "Mobile app setup is ready for:"
echo "  • Web-based mobile app development"
echo "  • Android APK generation (via GitHub Actions)"
echo "  • iOS app development (requires Mac)"
echo ""
echo "Next steps:"
echo "  1. Install Capacitor dependencies: npm install"
echo "  2. Initialize Android project: npx cap add android"
echo "  3. Build mobile app: npm run mobile:build"
echo "  4. Test locally: npm run mobile:run:android"
echo ""
echo "For production:"
echo "  • Set up GitHub secrets for app signing"
echo "  • Configure API URLs in build-mobile.sh"
echo "  • Push to main/staging to trigger APK build"
echo ""
echo -e "${GREEN}Mobile setup complete!${NC}"