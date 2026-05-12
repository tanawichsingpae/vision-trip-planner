/**
 * A safe wrapper for fetch that handles non-JSON responses and provides better error logging.
 */
export async function safeFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`API request failed [${response.status}] for URL: ${url}`, errorText);
    throw new Error(`API request failed with status ${response.status}`);
  }

  const text = await response.text();
  
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    console.error(`API returned invalid JSON for URL: ${url}`, text.substring(0, 1000));
    throw new Error("Invalid API response format");
  }
}

/**
 * Validates that an API key is present, otherwise throws 
 */
export function validateApiKey(key?: string, providerName?: string) {
  // Only validate Google Maps key
  if (providerName === "Google Maps" && (!key || key.trim() === "")) {
    throw new Error("Google Maps API key is missing or empty.");
  }
}
