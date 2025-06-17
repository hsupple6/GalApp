/**
 * Helper utility for working with MongoDB ObjectIds in different formats
 */

/**
 * Extracts a string ID from various MongoDB ObjectId formats
 * 
 * @param value - The value containing an ID (can be string, object with $oid, object with id/._id properties)
 * @param source - Optional source identifier for debugging
 * @returns A string representation of the ID
 */
export function extractId(value: any, source: string = 'unknown'): string {
  // Enhanced debug logging
  console.log(`extractId called from ${source} with:`, value);
  
  // For null or undefined, return empty string
  if (value === null || value === undefined) {
    return '';
  }
  
  // Case 1: Direct MongoDB ObjectId format: {$oid: "..."}
  if (typeof value === 'object' && value !== null) {
    // Access $oid property
    if (value.$oid) {
      console.log(`Direct MongoDB ObjectId found: ${value.$oid}`);
      return value.$oid;
    }
    
    // Access id property
    if ('id' in value && value.id) {
      // Check if id is also a MongoDB ObjectId
      if (typeof value.id === 'object' && value.id !== null && value.id.$oid) {
        return value.id.$oid;
      }
      return String(value.id);
    }
    
    // Access _id property
    if ('_id' in value && value._id) {
      // Check if _id is also a MongoDB ObjectId
      if (typeof value._id === 'object' && value._id !== null && value._id.$oid) {
        return value._id.$oid;
      }
      return String(value._id);
    }
  }
  
  // Case 2: String that might be a stringified object
  if (typeof value === 'string') {
    // Already a valid MongoDB ObjectId as string (24 hex chars)
    if (/^[0-9a-f]{24}$/i.test(value)) {
      return value;
    }
    
    // Try parsing as JSON in case it's a stringified object
    if (value.includes('{') && value.includes('}')) {
      try {
        const parsed = JSON.parse(value);
        // If it's a MongoDB ObjectId format, extract the $oid
        if (parsed && typeof parsed === 'object' && parsed.$oid) {
          return parsed.$oid;
        }
      } catch (e) {
        // Not valid JSON, just use as is
      }
    }
    return value;
  }
  
  // Case 3: Default to string conversion
  return String(value);
} 