#!/usr/bin/env node
/**
 * Development proxy server
 * Runs on port 3000 and proxies requests to either localhost:8000 or the staging URL
 * Usage: node dev-proxy.js
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Target URLs
const LOCAL_API = 'http://localhost:8000';
const STAGING_API = process.env.STAGING_API_URL || 'https://staging.example.com'; // Update with your staging URL

// Check if local API is running
const checkLocalAPI = async () => {
  try {
    const response = await fetch(`${LOCAL_API}/api/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
};

// Determine which API to use
let currentTarget = LOCAL_API;

const updateTarget = async () => {
  const isLocalRunning = await checkLocalAPI();
  const newTarget = isLocalRunning ? LOCAL_API : STAGING_API;

  if (newTarget !== currentTarget) {
    currentTarget = newTarget;
    console.log(`\n🔄 API target changed to: ${currentTarget}`);
  }

  return currentTarget;
};

// Check API availability every 5 seconds
setInterval(updateTarget, 5000);

// Serve static files from frontend/public
app.use(express.static(path.join(__dirname, 'frontend', 'public')));

// Serve static files from backend/public
app.use(express.static(path.join(__dirname, 'backend', 'public')));

// Proxy all other requests
app.use('*', createProxyMiddleware({
  target: currentTarget,
  changeOrigin: true,
  router: async () => {
    // Dynamically determine target for each request
    return await updateTarget();
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err.message);
    res.status(502).json({
      error: 'Backend unavailable',
      message: 'Both local and staging APIs are unreachable'
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} -> ${currentTarget}`);
  }
}));

// Initial check and start server
updateTarget().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Development proxy server running on http://localhost:${PORT}`);
    console.log(`📡 Current API target: ${currentTarget}`);
    console.log('\nThe proxy will automatically switch between:');
    console.log(`  - Local API: ${LOCAL_API} (when available)`);
    console.log(`  - Staging API: ${STAGING_API} (as fallback)\n`);
  });
});