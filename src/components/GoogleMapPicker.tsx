import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GoogleMap, Marker, Circle, Autocomplete, useJsApiLoader } from '@react-google-maps/api';
import { X, MapPin, AlertCircle } from 'lucide-react';
import { getGoogleMapsApiKey, isGoogleMapsApiKeyConfigured, validateGoogleMapsApiKey } from '../utils/googleMapsConfig';

// Google Maps libraries - only Places API needed
// Note: We use Places API geometry data, NOT Geocoding API
const libraries: ('places')[] = ['places'];

// Unique script ID to prevent duplicate loading across multiple instances
// This ensures only one script tag is loaded even if multiple pickers exist
const SCRIPT_ID = 'google-map-script-picker';

interface GoogleMapPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { latitude: number; longitude: number; radius: number }) => void;
  initialCoordinates?: { latitude: number; longitude: number } | null;
  initialRadius?: number;
  /**
   * Google Maps API key (optional - will use VITE_GOOGLE_MAPS_API_KEY from env if not provided)
   * API key should be set via environment variable, never hardcoded
   */
  apiKey?: string;
}

const GoogleMapPicker: React.FC<GoogleMapPickerProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialCoordinates,
  initialRadius = 100,
  apiKey,
}) => {
  // State management with proper initialization
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState<number>(initialRadius);
  const [searchError, setSearchError] = useState('');
  const [isMapReady, setIsMapReady] = useState<boolean>(false);

  // Refs for stable references across renders
  const autocompleteRef = useRef<HTMLInputElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const autocompleteInstanceRef = useRef<google.maps.places.Autocomplete | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Default center (Nashik, India) - memoized to prevent recreation
  const defaultCenter = useMemo(() => ({ lat: 19.9975, lng: 73.7898 }), []);
  
  // Map center calculation - memoized to prevent unnecessary recalculations
  const mapCenter = useMemo(() => {
    return selectedLocation || defaultCenter;
  }, [selectedLocation, defaultCenter]);

  // Get API key from props or environment variable
  // PRODUCTION SAFETY: Validate API key before attempting to load Google Maps
  // Security: API key should NEVER be hardcoded - always use environment variables
  const mapsApiKey = useMemo(() => {
    const key = apiKey || getGoogleMapsApiKey();
    
    // Validate key format in production
    if (import.meta.env.PROD && key && !key.startsWith('AIza')) {
      console.warn('[PRODUCTION] Google Maps API key format appears invalid');
    }
    
    return key;
  }, [apiKey]);

  // PRODUCTION SAFETY: Only load Google Maps if API key is configured
  // This prevents "NoApiKeys" error in production
  const isApiKeyValid = useMemo(() => {
    if (apiKey) {
      return apiKey.trim().length > 0 && apiKey.startsWith('AIza');
    }
    return isGoogleMapsApiKeyConfigured();
  }, [apiKey]);

  // Load Google Maps API dynamically with Places library
  // CRITICAL: Only call useJsApiLoader if API key is valid to prevent "NoApiKeys" error
  // Using unique script ID prevents duplicate script loading across component instances
  // Note: We use Places API geometry data, NOT Geocoding API
  const { isLoaded, loadError } = useJsApiLoader({
    id: SCRIPT_ID, // Unique ID ensures single script instance
    googleMapsApiKey: isApiKeyValid ? mapsApiKey : '', // Only pass key if valid
    libraries, // Includes 'places' for Places Autocomplete
    version: 'weekly', // Use stable weekly version
    // Prevent loading if key is invalid
    ...(isApiKeyValid ? {} : { preventGoogleFontsLoading: true }),
  });

  // Initialize/reset state when modal opens/closes
  // This ensures clean state on each open and proper initialization
  useEffect(() => {
    if (isOpen) {
      // Reset error state
      setSearchError('');
      setIsMapReady(false);
      
      // Initialize location from props or reset
      if (initialCoordinates) {
        setSelectedLocation({ 
          lat: initialCoordinates.latitude, 
          lng: initialCoordinates.longitude 
        });
      } else {
        setSelectedLocation(null);
      }
      
      // Reset radius to initial value
      setRadius(initialRadius);
    } else {
      // Cleanup when modal closes
      setIsMapReady(false);
      setSearchError('');
      // Keep selectedLocation and radius for next open (user might want to confirm later)
    }
  }, [isOpen, initialCoordinates, initialRadius]);

  // Handle map load - called once when GoogleMap component mounts
  // This ensures map is properly initialized and ready for interaction
  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    // Store map instance in ref for reliable access across renders
    mapInstanceRef.current = mapInstance;
    setIsMapReady(true);
    
    // Trigger resize after modal animation completes
    // This ensures map renders correctly in the modal
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    
    resizeTimeoutRef.current = setTimeout(() => {
      if (mapInstanceRef.current) {
        google.maps.event.trigger(mapInstanceRef.current, 'resize');
      }
    }, 300);
  }, []);

  // Handle map click - allows user to select location by clicking on map
  // Validates coordinates before setting to prevent invalid states
  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      
      // Validate coordinates are within valid ranges
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        setSelectedLocation({ lat, lng });
        setSearchError('');
      } else {
        setSearchError('Invalid location selected. Please try again.');
      }
    }
  }, []);

  // Handle marker drag end - updates location when user drags the marker
  // Validates coordinates to ensure data integrity
  const handleMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      
      // Validate coordinates
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        setSelectedLocation({ lat, lng });
        setSearchError('');
      }
    }
  }, []);

  // Handle autocomplete place selection
  // Note: We use Places API geometry.location to get coordinates, NOT Geocoding API
  // This eliminates the need for Google Geocoding API
  const onPlaceChanged = useCallback(() => {
    // Use ref for reliable access to autocomplete instance
    const autocomplete = autocompleteInstanceRef.current;
    if (!autocomplete) {
      return;
    }

    const place = autocomplete.getPlace();
    
    // Validate place has geometry data (required for coordinates)
    if (!place.geometry || !place.geometry.location) {
      setSearchError('Location not found. Please try a different search term.');
      return;
    }

    // Extract coordinates from Places API geometry data
    // This is the correct way - using geometry.location, NOT Geocoding API
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    
    // Validate coordinates
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      setSelectedLocation({ lat, lng });
      setSearchError('');
      
      // Center and zoom map on selected place
      // Use ref for reliable map access
      const mapInstance = mapInstanceRef.current;
      if (mapInstance) {
        mapInstance.setCenter({ lat, lng });
        mapInstance.setZoom(16);
      }
    } else {
      setSearchError('Invalid coordinates received. Please try a different location.');
    }
  }, []);

  // Initialize autocomplete when Autocomplete component loads
  // Sets up event listener and stores instance for reliable access
  const onAutocompleteLoad = useCallback((autocompleteInstance: google.maps.places.Autocomplete) => {
    // Store in ref for reliable access across renders
    autocompleteInstanceRef.current = autocompleteInstance;
    
    // Add place_changed event listener
    // This listener will be cleaned up when component unmounts
    autocompleteInstance.addListener('place_changed', onPlaceChanged);
  }, [onPlaceChanged]);

  // Handle window resize for responsive map rendering
  // Ensures map displays correctly when viewport changes (e.g., mobile rotation)
  useEffect(() => {
    if (!isOpen || !isMapReady) {
      return;
    }

    const handleResize = () => {
      const mapInstance = mapInstanceRef.current;
      if (mapInstance) {
        // Debounce resize to avoid excessive API calls
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }
        
        resizeTimeoutRef.current = setTimeout(() => {
          if (mapInstanceRef.current) {
            google.maps.event.trigger(mapInstanceRef.current, 'resize');
          }
        }, 250);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [isOpen, isMapReady]);

  // Cleanup: Remove event listeners when component unmounts or autocomplete changes
  // This prevents memory leaks and duplicate listeners
  useEffect(() => {
    const instance = autocompleteInstanceRef.current;
    
    return () => {
      if (instance) {
        // Remove all listeners from autocomplete instance
        google.maps.event.clearInstanceListeners(instance);
        autocompleteInstanceRef.current = null;
      }
      
      // Clear resize timeout if component unmounts
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  // Handle confirm - validates location before confirming
  const handleConfirm = useCallback(() => {
    if (!selectedLocation) {
      setSearchError('Please select a location before confirming.');
      return;
    }

    // Final validation before confirming
    const { lat, lng } = selectedLocation;
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && radius > 0) {
      onConfirm({
        latitude: lat,
        longitude: lng,
        radius: radius,
      });
      onClose();
    } else {
      setSearchError('Invalid location or radius. Please check your selection.');
    }
  }, [selectedLocation, radius, onConfirm, onClose]);

  // Handle radius change with validation
  const handleRadiusChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newRadius = parseInt(e.target.value, 10);
    // Validate radius is a positive number within reasonable bounds
    if (!isNaN(newRadius) && newRadius > 0 && newRadius <= 10000) {
      setRadius(newRadius);
      setSearchError(''); // Clear any previous errors
    } else if (e.target.value === '') {
      // Allow empty input for user to type
      setRadius(0);
    }
  }, []);

  if (!isOpen) return null;

  // PRODUCTION SAFETY: Check for missing API key before attempting to load
  // This prevents "NoApiKeys" error and shows user-friendly message
  if (!isApiKeyValid) {
    const validation = validateGoogleMapsApiKey();
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-4xl p-6">
          <div className="text-center space-y-4">
            <AlertCircle className="w-16 h-16 text-red-600 dark:text-red-400 mx-auto" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Google Maps API Key Missing
            </h3>
            <div className="text-left bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Google Maps cannot load because the API key is not configured.
              </p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                For Render Deployment:
              </p>
              <ol className="text-sm text-gray-600 dark:text-gray-400 list-decimal list-inside space-y-1 ml-2">
                <li>Go to your Render dashboard</li>
                <li>Select your service</li>
                <li>Navigate to Environment tab</li>
                <li>Add: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">VITE_GOOGLE_MAPS_API_KEY</code></li>
                <li>Set value to your Google Maps API key</li>
                <li>Redeploy the service</li>
              </ol>
              {import.meta.env.PROD && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    Diagnostic: {validation.diagnostic.hasValue ? 'Key exists' : 'Key missing'} | 
                    Length: {validation.diagnostic.length} | 
                    Format: {validation.diagnostic.startsWithAIza ? 'Valid' : 'Invalid'}
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-[#d63a25] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Handle Google Maps API load errors (e.g., invalid key, network issues)
  if (loadError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-4xl p-6">
          <div className="text-center space-y-4">
            <AlertCircle className="w-16 h-16 text-red-600 dark:text-red-400 mx-auto" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Failed to Load Google Maps
            </h3>
            <p className="text-red-600 dark:text-red-400">
              {loadError.message || 'Unable to load Google Maps. Please check your API key configuration and network connection.'}
            </p>
            {import.meta.env.PROD && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                If this persists, verify that VITE_GOOGLE_MAPS_API_KEY is set correctly in your deployment environment.
              </p>
            )}
            <button
              onClick={onClose}
              className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-[#d63a25] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state while Google Maps API is loading
  if (!isLoaded) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-4xl p-6">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading Google Maps...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold dark:text-white">Select Location on Map</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search Bar with Places Autocomplete */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Autocomplete
              onLoad={onAutocompleteLoad}
              onPlaceChanged={onPlaceChanged}
              options={{
                componentRestrictions: { country: 'in' }, // Restrict to India
                // Request geometry field to get coordinates from Places API (not Geocoding API)
                fields: ['geometry', 'name', 'formatted_address'],
              }}
            >
              <input
                ref={autocompleteRef}
                type="text"
                placeholder="Search for a location (e.g., 'Nashik', 'College Road Nashik', 'AI Ally Nashik')"
                className="w-full pl-4 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </Autocomplete>
          </div>
          {searchError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-base">error</span>
              {searchError}
            </p>
          )}
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            💡 Tip: Search for a place or click on the map to select a location. You can drag the marker to adjust.
          </p>
        </div>

        {/* Map Container */}
        {/* Responsive height: 450px on desktop, 300px on mobile */}
        <div className="flex-1 relative" style={{ height: '450px', minHeight: '300px' }}>
          {isLoaded && isMapReady ? (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={mapCenter}
              zoom={selectedLocation ? 16 : 12}
              onClick={handleMapClick}
              onLoad={onMapLoad}
              options={{
                disableDefaultUI: false,
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: true,
                // Mobile-friendly options
                gestureHandling: 'greedy', // Better touch handling
                clickableIcons: false, // Prevent accidental clicks on POIs
                // Performance optimizations
                maxZoom: 20,
                minZoom: 3,
              }}
            >
            {/* Draggable Marker */}
            {selectedLocation && (
              <>
                <Marker
                  position={selectedLocation}
                  draggable={true}
                  onDragEnd={handleMarkerDragEnd}
                  title="Drag to adjust location"
                />
                {/* Radius Circle */}
                <Circle
                  center={selectedLocation}
                  radius={radius}
                  options={{
                    strokeColor: '#f04129',
                    strokeOpacity: 1,
                    strokeWeight: 2,
                    fillColor: '#f04129',
                    fillOpacity: 0.2,
                  }}
                />
              </>
            )}
            </GoogleMap>
          ) : (
            // Show loading state while map initializes
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
              <div className="text-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Initializing map...</p>
              </div>
            </div>
          )}
        </div>

        {/* Coordinates Preview and Radius Input */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          {selectedLocation ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Selected Location
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-mono break-all">
                    Lat: <span className="font-semibold">{selectedLocation.lat.toFixed(6)}</span>
                    {' | '}
                    Lng: <span className="font-semibold">{selectedLocation.lng.toFixed(6)}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 flex-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    Radius (meters):
                  </span>
                  <input
                    type="number"
                    value={radius}
                    onChange={handleRadiusChange}
                    min="1"
                    max="10000"
                    className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Attendance allowed within this distance
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <MapPin className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">Click on the map or search for a location to select coordinates</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-4 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 dark:border-gray-700 rounded-lg font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedLocation}
            className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-[#d63a25] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoogleMapPicker;

