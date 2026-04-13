#!/bin/bash

# Test Mobile App with Capacitor
# This script runs the mobile app using Capacitor for better device emulation

set -e

echo "========================================="
echo "Capacitor Mobile App Test Environment"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
PLATFORM=${1:-"android"}
MOBILE_ENV=${MOBILE_ENV:-"development"}

# Function to check dependencies
check_dependencies() {
    local missing_deps=()

    # Check for Node.js
    if ! command -v node &> /dev/null; then
        missing_deps+=("Node.js")
    fi

    # Check for npm
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    fi

    # Check if Capacitor is installed
    if [ ! -d "node_modules/@capacitor/cli" ]; then
        echo -e "${YELLOW}Capacitor CLI not found. Installing...${NC}"
        npm install
    fi

    # Report missing dependencies
    if [ ${#missing_deps[@]} -ne 0 ]; then
        echo -e "${RED}Missing required dependencies:${NC}"
        for dep in "${missing_deps[@]}"; do
            echo -e "${RED}  - $dep${NC}"
        done
        exit 1
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [platform] [options]"
    echo ""
    echo "Platforms:"
    echo "  android    - Run on Android emulator/device (default)"
    echo "  ios        - Run on iOS simulator/device"
    echo "  web        - Run in web browser with Capacitor"
    echo ""
    echo "Options:"
    echo "  --env=ENV  - Set environment (development/staging/production)"
    echo "  --device   - Run on connected device instead of emulator"
    echo "  --list     - List available devices/emulators"
    echo ""
    echo "Examples:"
    echo "  $0                    # Run on Android emulator"
    echo "  $0 ios                # Run on iOS simulator"
    echo "  $0 android --device   # Run on connected Android device"
    echo "  $0 web                # Run in browser"
}

# Parse additional options
for arg in "$@"; do
    case $arg in
        --help|-h)
            show_usage
            exit 0
            ;;
        --env=*)
            MOBILE_ENV="${arg#*=}"
            ;;
        --list)
            LIST_DEVICES=true
            ;;
        --device)
            USE_DEVICE=true
            ;;
    esac
done

echo -e "${BLUE}Platform: $PLATFORM${NC}"
echo -e "${BLUE}Environment: $MOBILE_ENV${NC}"

# Check dependencies
check_dependencies

# Step 1: Build the mobile app
echo -e "\n${GREEN}Step 1: Building mobile app...${NC}"
MOBILE_ENV=$MOBILE_ENV ./build-mobile.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to build mobile app${NC}"
    exit 1
fi

# Step 2: Sync with Capacitor
echo -e "\n${GREEN}Step 2: Syncing Capacitor...${NC}"
npx cap sync

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to sync Capacitor${NC}"
    exit 1
fi

# Step 3: Run on selected platform
echo -e "\n${GREEN}Step 3: Running on $PLATFORM...${NC}"

case $PLATFORM in
    android)
        if [ "$LIST_DEVICES" = true ]; then
            echo -e "${YELLOW}Available Android devices:${NC}"
            if command -v adb &> /dev/null; then
                adb devices -l
            else
                echo -e "${RED}ADB not found. Install Android SDK tools.${NC}"
            fi
            exit 0
        fi

        if [ "$USE_DEVICE" = true ]; then
            echo -e "${YELLOW}Running on connected Android device...${NC}"
            npx cap run android --target=$(adb devices | grep -w device | head -1 | awk '{print $1}')
        else
            echo -e "${YELLOW}Running on Android emulator...${NC}"
            npx cap run android
        fi
        ;;

    ios)
        # Check if running on macOS
        if [[ "$OSTYPE" != "darwin"* ]]; then
            echo -e "${RED}iOS development requires macOS${NC}"
            exit 1
        fi

        if [ "$LIST_DEVICES" = true ]; then
            echo -e "${YELLOW}Available iOS simulators:${NC}"
            xcrun simctl list devices
            exit 0
        fi

        if [ "$USE_DEVICE" = true ]; then
            echo -e "${YELLOW}Running on connected iOS device...${NC}"
            npx cap run ios --target device
        else
            echo -e "${YELLOW}Running on iOS simulator...${NC}"
            npx cap run ios
        fi
        ;;

    web)
        echo -e "${YELLOW}Starting Capacitor web server...${NC}"

        # Create a simple HTML wrapper for testing
        cat > capacitor-test.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Mobile App Test</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            overflow: hidden;
        }
        iframe {
            width: 100vw;
            height: 100vh;
            border: none;
        }
        .device-frame {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 375px;
            height: 812px;
            border: 2px solid #333;
            border-radius: 36px;
            padding: 10px;
            background: #000;
            box-shadow: 0 0 30px rgba(0,0,0,0.5);
        }
        .device-frame iframe {
            border-radius: 26px;
            width: 100%;
            height: 100%;
        }
        .controls {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
            background: white;
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .controls button {
            margin: 5px;
            padding: 8px 12px;
            border: none;
            border-radius: 4px;
            background: #007AFF;
            color: white;
            cursor: pointer;
        }
        .controls button:hover {
            background: #0051D5;
        }
    </style>
</head>
<body>
    <div class="controls">
        <button onclick="toggleFrame()">Toggle Device Frame</button>
        <button onclick="rotateDevice()">Rotate Device</button>
        <button onclick="location.reload()">Refresh</button>
    </div>
    <div id="container" class="device-frame">
        <iframe src="mobile-app.html"></iframe>
    </div>
    <script>
        let frameEnabled = true;
        let isLandscape = false;

        function toggleFrame() {
            frameEnabled = !frameEnabled;
            const container = document.getElementById('container');
            if (frameEnabled) {
                container.className = 'device-frame';
            } else {
                container.className = '';
                container.style = '';
            }
        }

        function rotateDevice() {
            if (!frameEnabled) return;
            isLandscape = !isLandscape;
            const container = document.getElementById('container');
            if (isLandscape) {
                container.style.width = '812px';
                container.style.height = '375px';
            } else {
                container.style.width = '375px';
                container.style.height = '812px';
            }
        }
    </script>
</body>
</html>
EOF

        echo -e "${GREEN}=========================================${NC}"
        echo -e "${GREEN}Mobile app test environment available at:${NC}"
        echo -e "${GREEN}http://localhost:8080/capacitor-test.html${NC}"
        echo -e "${GREEN}=========================================${NC}"
        echo ""
        echo -e "${YELLOW}Features:${NC}"
        echo "  - Device frame simulation"
        echo "  - Portrait/landscape rotation"
        echo "  - Quick refresh"
        echo ""
        echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"

        # Start Python server
        if command -v python3 &> /dev/null; then
            python3 -m http.server 8080
        else
            python -m SimpleHTTPServer 8080
        fi

        # Clean up on exit
        trap "rm -f capacitor-test.html" EXIT
        ;;

    *)
        echo -e "${RED}Unknown platform: $PLATFORM${NC}"
        show_usage
        exit 1
        ;;
esac

echo -e "\n${GREEN}✓ Mobile app test completed${NC}"