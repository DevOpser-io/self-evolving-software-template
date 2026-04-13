# Port Configuration Guide

## Default Ports

The Bedrock Express application uses the following default ports:

- **Development Proxy Server**: Port 3000 (proxies to backend, used for development)
- **Backend Server**: Port 8000 (API and authentication)
- **Mobile Test Server**: Port 8080 (for testing mobile app locally)
- **Frontend**: Served via proxy on port 3000 in development

## Configuration Methods

### 1. Environment Variable (Recommended for Production)

Set the PORT environment variable before starting:
```bash
PORT=8000 npm start
```

### 2. .env File (Recommended for Development)

Create a `.env` file in the project root:
```env
PORT=8000
```

### 3. Package.json Scripts (Default)

The npm scripts in package.json use the default configuration:
```json
"backend:start": "cd backend && npm start",
"backend:dev": "cd backend && npm run dev"
```

### 4. Direct Configuration

The default is set in `/backend/config/index.js`:
```javascript
port: process.env.PORT || 8000,
```

## Running Multiple Services

To avoid port conflicts when running multiple services:

1. **Backend API**: Port 8000
2. **Mobile Test Server**: Port 8080
3. **Database (PostgreSQL)**: Port 5432
4. **Redis**: Port 6379

## Common Commands

### Start with development proxy (recommended for development):
```bash
# Terminal 1: Start backend on port 8000
npm run backend:dev

# Terminal 2: Start proxy on port 3000
npm run dev:proxy

# Then access the app at http://localhost:3000
```

### Start backend only on port 8000:
```bash
npm run dev
# or
npm start
```

### Start mobile test server on port 8080:
```bash
./test-mobile-web.sh
```

### Use custom port for mobile test:
```bash
PORT=3000 ./test-mobile-web.sh
```

## Troubleshooting

### Port Already in Use

If you get an error that port 8000 is already in use:

1. Check what's using the port:
   ```bash
   lsof -i :8000
   ```

2. Kill the process:
   ```bash
   kill -9 <PID>
   ```

3. Or use a different port:
   ```bash
   PORT=8001 npm run dev
   ```

### Accessing the Application

With development proxy (recommended):
- Web Interface: `http://localhost:3000`
- API Health Check: `http://localhost:3000/api/health`

Without proxy (backend only):
- Web Interface: `http://localhost:8000`
- API Health Check: `http://localhost:8000/api/health`

Mobile testing:
- Mobile Test: `http://localhost:8080/mobile-app.html`

## Production Considerations

In production environments (Kubernetes/ECS), the port is typically configured via:
- Environment variables in deployment manifests
- ConfigMaps or Secrets
- Container orchestration platform settings

The application will automatically use HTTPS in production when `NODE_ENV=production`.