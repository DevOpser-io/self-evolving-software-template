#!/bin/bash

# Test Mobile Web App Script
# This script builds and serves the mobile app locally for testing

set -e

echo "========================================="
echo "Mobile Web App Test Environment"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
MOBILE_ENV=${MOBILE_ENV:-"development"}
PORT=${PORT:-3000}

echo -e "${YELLOW}Setting up mobile app for environment: $MOBILE_ENV${NC}"

# Step 1: Build the mobile app
echo -e "\n${GREEN}Step 1: Building mobile app...${NC}"
if [ -f "./build-mobile.sh" ]; then
    MOBILE_ENV=$MOBILE_ENV ./build-mobile.sh
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Mobile app built successfully${NC}"
    else
        echo -e "${RED}✗ Failed to build mobile app${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ build-mobile.sh not found${NC}"
    exit 1
fi

# Step 2: Check if mobile app was built
if [ ! -f "mobile-app.html" ]; then
    echo -e "${RED}✗ mobile-app.html not found after build${NC}"
    exit 1
fi

# Step 3: Start a simple HTTP server
echo -e "\n${GREEN}Step 2: Starting local web server...${NC}"

# Check if Python is available
if command -v python3 &> /dev/null; then
    echo -e "${YELLOW}Starting server at http://localhost:$PORT${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
    echo ""
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}Mobile app available at:${NC}"
    echo -e "${GREEN}http://localhost:$PORT/${NC}"
    echo -e "${GREEN}=========================================${NC}"
    echo ""

    # Create index.html symlink to mobile-app.html for root access
    ln -sf mobile-app.html index.html

    # Start Python HTTP server from the current directory
    python3 -m http.server $PORT
elif command -v python &> /dev/null; then
    # Fallback to Python 2 if available
    echo -e "${YELLOW}Starting server at http://localhost:$PORT${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
    echo ""
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}Mobile app available at:${NC}"
    echo -e "${GREEN}http://localhost:$PORT/mobile-app.html${NC}"
    echo -e "${GREEN}=========================================${NC}"
    echo ""

    # Start Python 2 HTTP server
    python -m SimpleHTTPServer $PORT
else
    # Use Node.js as fallback
    echo -e "${YELLOW}Python not found, trying Node.js...${NC}"

    # Create a simple Node.js server script
    cat > temp-server.js << 'EOF'
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './mobile-app.html';
    }

    const extname = path.extname(filePath);
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 - File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n=========================================`);
    console.log(`Mobile app available at:`);
    console.log(`http://localhost:${PORT}/mobile-app.html`);
    console.log(`=========================================\n`);
    console.log(`Press Ctrl+C to stop the server`);
});
EOF

    echo -e "${GREEN}Starting Node.js server at http://localhost:$PORT${NC}"
    PORT=$PORT node temp-server.js

    # Clean up temp file on exit
    trap "rm -f temp-server.js" EXIT
fi