/**
 * Example usage of reverse geocoding utility
 * 
 * This file demonstrates how to use the reverseGeocode function
 * to convert coordinates to readable addresses.
 * 
 * Note: These are example functions for documentation purposes.
 */

import { reverseGeocode, batchReverseGeocode } from './reverseGeocode';

// Example functions - these are for documentation only
// @ts-expect-error - Example function for documentation, intentionally unused
async function example1() {
  try {
    const result = await reverseGeocode(19.9975, 73.7898); // Nashik, India
    
    console.log('Address:', result.address);
    // Output: "College Road, Nashik, Maharashtra, 422005, India"
    
    console.log('Display Name:', result.displayName);
    // Output: Full formatted address from Nominatim
    
    console.log('Components:', result.components);
    // Output: {
    //   road: "College Road",
    //   city: "Nashik",
    //   state: "Maharashtra",
    //   postcode: "422005",
    //   country: "India",
    //   countryCode: "IN"
    // }
  } catch (error) {
    console.error('Error:', error);
  }
}

// @ts-expect-error - Example function for documentation, intentionally unused
async function example2() {
  try {
    const result = await reverseGeocode(19.9975, 73.7898, {
      language: 'en',
      includeRaw: true, // Include full Nominatim response
      userAgent: 'MyApp/1.0',
    });
    
    console.log('Address:', result.address);
    console.log('Raw Response:', result.raw); // Full Nominatim response
  } catch (error) {
    console.error('Error:', error);
  }
}

// @ts-expect-error - Example function for documentation, intentionally unused
async function example3() {
  try {
    const coordinates = [
      { latitude: 19.9975, longitude: 73.7898 }, // Nashik
      { latitude: 18.5204, longitude: 73.8567 }, // Pune
      { latitude: 19.0760, longitude: 72.8777 }, // Mumbai
    ];
    
    const results = await batchReverseGeocode(coordinates);
    
    results.forEach((result, index) => {
      if (result instanceof Error) {
        console.error(`Error for coordinate ${index}:`, result.message);
      } else {
        console.log(`Address ${index}:`, result.address);
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

// @ts-expect-error - Example function for documentation, intentionally unused
async function example4() {
  try {
    // Invalid coordinates
    await reverseGeocode(999, 999);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Validation error:', error.message);
      // Output: "Latitude must be between -90 and 90"
    }
  }
  
  try {
    // Network error handling
    const result = await reverseGeocode(19.9975, 73.7898);
    console.log('Success:', result.address);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Network error')) {
        console.error('No internet connection');
      } else if (error.message.includes('rate limit')) {
        console.error('Rate limit exceeded, please wait');
      } else {
        console.error('Other error:', error.message);
      }
    }
  }
}

// Example 5: React component usage
export function ExampleComponent() {
  // See useReverseGeocode hook for React usage examples
  // import { useReverseGeocode } from '../hooks/useReverseGeocode';
  
  return null;
}

// Run examples (uncomment to test)
// example1();
// example2();
// example3();
// example4();

