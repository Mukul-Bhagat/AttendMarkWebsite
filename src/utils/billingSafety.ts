/**
 * Billing Safety Utilities
 * 
 * This module provides utilities to monitor and enforce billing safety
 * for Google Maps API usage. It helps prevent unexpected charges by
 * tracking usage and providing warnings.
 * 
 * Note: These are client-side utilities. Actual billing controls must be
 * configured in Google Cloud Console (see GOOGLE_CLOUD_BILLING_SAFETY.md).
 */

/**
 * API usage limits (should match Google Cloud Console quotas)
 * These are soft limits for client-side monitoring
 */
export const API_QUOTAS = {
  MAPS_JAVASCRIPT: {
    requestsPerDay: 100,
    requestsPerMinute: 10,
  },
  PLACES: {
    requestsPerDay: 100,
    requestsPerMinute: 10,
  },
} as const;

/**
 * Usage tracking interface
 */
interface UsageTracking {
  mapsJavaScript: {
    count: number;
    lastReset: number;
    minuteCount: number;
    minuteWindow: number;
  };
  places: {
    count: number;
    lastReset: number;
    minuteCount: number;
    minuteWindow: number;
  };
}

const STORAGE_KEY = 'google_maps_api_usage';

/**
 * Get usage tracking from localStorage
 */
function getUsageTracking(): UsageTracking {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      // Reset if it's a new day
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      
      if (now - data.mapsJavaScript.lastReset > oneDay) {
        data.mapsJavaScript.count = 0;
        data.mapsJavaScript.lastReset = now;
      }
      
      if (now - data.places.lastReset > oneDay) {
        data.places.count = 0;
        data.places.lastReset = now;
      }
      
      return data;
    }
  } catch (error) {
    console.warn('Failed to load usage tracking:', error);
  }
  
  // Default tracking
  const now = Date.now();
  return {
    mapsJavaScript: {
      count: 0,
      lastReset: now,
      minuteCount: 0,
      minuteWindow: now,
    },
    places: {
      count: 0,
      lastReset: now,
      minuteCount: 0,
      minuteWindow: now,
    },
  };
}

/**
 * Save usage tracking to localStorage
 */
function saveUsageTracking(tracking: UsageTracking): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracking));
  } catch (error) {
    console.warn('Failed to save usage tracking:', error);
  }
}

/**
 * Track API usage
 * 
 * @param apiType - Type of API call ('mapsJavaScript' | 'places')
 * @returns true if within limits, false if limit exceeded
 */
export function trackApiUsage(apiType: 'mapsJavaScript' | 'places'): boolean {
  const tracking = getUsageTracking();
  const api = tracking[apiType];
  const quotas = API_QUOTAS[apiType === 'mapsJavaScript' ? 'MAPS_JAVASCRIPT' : 'PLACES'];
  const now = Date.now();
  
  // Reset minute counter if window expired
  const oneMinute = 60 * 1000;
  if (now - api.minuteWindow > oneMinute) {
    api.minuteCount = 0;
    api.minuteWindow = now;
  }
  
  // Check minute limit
  if (api.minuteCount >= quotas.requestsPerMinute) {
    console.warn(
      `⚠️ ${apiType} API: Minute limit exceeded (${quotas.requestsPerMinute}/min). ` +
      'Requests will be blocked by Google Cloud quotas.'
    );
    return false;
  }
  
  // Check daily limit
  if (api.count >= quotas.requestsPerDay) {
    console.warn(
      `⚠️ ${apiType} API: Daily limit exceeded (${quotas.requestsPerDay}/day). ` +
      'Requests will be blocked by Google Cloud quotas.'
    );
    return false;
  }
  
  // Increment counters
  api.count++;
  api.minuteCount++;
  
  // Warn at 80% of daily limit
  const warningThreshold = quotas.requestsPerDay * 0.8;
  if (api.count >= warningThreshold && api.count < quotas.requestsPerDay) {
    console.warn(
      `⚠️ ${apiType} API: Approaching daily limit (${api.count}/${quotas.requestsPerDay}). ` +
      'Consider reducing usage.'
    );
  }
  
  saveUsageTracking(tracking);
  return true;
}

/**
 * Get current usage statistics
 */
export function getUsageStats(): {
  mapsJavaScript: {
    count: number;
    limit: number;
    percentage: number;
    remaining: number;
  };
  places: {
    count: number;
    limit: number;
    percentage: number;
    remaining: number;
  };
} {
  const tracking = getUsageTracking();
  
  return {
    mapsJavaScript: {
      count: tracking.mapsJavaScript.count,
      limit: API_QUOTAS.MAPS_JAVASCRIPT.requestsPerDay,
      percentage: Math.round(
        (tracking.mapsJavaScript.count / API_QUOTAS.MAPS_JAVASCRIPT.requestsPerDay) * 100
      ),
      remaining: API_QUOTAS.MAPS_JAVASCRIPT.requestsPerDay - tracking.mapsJavaScript.count,
    },
    places: {
      count: tracking.places.count,
      limit: API_QUOTAS.PLACES.requestsPerDay,
      percentage: Math.round(
        (tracking.places.count / API_QUOTAS.PLACES.requestsPerDay) * 100
      ),
      remaining: API_QUOTAS.PLACES.requestsPerDay - tracking.places.count,
    },
  };
}

/**
 * Reset usage tracking (for testing or manual reset)
 */
export function resetUsageTracking(): void {
  const now = Date.now();
  const tracking: UsageTracking = {
    mapsJavaScript: {
      count: 0,
      lastReset: now,
      minuteCount: 0,
      minuteWindow: now,
    },
    places: {
      count: 0,
      lastReset: now,
      minuteCount: 0,
      minuteWindow: now,
    },
  };
  saveUsageTracking(tracking);
}

/**
 * Check if API usage is safe
 * 
 * @returns true if usage is within safe limits (< 80% of quota)
 */
export function isUsageSafe(): boolean {
  const stats = getUsageStats();
  return stats.mapsJavaScript.percentage < 80 && stats.places.percentage < 80;
}

