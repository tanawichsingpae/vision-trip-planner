/**
 * A safe wrapper for fetch that handles non-JSON responses and provides better error logging.
 */
export async function safeFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`API request failed [${response.status}] for URL: ${url}`, errorText);
    let errorMessage = `API request failed with status ${response.status}`;
    try {
      const parsedError = JSON.parse(errorText);
      if (parsedError && parsedError.error) {
        errorMessage = typeof parsedError.error === "string" ? parsedError.error : JSON.stringify(parsedError.error);
      }
    } catch {
      if (errorText) {
        errorMessage += `: ${errorText.substring(0, 150)}`;
      }
    }
    throw new Error(errorMessage);
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
  if (providerName === "Geoapify" && (!key || key.trim() === "")) {
    console.warn("Geoapify API key is missing or empty. Geocoding will use OpenStreetMap fallback.");
  }
}
