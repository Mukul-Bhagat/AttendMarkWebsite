/**
 * Example usage of PlacesAutocomplete component
 * 
 * This file demonstrates how to use the PlacesAutocomplete component
 * with state management and logging.
 */

import React, { useState } from 'react';
import PlacesAutocomplete, { PlaceData, PlaceCoordinates } from './PlacesAutocomplete';

const PlacesAutocompleteExample: React.FC = () => {
  // State to store coordinates
  const [coordinates, setCoordinates] = useState<PlaceCoordinates | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceData | null>(null);

  // Handle place selection
  const handlePlaceSelect = (placeData: PlaceData) => {
    // Store place data in state
    setSelectedPlace(placeData);
    setCoordinates(placeData.coordinates);

    // Log place information
    console.log('📍 Place Selected:', {
      name: placeData.name,
      formattedAddress: placeData.formattedAddress,
      latitude: placeData.coordinates.latitude,
      longitude: placeData.coordinates.longitude,
      placeId: placeData.placeId,
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Google Places Autocomplete Example
      </h1>

      {/* Basic Usage */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Location Search
        </label>
        <PlacesAutocomplete
          placeholder="Search for a location..."
          onPlaceSelect={handlePlaceSelect}
          showCoordinates={true}
          enableLogging={true}
          countryRestrictions={['in']} // Restrict to India (optional)
        />
      </div>

      {/* Display Selected Place Information */}
      {selectedPlace && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Selected Location
          </h2>
          <div className="space-y-1 text-sm">
            <p>
              <span className="font-medium">Name:</span>{' '}
              <span className="text-blue-700 dark:text-blue-300">{selectedPlace.name}</span>
            </p>
            <p>
              <span className="font-medium">Address:</span>{' '}
              <span className="text-blue-700 dark:text-blue-300">
                {selectedPlace.formattedAddress}
              </span>
            </p>
            <p>
              <span className="font-medium">Place ID:</span>{' '}
              <span className="text-blue-700 dark:text-blue-300 font-mono text-xs">
                {selectedPlace.placeId}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Display Coordinates */}
      {coordinates && (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <h2 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
            Coordinates (Stored in State)
          </h2>
          <div className="space-y-1 text-sm font-mono">
            <p>
              <span className="font-medium text-gray-700 dark:text-gray-300">Latitude:</span>{' '}
              <span className="text-green-700 dark:text-green-300">
                {coordinates.latitude.toFixed(6)}
              </span>
            </p>
            <p>
              <span className="font-medium text-gray-700 dark:text-gray-300">Longitude:</span>{' '}
              <span className="text-green-700 dark:text-green-300">
                {coordinates.longitude.toFixed(6)}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Usage Instructions */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          How it works:
        </h3>
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
          <li>Type a location in the search field</li>
          <li>Select a place from the autocomplete suggestions</li>
          <li>Coordinates are automatically extracted and stored in state</li>
          <li>Place name, address, and coordinates are logged to console</li>
          <li>All data is available via the onPlaceSelect callback</li>
        </ul>
      </div>
    </div>
  );
};

export default PlacesAutocompleteExample;

