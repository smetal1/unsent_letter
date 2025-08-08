const { createRemoteJWKSet } = require('jose');

class JWKSService {
  constructor() {
    this.cache = {};
    this.CACHE_TTL = 3600000; // 1 hour in milliseconds
  }

  /**
   * Get JWKS for a given URL with caching
   */
  getJWKS(url) {
    const now = Date.now();
    const cached = this.cache[url];

    // Return cached version if still valid
    if (cached && (now - cached.lastFetched) < this.CACHE_TTL) {
      return cached.jwks;
    }

    // Create new JWKS client
    const jwks = createRemoteJWKSet(new URL(url), {
      cooldownDuration: 30000, // 30 seconds
      cacheMaxAge: this.CACHE_TTL,
    });

    // Cache it
    this.cache[url] = {
      jwks,
      lastFetched: now,
    };

    return jwks;
  }

  /**
   * Clear cache for a specific URL or all
   */
  clearCache(url) {
    if (url) {
      delete this.cache[url];
    } else {
      this.cache = {};
    }
  }

  /**
   * Get Google JWKS
   */
  getGoogleJWKS() {
    return this.getJWKS('https://www.googleapis.com/oauth2/v3/certs');
  }

  /**
   * Get Apple JWKS
   */
  getAppleJWKS() {
    return this.getJWKS('https://appleid.apple.com/auth/keys');
  }
}

// Singleton instance
const jwksService = new JWKSService();

module.exports = { jwksService };