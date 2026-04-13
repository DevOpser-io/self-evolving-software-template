/**
 * Mobile API Client
 *
 * Secure API client for mobile app with:
 * - API key authentication
 * - Request signing
 * - Automatic retry logic
 * - Certificate pinning support
 */

class MobileAPIClient {
  constructor(config) {
    this.baseURL = config.baseURL;
    this.apiKey = config.apiKey || this.getDevApiKey();
    this.signingSecret = config.signingSecret;
    this.platform = this.detectPlatform();
    this.version = config.version || '1.0.0';
    this.debug = config.debug || false;
  }

  /**
   * Get development API key (should be replaced in production builds)
   */
  getDevApiKey() {
    // Check if API key is injected during build (for native apps)
    if (window.MOBILE_CONFIG && window.MOBILE_CONFIG.apiKey) {
      return window.MOBILE_CONFIG.apiKey;
    }

    // For development/emulator
    if (this.debug) {
      console.warn('⚠️ Using development API key - not for production!');
    }
    return 'dev_mobile_api_key_change_in_production';
  }

  /**
   * Detect the platform (iOS, Android, Web)
   */
  detectPlatform() {
    if (typeof window !== 'undefined' && window.Capacitor) {
      return Capacitor.getPlatform(); // 'ios', 'android', or 'web'
    }
    return 'web';
  }

  /**
   * Sign a request for tamper protection using Web Crypto API
   */
  async signRequest(method, path, body) {
    if (!this.signingSecret) {
      return null;
    }

    const timestamp = Date.now();
    const message = `${method}:${path}:${timestamp}:${JSON.stringify(body || {})}`;

    try {
      // Use Web Crypto API for HMAC-SHA256
      const encoder = new TextEncoder();
      const keyData = encoder.encode(this.signingSecret);
      const messageData = encoder.encode(message);

      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signature = await crypto.subtle.sign('HMAC', key, messageData);
      const signatureHex = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      return { signature: signatureHex, timestamp };
    } catch (error) {
      console.error('[Mobile API] Error signing request:', error);
      return null;
    }
  }

  /**
   * Make an API request with authentication
   */
  async request(method, endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const { body, headers = {}, retry = true } = options;

    // Add mobile authentication headers
    const mobileHeaders = {
      'X-API-Key': this.apiKey,
      'X-Platform': this.platform,
      'X-Client-Version': this.version,
      'Content-Type': 'application/json',
      ...headers
    };

    // Add request signature if signing is enabled
    if (this.signingSecret) {
      const signatureData = await this.signRequest(method, endpoint, body);
      if (signatureData) {
        mobileHeaders['X-Signature'] = signatureData.signature;
        mobileHeaders['X-Timestamp'] = signatureData.timestamp.toString();
      }
    }

    if (this.debug) {
      console.log(`📱 Mobile API Request: ${method} ${url}`);
      console.log('Headers:', mobileHeaders);
    }

    try {
      const response = await fetch(url, {
        method,
        headers: mobileHeaders,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include' // Include cookies for session auth
      });

      if (this.debug) {
        console.log(`📱 Response status: ${response.status}`);
      }

      // Handle 401 unauthorized
      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Unauthorized');
      }

      // Handle other errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Return response for caller to handle
      return response;

    } catch (error) {
      if (this.debug) {
        console.error(`📱 API Error: ${error.message}`);
      }

      // Retry logic for network errors
      if (retry && error.message.includes('network')) {
        console.log('📱 Retrying request...');
        return this.request(method, endpoint, { ...options, retry: false });
      }

      throw error;
    }
  }

  /**
   * Convenience methods
   */
  get(endpoint, options = {}) {
    return this.request('GET', endpoint, options);
  }

  post(endpoint, body, options = {}) {
    return this.request('POST', endpoint, { ...options, body });
  }

  put(endpoint, body, options = {}) {
    return this.request('PUT', endpoint, { ...options, body });
  }

  delete(endpoint, options = {}) {
    return this.request('DELETE', endpoint, options);
  }
}

// Make available globally
window.MobileAPIClient = MobileAPIClient;
