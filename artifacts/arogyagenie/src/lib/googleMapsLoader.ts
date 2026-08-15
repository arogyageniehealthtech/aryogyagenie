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
 * Uses standard callback initialization to guarantee full SDK readiness.
 */
export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window !== "undefined" && (window as any).google?.maps?.Map) {
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

    if ((window as any).google?.maps?.Map) {
      resolve((window as any).google.maps);
      return;
    }

    const callbackName = `__googleMapsInitCallback_${Math.random().toString(36).substring(2, 9)}`;

    (window as any)[callbackName] = () => {
      delete (window as any)[callbackName];
      if ((window as any).google?.maps?.Map) {
        resolve((window as any).google.maps);
      } else {
        reject(new Error("Google Maps loaded but google.maps.Map is not available."));
      }
    };

    // Check if script tag already exists
    const existingScript = document.getElementById("google-maps-js-sdk") as HTMLScriptElement | null;
    if (existingScript) {
      if ((window as any).google?.maps?.Map) {
        resolve((window as any).google.maps);
        return;
      }
    }

    const script = document.createElement("script");
    script.id = "google-maps-js-sdk";
    script.type = "text/javascript";
    script.async = true;
    script.defer = true;

    const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : "";
    script.src = `https://maps.googleapis.com/maps/api/js?v=weekly${keyParam}&callback=${callbackName}`;

    script.onerror = () => {
      delete (window as any)[callbackName];
      loadPromise = null;
      reject(
        new Error(
          "Failed to load Google Maps JavaScript API. Please verify your VITE_GOOGLE_MAPS_API_KEY and network connection.",
        ),
      );
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}
