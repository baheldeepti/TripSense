import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, Search, Loader2, X } from "lucide-react";

import "leaflet/dist/leaflet.css";

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

const NOMINATIM_HEADERS = {
  "Accept-Language": "en",
  "User-Agent": "TripGuard/1.0",
};

export interface LocationResult {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  displayName: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  address?: {
    house_number?: string;
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
    country?: string;
    amenity?: string;
    shop?: string;
    building?: string;
  };
}

interface LocationPickerProps {
  onLocationSelect: (location: LocationResult) => void;
  onInputChange?: (value: string) => void;
  onClear?: () => void;
  initialValue?: string;
  externalValue?: string;
  hideMapByDefault?: boolean;
  placeholder?: string;
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 15);
  }, [map, center]);
  return null;
}

function parseNominatimResult(result: NominatimResult): LocationResult {
  const addr = result.address || {};
  const name = addr.amenity || addr.shop || addr.building || result.name || "";
  const road = [addr.house_number, addr.road].filter(Boolean).join(" ");
  const city = addr.city || addr.town || addr.village || "";
  const state = addr.state || "";
  const pincode = addr.postcode || "";

  return {
    name: name || road || result.display_name.split(",")[0]?.trim() || "",
    address: road,
    city,
    state,
    pincode,
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    displayName: result.display_name,
  };
}

export function LocationPicker({ onLocationSelect, onInputChange, onClear, initialValue, externalValue, hideMapByDefault, placeholder }: LocationPickerProps) {
  const [query, setQuery] = useState(initialValue || "");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [markerPos, setMarkerPos] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([20, 0]);
  const [showMap, setShowMap] = useState(false);
  const [selectedDisplay, setSelectedDisplay] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevExternalValue = useRef(externalValue);

  useEffect(() => {
    if (externalValue !== undefined && externalValue !== prevExternalValue.current) {
      prevExternalValue.current = externalValue;
      setQuery(externalValue);
      setSelectedDisplay(externalValue);
    }
  }, [externalValue]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchPlaces = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&addressdetails=1&limit=5`,
        { headers: NOMINATIM_HEADERS }
      );
      const data: NominatimResult[] = await res.json();
      setResults(data);
      setShowResults(data.length > 0);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setSelectedDisplay("");
    onInputChange?.(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchPlaces(value);
    }, 400);
  };

  const handleSelectResult = (result: NominatimResult) => {
    const location = parseNominatimResult(result);
    const pos: [number, number] = [location.lat, location.lng];
    setMarkerPos(pos);
    setMapCenter(pos);
    setShowMap(true);
    setShowResults(false);
    setSelectedDisplay(location.displayName);
    setQuery(location.name || location.displayName.split(",")[0]?.trim() || "");
    onLocationSelect(location);
  };

  const handleMapClick = async (lat: number, lng: number) => {
    const pos: [number, number] = [lat, lng];
    setMarkerPos(pos);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: NOMINATIM_HEADERS }
      );
      const data: NominatimResult = await res.json();
      const location = parseNominatimResult(data);
      setSelectedDisplay(location.displayName);
      setQuery(location.name || location.displayName.split(",")[0]?.trim() || "");
      onLocationSelect(location);
    } catch {
      const fallbackName = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      setQuery(fallbackName);
      setSelectedDisplay(fallbackName);
      onLocationSelect({
        name: fallbackName,
        address: "",
        city: "",
        state: "",
        pincode: "",
        lat,
        lng,
        displayName: fallbackName,
      });
    }
  };

  const handleClear = () => {
    setQuery("");
    setSelectedDisplay("");
    setResults([]);
    setShowResults(false);
    setMarkerPos(null);
    setShowMap(false);
    onClear?.();
  };

  return (
    <div className="space-y-3" ref={containerRef}>
      <div className="relative">
        <div className="relative flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => { if (results.length > 0) setShowResults(true); }}
              placeholder={placeholder || "Search for a place, address, or landmark..."}
              className="pl-9 pr-8"
              data-testid="input-location-search"
            />
            {(query || selectedDisplay) && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                data-testid="button-clear-location"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {!showMap && !hideMapByDefault && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                setShowMap(true);
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const center: [number, number] = [pos.coords.latitude, pos.coords.longitude];
                      setMapCenter(center);
                    },
                    () => {},
                    { enableHighAccuracy: false, timeout: 5000 }
                  );
                }
              }}
              data-testid="button-show-map"
            >
              <MapPin className="h-4 w-4" />
            </Button>
          )}
        </div>

        {isSearching && (
          <div className="absolute right-14 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {showResults && results.length > 0 && (
          <Card className="absolute z-50 w-full mt-1 overflow-hidden" data-testid="location-results-dropdown">
            <ul className="max-h-60 overflow-y-auto">
              {results.map((result) => (
                <li key={result.place_id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 text-left text-sm hover-elevate flex items-start gap-2.5 border-b last:border-b-0"
                    onClick={() => handleSelectResult(result)}
                    data-testid={`button-location-result-${result.place_id}`}
                  >
                    <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{result.name || result.display_name.split(",")[0]?.trim()}</p>
                      <p className="text-xs text-muted-foreground truncate">{result.display_name}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {selectedDisplay && (
        <p className="text-xs text-muted-foreground flex items-start gap-1.5" data-testid="text-selected-location">
          <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
          <span className="truncate">{selectedDisplay}</span>
        </p>
      )}

      {showMap && (
        <div className="rounded-md overflow-hidden border" style={{ height: "240px" }} data-testid="map-container">
          <MapContainer
            center={mapCenter}
            zoom={markerPos ? 15 : 3}
            style={{ height: "100%", width: "100%" }}
            attributionControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapClickHandler onClick={handleMapClick} />
            {markerPos && <MapUpdater center={markerPos} />}
            {markerPos && <Marker position={markerPos} />}
          </MapContainer>
          <div className="flex items-center justify-between px-2 py-1 bg-muted/50 text-xs text-muted-foreground">
            <span>Tap the map to pick a location</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => setShowMap(false)}
              data-testid="button-hide-map"
            >
              Hide map
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
