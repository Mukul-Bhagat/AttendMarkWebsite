/**
 * Example React component demonstrating reverse geocoding usage
 * 
 * This component shows how to use the useReverseGeocode hook
 * to convert coordinates to readable addresses.
 */

import React, { useState } from 'react';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import { MapPin, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const ReverseGeocodeExample: React.FC = () => {
  const [latitude, setLatitude] = useState<string>('19.9975');
  const [longitude, setLongitude] = useState<string>('73.7898');
  
  const { geocode, result, isLoading, error, reset } = useReverseGeocode({
    language: 'en',
    includeRaw: false,
  });

  const handleGeocode = async () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      alert('Please enter valid coordinates');
      return;
    }

    await geocode(lat, lng);
  };

  const handleReset = () => {
    reset();
    setLatitude('19.9975');
    setLongitude('73.7898');
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Reverse Geocoding Example
      </h1>

      {/* Input Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Latitude
          </label>
          <input
            type="number"
            step="any"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            placeholder="e.g., 19.9975"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Longitude
          </label>
          <input
            type="number"
            step="any"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            placeholder="e.g., 73.7898"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleGeocode}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-[#d63a25] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Geocoding...</span>
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4" />
                <span>Get Address</span>
              </>
            )}
          </button>

          {(result || error) && (
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <Loader2 className="w-5 h-5 animate-spin" />
            <p className="text-sm font-medium">
              Fetching address from OpenStreetMap Nominatim...
            </p>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
            Rate limit: 1 request per second
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                Error
              </p>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success State */}
      {result && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">
                Address Found
              </p>
              
              {/* Formatted Address */}
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Formatted Address
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {result.address}
                  </p>
                </div>

                {/* Display Name */}
                {result.displayName !== result.address && (
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Display Name
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {result.displayName}
                    </p>
                  </div>
                )}

                {/* Address Components */}
                <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-700">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Address Components
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {result.components.houseNumber && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">House:</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {result.components.houseNumber}
                        </span>
                      </div>
                    )}
                    {result.components.road && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Road:</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {result.components.road}
                        </span>
                      </div>
                    )}
                    {result.components.suburb && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Suburb:</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {result.components.suburb}
                        </span>
                      </div>
                    )}
                    {result.components.city && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">City:</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {result.components.city}
                        </span>
                      </div>
                    )}
                    {result.components.state && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">State:</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {result.components.state}
                        </span>
                      </div>
                    )}
                    {result.components.postcode && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Postcode:</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {result.components.postcode}
                        </span>
                      </div>
                    )}
                    {result.components.country && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Country:</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {result.components.country}
                        </span>
                      </div>
                    )}
                    {result.components.countryCode && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Country Code:</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {result.components.countryCode}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <strong>Note:</strong> This uses OpenStreetMap Nominatim API with a rate limit of 1 request per second.
          For production use, consider hosting your own Nominatim instance.
        </p>
      </div>
    </div>
  );
};

export default ReverseGeocodeExample;

