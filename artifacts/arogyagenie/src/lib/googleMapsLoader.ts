let loadPromise: Promise<typeof google.maps> | null = null;

export function getGoogleMapsApiKey(): string {
  const envKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
  if (envKey && typeof envKey === "string" && envKey.trim().length > 0) {
    return envKey.trim();
  }
  return "";
}

/**
 * Singleton loader for Google Maps JavaScript API.
 * Ensures the Google Maps script is injected only once into the document.
 */
export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window !== "undefined" && (window as any).google?.maps) {
    return Promise.resolve((window as any).google.maps);
  }

  if (loadPromise) {
    return loadPromise;
  }

  const apiKey = getGoogleMapsApiKey();

  loadPromise = new Promise<typeof google.maps>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Google Maps can only be loaded in a browser environment."));
      return;
    }

    // Check if script tag already exists
    const existingScript = document.getElementById("google-maps-js-sdk") as HTMLScriptElement | null;
    if (existingScript) {
      if ((window as any).google?.maps) {
        resolve((window as any).google.maps);
        return;
      }
      existingScript.addEventListener("load", () => {
        if ((window as any).google?.maps) {
          resolve((window as any).google.maps);
        } else {
          reject(new Error("Google Maps SDK loaded but google.maps is undefined."));
        }
      });
      existingScript.addEventListener("error", (e) => {
        loadPromise = null;
        reject(new Error("Failed to load Google Maps script."));
      });
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-js-sdk";
    script.type = "text/javascript";
    script.async = true;
    script.defer = true;

    const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : "";
    script.src = `https://maps.googleapis.com/maps/api/js?v=weekly${keyParam}&loading=async`;

    script.onload = () => {
      if ((window as any).google?.maps) {
        resolve((window as any).google.maps);
      } else {
        reject(new Error("Google Maps API script loaded but google.maps is not defined."));
      }
    };

    script.onerror = (err) => {
      loadPromise = null;
      reject(new Error("Failed to load Google Maps JavaScript API. Please verify network connectivity and API key."));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}
