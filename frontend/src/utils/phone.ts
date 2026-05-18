/**
 * Phone number formatting utilities
 */

/**
 * Formats a phone number to a readable format
 * Handles various input formats and converts to (XXX) XXX-XXXX or similar
 */
export const formatPhoneNumber = (phone: string | null | undefined): string => {
  if (!phone || typeof phone !== 'string') return '';
  
  const trimmed = phone.trim();
  if (!trimmed) return '';
  
  // If already formatted nicely with parentheses, return as-is
  if (trimmed.includes('(') && trimmed.includes(')')) {
    return trimmed;
  }
  
  // Remove all non-digit characters for processing
  const digitsOnly = trimmed.replace(/\D/g, '');
  
  // Need at least 7 digits to format
  if (digitsOnly.length < 7) {
    return trimmed; // Return original if too short
  }
  
  // Format based on length
  if (digitsOnly.length === 10) {
    // US format: (XXX) XXX-XXXX
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    // US with country code: +1 (XXX) XXX-XXXX
    const withoutCountry = digitsOnly.slice(1);
    if (withoutCountry.length === 10) {
      return `+1 (${withoutCountry.slice(0, 3)}) ${withoutCountry.slice(3, 6)}-${withoutCountry.slice(6)}`;
    }
  } else if (digitsOnly.length === 7) {
    // Local format: XXX-XXXX
    return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3)}`;
  } else if (digitsOnly.length > 10 && digitsOnly.length <= 15) {
    // International format: add spaces for readability
    return digitsOnly.match(/.{1,4}/g)?.join(' ') || trimmed;
  }
  
  // If we can't format it nicely, return original
  return trimmed;
};

/**
 * Formats an address object into a readable string
 */
export const formatAddress = (address: {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
} | null | undefined): string => {
  if (!address || typeof address !== 'object') return '';
  
  const parts: string[] = [];
  
  if (address.street && address.street.trim()) {
    parts.push(address.street.trim());
  }
  
  const cityStateZip: string[] = [];
  if (address.city && address.city.trim()) {
    cityStateZip.push(address.city.trim());
  }
  if (address.state && address.state.trim()) {
    cityStateZip.push(address.state.trim());
  }
  if (address.zip && address.zip.trim()) {
    cityStateZip.push(address.zip.trim());
  }
  
  if (cityStateZip.length > 0) {
    parts.push(cityStateZip.join(', '));
  }
  
  if (address.country && address.country.trim()) {
    parts.push(address.country.trim());
  }
  
  return parts.join('\n') || '';
};

/**
 * Formats an address into a single line for display
 */
export const formatAddressSingleLine = (address: {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
} | null | undefined): string => {
  if (!address || typeof address !== 'object') return '';
  
  const parts: string[] = [];
  
  // Street address
  if (address.street && typeof address.street === 'string' && address.street.trim()) {
    parts.push(address.street.trim());
  }
  
  // City, State, ZIP
  const cityStateZip: string[] = [];
  if (address.city && typeof address.city === 'string' && address.city.trim()) {
    cityStateZip.push(address.city.trim());
  }
  if (address.state && typeof address.state === 'string' && address.state.trim()) {
    cityStateZip.push(address.state.trim());
  }
  if (address.zip && typeof address.zip === 'string' && address.zip.trim()) {
    cityStateZip.push(address.zip.trim());
  }
  
  if (cityStateZip.length > 0) {
    parts.push(cityStateZip.join(', '));
  }
  
  // Country
  if (address.country && typeof address.country === 'string' && address.country.trim()) {
    parts.push(address.country.trim());
  }
  
  return parts.join(', ') || '';
};

