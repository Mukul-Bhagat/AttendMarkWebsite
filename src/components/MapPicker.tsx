import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Search, MapPin } from 'lucide-react';

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (coordinates: { latitude: number; longitude: number }) => void;
  initialCoordinates?: { latitude: number; longitude: number } | null;
  radius?: number;
}

// Component to handle map clicks
const MapClickHandler: React.FC<{
  onMapClick: (lat: number, lng: number) => void;
}> = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      onMapClick(lat, lng);
    },
  });
  return null;
};

// Component to force map resize after modal opens
const MapResizeHandler: React.FC = () => {
  const map = useMap();
  
  useEffect(() => {
    // Force resize after modal animation completes
    const timer = setTimeout(() => {
      map.invalidateSize(true);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [map]);
  
  return null;
};

// Component to handle map centering
const MapCenter: React.FC<{ 
  center: [number, number];
  onMapReady: (map: L.Map) => void;
}> = ({ center, onMapReady }) => {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, map.getZoom() > 15 ? map.getZoom() : 15);
    onMapReady(map);
  }, [map, center, onMapReady]);
  
  return null;
};

const MapPicker: React.FC<MapPickerProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialCoordinates,
  radius = 100,
}) => {
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ latitude: number; longitude: number } | null>(
    initialCoordinates || null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  const defaultCenter: [number, number] = initialCoordinates
    ? [initialCoordinates.latitude, initialCoordinates.longitude]
    : [19.9975, 73.7898];

  useEffect(() => {
    if (isOpen) {
      if (initialCoordinates) {
        setSelectedCoordinates(initialCoordinates);
      } else {
        setSelectedCoordinates(null);
      }
      setSearchQuery('');
      setSearchError('');
    } else {
      // Cleanup on close
      setMapInstance(null);
    }
  }, [isOpen, initialCoordinates]);

  const handleMapClick = (lat: number, lng: number) => {
    setSelectedCoordinates({ latitude: lat, longitude: lng });
    setSearchError('');
  };

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchError('Please enter a location to search');
      return;
    }

    setIsSearching(true);
    setSearchError('');

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=in`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'AttendanceMark-App/1.0',
          'Accept-Language': 'en',
        },
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);

        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          setSelectedCoordinates({ latitude: lat, longitude: lng });
          
          if (mapInstance) {
            mapInstance.setView([lat, lng], 16);
            setTimeout(() => {
              mapInstance.invalidateSize(true);
            }, 100);
          }
          
          setSearchError('');
          setSearchQuery('');
        } else {
          setSearchError('Invalid coordinates returned from search. Please try again.');
        }
      } else {
        setSearchError('Location not found. Please try a different search term.');
      }
    } catch (err: any) {
      console.error('Location search error:', err);
      setSearchError('Failed to search location. Please check your internet connection and try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirm = () => {
    if (selectedCoordinates) {
      onConfirm(selectedCoordinates);
      onClose();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSearching) {
      e.preventDefault();
      handleSearch();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
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

        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchError('');
                }}
                onKeyPress={handleKeyPress}
                placeholder="Search for a location (e.g., 'Nashik', 'College Road Nashik', 'AI Ally Nashik')"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isSearching}
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-[#d63a25] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
          {searchError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-base">error</span>
              {searchError}
            </p>
          )}
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            💡 Tip: Search or click on the map to select a location
          </p>
        </div>

        <div className="map-wrapper flex-1 relative">
          {isOpen && (
            <MapContainer
              key={isOpen ? 'map-open' : 'map-closed'}
              center={selectedCoordinates ? [selectedCoordinates.latitude, selectedCoordinates.longitude] : defaultCenter}
              zoom={selectedCoordinates ? 16 : 12}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {selectedCoordinates && (
                <>
                  <Marker 
                    position={[selectedCoordinates.latitude, selectedCoordinates.longitude]}
                    icon={L.icon({
                      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
                      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                      iconSize: [25, 41],
                      iconAnchor: [12, 41],
                      popupAnchor: [1, -34],
                      shadowSize: [41, 41],
                    })}
                  />
                  <Circle
                    center={[selectedCoordinates.latitude, selectedCoordinates.longitude]}
                    radius={radius}
                    pathOptions={{
                      color: '#f04129',
                      fillColor: '#f04129',
                      fillOpacity: 0.2,
                      weight: 2,
                    }}
                  />
                </>
              )}
              
              <MapClickHandler onMapClick={handleMapClick} />
              <MapResizeHandler />
              <MapCenter 
                center={selectedCoordinates ? [selectedCoordinates.latitude, selectedCoordinates.longitude] : defaultCenter}
                onMapReady={setMapInstance}
              />
            </MapContainer>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          {selectedCoordinates ? (
            <div className="flex items-center gap-4">
              <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Selected Location
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-mono break-all">
                  Lat: <span className="font-semibold">{selectedCoordinates.latitude.toFixed(6)}</span>
                  {' | '}
                  Lng: <span className="font-semibold">{selectedCoordinates.longitude.toFixed(6)}</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Radius: {radius}m (attendance allowed within this distance)
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

        <div className="flex justify-end gap-4 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 dark:border-gray-700 rounded-lg font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedCoordinates}
            className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-[#d63a25] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapPicker;
