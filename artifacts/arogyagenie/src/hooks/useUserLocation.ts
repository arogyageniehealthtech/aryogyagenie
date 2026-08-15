import { useState, useCallback, useRef, useEffect, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface UserLocation {
  lat: number;
  lng: number;
}

export interface SavedLocation extends UserLocation {
  name: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "arogyagenie_user_location";

const DEFAULT_LOCATION: SavedLocation = {
  lat: 22.5726,
  lng: 88.3639,
  name: "Park Street, Kolkata",
};

export const QUICK_CITIES = [
  { name: "Kolkata (Park St)", lat: 22.5532, lng: 88.3512 },
  { name: "Salt Lake, Kolkata", lat: 22.5834, lng: 88.4123 },
  { name: "Howrah, Kolkata", lat: 22.5958, lng: 88.2636 },
  { name: "Durgapur", lat: 23.5204, lng: 87.3119 },
  { name: "New Delhi", lat: 28.6139, lng: 77.209 },
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
] as const;

// ─── Geocoding helpers ────────────────────────────────────────────────────────
export async function fetchReverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "en", "User-Agent": "ArogyaGenie/1.0" } },
    );
    const data = await res.json();
    if (data?.display_name) {
      return data.display_name.split(",").slice(0, 3).join(",").trim();
    }
  } catch {
    // fallback
  }
  return `Location (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
}

export async function forwardGeocode(
  query: string,
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  if (!query.trim()) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en", "User-Agent": "ArogyaGenie/1.0" },
    });
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name.split(",").slice(0, 3).join(","),
      };
    }
  } catch {
    // fallback
  }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSavedLocation(): SavedLocation {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.lat && parsed.lng) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_LOCATION;
}

function saveLocation(loc: SavedLocation) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  } catch {
    // ignore
  }
}

export function fmtDist(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export interface UseUserLocationReturn {
  /** Current user coordinates */
  userLoc: UserLocation;
  /** Human-readable location name */
  locationName: string;
  /** Whether live GPS tracking is active */
  isLiveGps: boolean;
  /** Whether a GPS acquisition is in progress */
  locating: boolean;
  /** Location error message, if any */
  locError: string | null;
  /** Update location manually (with name) and persist */
  updateLocation: (lat: number, lng: number, name: string) => void;
  /** Start live GPS tracking */
  startLiveGPS: () => void;
  /** Stop live GPS tracking */
  stopGPS: () => void;
  /** Handle a map click — sets location, reverse geocodes */
  handleMapClick: (lat: number, lng: number) => void;
  /** Search for an address and set location */
  searchAddress: (query: string) => Promise<boolean>;
  /** Select a quick city preset */
  selectQuickCity: (city: { lat: number; lng: number; name: string }) => void;
  /** Whether an address search is in progress */
  isSearchingAddress: boolean;
}

export function useUserLocation(): UseUserLocationReturn {
  const initialLoc = useMemo(() => getSavedLocation(), []);

  const [userLoc, setUserLoc] = useState<UserLocation>({
    lat: initialLoc.lat,
    lng: initialLoc.lng,
  });
  const [locationName, setLocationName] = useState(initialLoc.name);
  const [locating, setLocating] = useState(false);
  const [isLiveGps, setIsLiveGps] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  const watchIdRef = useRef<number | null>(null);

  const stopGPS = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setIsLiveGps(false);
    }
  }, []);

  const updateLocation = useCallback(
    (lat: number, lng: number, name: string) => {
      setUserLoc({ lat, lng });
      setLocationName(name);
      saveLocation({ lat, lng, name });
    },
    [],
  );

  const startLiveGPS = useCallback(() => {
    setLocating(true);
    setLocError(null);

    if (!navigator.geolocation) {
      setLocError("Geolocation not supported on this browser.");
      setLocating(false);
      return;
    }

    stopGPS();

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const freshLat = pos.coords.latitude;
        const freshLng = pos.coords.longitude;
        setLocating(false);
        setIsLiveGps(true);
        const addr = await fetchReverseGeocode(freshLat, freshLng);
        updateLocation(freshLat, freshLng, addr);
      },
      () => {
        setLocError(
          "GPS access unavailable. Select your city or type address above!",
        );
        setLocating(false);
        setIsLiveGps(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );

    watchIdRef.current = id;
  }, [stopGPS, updateLocation]);

  const handleMapClick = useCallback(
    async (clickedLat: number, clickedLng: number) => {
      stopGPS();
      const addr = await fetchReverseGeocode(clickedLat, clickedLng);
      updateLocation(clickedLat, clickedLng, addr);
    },
    [stopGPS, updateLocation],
  );

  const searchAddress = useCallback(
    async (query: string): Promise<boolean> => {
      if (!query.trim()) return false;
      stopGPS();
      setIsSearchingAddress(true);
      setLocError(null);
      try {
        const result = await forwardGeocode(query);
        if (result) {
          updateLocation(result.lat, result.lng, result.displayName);
          return true;
        }
        setLocError("Address not found. Try typing city or landmark name.");
        return false;
      } catch {
        setLocError("Failed to locate address.");
        return false;
      } finally {
        setIsSearchingAddress(false);
      }
    },
    [stopGPS, updateLocation],
  );

  const selectQuickCity = useCallback(
    (city: { lat: number; lng: number; name: string }) => {
      stopGPS();
      updateLocation(city.lat, city.lng, city.name);
    },
    [stopGPS, updateLocation],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    userLoc,
    locationName,
    isLiveGps,
    locating,
    locError,
    updateLocation,
    startLiveGPS,
    stopGPS,
    handleMapClick,
    searchAddress,
    selectQuickCity,
    isSearchingAddress,
  };
}
