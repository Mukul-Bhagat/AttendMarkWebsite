# Google Maps Integration Guide

## Overview

This project integrates Google Maps JavaScript API and Places API with OpenStreetMap Nominatim for reverse geocoding. The implementation follows security best practices and uses environment variables for API keys.

## Architecture

### APIs Used

1. **Google Maps JavaScript API** - For displaying maps
2. **Google Places API** - For autocomplete and geometry data
3. **OpenStreetMap Nominatim** - For reverse geocoding (fallback)

### APIs NOT Used

- ❌ **Google Geocoding API** - We use Places API geometry data instead

## Environment Variables

### Setup

1. Create `.env` file in the `client` directory:
   ```bash
   cd client
   touch .env
   ```

2. Add your Google Maps API key:
   ```env
   VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

3. Ensure `.env` is in `.gitignore` (already configured)

### Accessing the API Key

The API key is accessed using:
```typescript
import.meta.env.VITE_GOOGLE_MAPS_API_KEY
```

Or use the utility function:
```typescript
import { getGoogleMapsApiKey } from './utils/googleMapsConfig';
const apiKey = getGoogleMapsApiKey();
```

## Components

### 1. PlacesAutocomplete

**Location:** `src/components/PlacesAutocomplete.tsx`

**Features:**
- Google Places Autocomplete integration
- Extracts coordinates from `place.geometry.location` (NOT Geocoding API)
- Uses environment variable for API key
- Requests only required fields: `['place_id', 'name', 'formatted_address', 'geometry']`

**Usage:**
```tsx
import PlacesAutocomplete from './components/PlacesAutocomplete';

<PlacesAutocomplete
  placeholder="Search location..."
  onPlaceSelect={(placeData) => {
    console.log('Coordinates:', placeData.coordinates);
    console.log('Address:', placeData.formattedAddress);
  }}
/>
```

### 2. GoogleMapPicker

**Location:** `src/components/GoogleMapPicker.tsx`

**Features:**
- Interactive map with marker
- Places Autocomplete search
- Uses Places API geometry for coordinates
- API key from environment variable

**Usage:**
```tsx
import GoogleMapPicker from './components/GoogleMapPicker';

<GoogleMapPicker
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onConfirm={(data) => {
    console.log('Location:', data.latitude, data.longitude);
  }}
  // apiKey is optional - uses VITE_GOOGLE_MAPS_API_KEY from env
/>
```

### 3. LocationPickerWithReverseGeocode

**Location:** `src/components/LocationPickerWithReverseGeocode.tsx`

**Features:**
- Complete integration example
- Places Autocomplete → Coordinates → Reverse Geocoding
- Uses OpenStreetMap Nominatim for reverse geocoding
- Displays formatted address

**Usage:**
```tsx
import LocationPickerWithReverseGeocode from './components/LocationPickerWithReverseGeocode';

<LocationPickerWithReverseGeocode
  onLocationSelect={(data) => {
    console.log('Coordinates:', data.coordinates);
    console.log('Address:', data.address);
  }}
/>
```

## Utilities

### 1. reverseGeocode

**Location:** `src/utils/reverseGeocode.ts`

**Purpose:** Convert coordinates to readable addresses using OpenStreetMap Nominatim

**Features:**
- Rate limiting (1 request/second)
- Error handling
- Uses fetch API (no dependencies)

**Usage:**
```typescript
import { reverseGeocode } from './utils/reverseGeocode';

const result = await reverseGeocode(19.9975, 73.7898);
console.log(result.address); // "College Road, Nashik, Maharashtra, 422005, India"
```

### 2. useReverseGeocode Hook

**Location:** `src/hooks/useReverseGeocode.ts`

**Purpose:** React hook for reverse geocoding

**Usage:**
```tsx
import { useReverseGeocode } from './hooks/useReverseGeocode';

const { geocode, result, isLoading, error } = useReverseGeocode();

await geocode(19.9975, 73.7898);
if (result) {
  console.log(result.address);
}
```

### 3. googleMapsConfig

**Location:** `src/utils/googleMapsConfig.ts`

**Purpose:** Centralized Google Maps configuration

**Features:**
- API key management
- Configuration constants
- Type safety

## Data Flow

### Place Selection Flow

1. **User searches** → Places Autocomplete
2. **User selects place** → `place.geometry.location` provides coordinates
3. **Coordinates extracted** → `place.geometry.location.lat()` and `.lng()`
4. **Reverse geocoding** → OpenStreetMap Nominatim converts coordinates to address
5. **Display** → Formatted address shown in UI

### Why Places API Geometry?

- ✅ **No additional API call** - Geometry comes with place selection
- ✅ **Cost savings** - No Geocoding API needed
- ✅ **Better performance** - Single API call instead of two
- ✅ **More accurate** - Direct from Places API

## Security Best Practices

### ✅ DO:

- ✅ Use environment variables for API keys
- ✅ Never commit `.env` files
- ✅ Restrict API keys in Google Cloud Console
- ✅ Use HTTP referrer restrictions
- ✅ Set budget limits

### ❌ DON'T:

- ❌ Hardcode API keys in source files
- ❌ Commit API keys to version control
- ❌ Use unrestricted API keys
- ❌ Share API keys publicly

## Google Cloud Console Setup

### Required APIs

1. **Maps JavaScript API** - Enable
2. **Places API** - Enable
3. **Geocoding API** - ❌ NOT needed

### API Key Restrictions

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Edit your API key
3. Under "API restrictions":
   - Select "Restrict key"
   - Enable only: Maps JavaScript API, Places API
   - ❌ Do NOT enable Geocoding API

4. Under "Application restrictions":
   - Select "HTTP referrers (web sites)"
   - Add your domains:
     - `http://localhost:*` (development)
     - `https://yourdomain.com/*` (production)

## Testing

### Test Place Selection

1. Use Places Autocomplete to search for a location
2. Select a place
3. Verify coordinates are extracted
4. Verify reverse geocoding returns address

### Test Error Handling

1. Test with invalid API key
2. Test with network errors
3. Test rate limiting (make multiple rapid requests)

## Troubleshooting

### API Key Not Working

- Check `.env` file exists and has correct key
- Verify API key in Google Cloud Console
- Check browser console for errors
- Verify HTTP referrer restrictions match your domain

### Places Autocomplete Not Loading

- Verify Maps JavaScript API is enabled
- Verify Places API is enabled
- Check API key restrictions
- Check network tab for API errors

### Reverse Geocoding Failing

- Check internet connection
- Verify rate limiting (1 request/second)
- Check browser console for errors
- Verify User-Agent header is set

## Cost Optimization

### Current Setup

- **Maps JavaScript API**: ~$7 per 1,000 map loads
- **Places API**: ~$17 per 1,000 requests
- **OpenStreetMap Nominatim**: Free (with rate limits)

### Savings

- ❌ **No Geocoding API**: Saves ~$5 per 1,000 requests
- ✅ **Places API geometry**: Included in Places API call
- ✅ **OpenStreetMap**: Free reverse geocoding

## Example: Complete Integration

```tsx
import React, { useState } from 'react';
import LocationPickerWithReverseGeocode from './components/LocationPickerWithReverseGeocode';

function MyComponent() {
  const [location, setLocation] = useState(null);

  return (
    <LocationPickerWithReverseGeocode
      onLocationSelect={(data) => {
        setLocation(data);
        console.log('Selected:', data);
      }}
      showDetails={true}
    />
  );
}
```

## Files Structure

```
client/
├── .env                    # API key (gitignored)
├── .env.example            # Example env file
├── src/
│   ├── components/
│   │   ├── PlacesAutocomplete.tsx
│   │   ├── GoogleMapPicker.tsx
│   │   └── LocationPickerWithReverseGeocode.tsx
│   ├── hooks/
│   │   └── useReverseGeocode.ts
│   └── utils/
│       ├── googleMapsConfig.ts
│       └── reverseGeocode.ts
```

## Next Steps

1. ✅ Set up `.env` file with API key
2. ✅ Test Places Autocomplete
3. ✅ Test reverse geocoding
4. ✅ Integrate into your application
5. ✅ Configure API key restrictions in Google Cloud Console

---

**Last Updated**: 2024  
**Status**: ✅ Production Ready

