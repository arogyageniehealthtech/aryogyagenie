/**
 * Singleton Google Maps JavaScript API Loader
 */

let loadPromise: Promise<typeof google.maps> | null = null;

export function getGoogleMapsApiKey(): string {
  return (
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    (typeof window !== "undefined" ? (window as any).__GOOGLE_MAPS_API_KEY__ : "") ||
    ""
  );
}

export function loadGoogleMaps(apiKey?: string): Promise<typeof google.maps> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps cannot be loaded on the server"));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (loadPromise) {
    return loadPromise;
  }

  const key = apiKey || getGoogleMapsApiKey();

  loadPromise = new Promise((resolve, reject) => {
    if (!key) {
      reject(
        new Error(
          "VITE_GOOGLE_MAPS_API_KEY is not set. Please provide a Google Maps API Key.",
        ),
      );
      return;
    }

    const callbackName = `__googleMapsCallback_${Date.now()}`;
    (window as any)[callbackName] = () => {
      delete (window as any)[callbackName];
      if (window.google?.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error("Google Maps API loaded but google.maps is not available"));
      }
    };

    const script = document.createElement("script");
    script.id = "google-maps-js-sdk";
    script.type = "text/javascript";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key,
    )}&libraries=places,geometry,marker&loading=async&callback=${callbackName}`;

    script.onerror = () => {
      delete (window as any)[callbackName];
      loadPromise = null;
      reject(new Error("Failed to load Google Maps JavaScript SDK script"));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}
