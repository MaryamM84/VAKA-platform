"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import "leaflet/dist/leaflet.css";
import styles from "./UserSkillsPage.module.css";

type PlaceDetails = {
  city?: string;
  region?: string;
  neighborhood?: string;
};

type CoverageMapProps = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  locationSelected: boolean;
  coversEntireCity: boolean;
  addressValue: string;
  onLocationChange: (
    latitude: number,
    longitude: number,
    address: string,
    details?: PlaceDetails,
  ) => void;
};

type LeafletModule = typeof import("leaflet");

type NominatimAddress = Record<string, string | undefined>;

type NominatimResult = {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  boundingbox?: string[];
  address?: NominatimAddress;
  class?: string;
  type?: string;
  addresstype?: string;
  geojson?: {
    type: string;
    coordinates: unknown;
  };
};

type SelectPoint = (
  latitude: number,
  longitude: number,
  result?: NominatimResult,
) => Promise<void>;

const TEHRAN_CENTER: [number, number] = [35.6892, 51.389];
let tehranBoundaryPromise: Promise<NominatimResult["geojson"]> | null = null;

function toPersianDigits(value: string | number) {
  return String(value)
    .replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)])
    .replace(/[٠-٩]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"["٠١٢٣٤٥٦٧٨٩".indexOf(digit)]);
}

function coordinatesLabel(latitude: number, longitude: number) {
  return toPersianDigits(`${latitude.toFixed(5)} ، ${longitude.toFixed(5)}`);
}

function createReadyPinIcon(L: LeafletModule) {
  return L.divIcon({
    className: "vaka-map-ready-marker",
    html: `
      <span class="vaka-map-ready-pin" aria-hidden="true">
        <span class="vaka-map-ready-pin__pulse"></span>
        <svg viewBox="0 0 48 60" focusable="false" aria-hidden="true">
          <path
            d="M24 2.5C12.1 2.5 2.5 12.1 2.5 24c0 16.1 21.5 33.5 21.5 33.5S45.5 40.1 45.5 24C45.5 12.1 35.9 2.5 24 2.5Z"
            fill="var(--vaka-primary)"
            stroke="var(--vaka-surface)"
            stroke-width="2.5"
          />
          <circle cx="24" cy="23.5" r="8.5" fill="var(--vaka-surface)" />
          <circle cx="24" cy="23.5" r="3.2" fill="var(--vaka-primary)" />
        </svg>
      </span>
    `,
    iconSize: [48, 60],
    iconAnchor: [24, 58],
  });
}

function placeDetails(address?: NominatimAddress): PlaceDetails {
  if (!address) return {};
  const city =
    address.city ||
    address.town ||
    address.municipality ||
    address.village;
  const neighborhood =
    address.neighbourhood ||
    address.suburb ||
    address.quarter ||
    address.city_district;

  return {
    city: city ? toPersianDigits(city) : undefined,
    region: address.state ? toPersianDigits(address.state) : undefined,
    neighborhood: neighborhood ? toPersianDigits(neighborhood) : undefined,
  };
}

async function fetchTehranBoundary(): Promise<NominatimResult["geojson"]> {
  if (!tehranBoundaryPromise) {
    const query = new URLSearchParams({
      format: "jsonv2",
      city: "Tehran",
      state: "Tehran",
      country: "Iran",
      polygon_geojson: "1",
      addressdetails: "1",
      limit: "5",
      "accept-language": "fa",
    });

    tehranBoundaryPromise = fetch(
      `https://nominatim.openstreetmap.org/search?${query.toString()}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("دریافت مرز تهران از سرویس نقشه ناموفق بود.");
        const results = (await response.json()) as NominatimResult[];
        const candidates = results.filter((item) =>
          item.geojson &&
          ["Polygon", "MultiPolygon"].includes(item.geojson.type),
        );
        const cityBoundary =
          candidates.find((item) => item.addresstype === "city") ||
          candidates.find(
            (item) =>
              item.class === "boundary" &&
              item.type === "administrative" &&
              item.address?.city,
          ) ||
          candidates[0];

        if (!cityBoundary?.geojson) {
          throw new Error("مرز جغرافیایی شهر تهران در سرویس نقشه پیدا نشد.");
        }
        return cityBoundary.geojson;
      })
      .catch((error) => {
        tehranBoundaryPromise = null;
        throw error;
      });
  }

  return tehranBoundaryPromise;
}

export default function CoverageMap({
  latitude,
  longitude,
  radiusMeters,
  locationSelected,
  coversEntireCity,
  addressValue,
  onLocationChange,
}: CoverageMapProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").CircleMarker | null>(null);
  const defaultMarkerRef = useRef<import("leaflet").Marker | null>(null);
  const radiusRef = useRef<import("leaflet").Circle | null>(null);
  const cityBoundaryRef = useRef<import("leaflet").LayerGroup | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  const leafletRef = useRef<LeafletModule | null>(null);
  const selectPointRef = useRef<SelectPoint | null>(null);
  const geocodeRequestRef = useRef(0);
  const boundaryRequestRef = useRef(0);
  const coversEntireCityRef = useRef(coversEntireCity);
  const radiusMetersRef = useRef(radiusMeters);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [searchQuery, setSearchQuery] = useState(addressValue);
  const [previousAddressValue, setPreviousAddressValue] = useState(addressValue);
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [boundaryError, setBoundaryError] = useState("");

  if (addressValue !== previousAddressValue) {
    setPreviousAddressValue(addressValue);
    setSearchQuery(addressValue);
  }

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    coversEntireCityRef.current = coversEntireCity;
    radiusMetersRef.current = radiusMeters;
  }, [coversEntireCity, radiusMeters]);

  useEffect(() => {
    let disposed = false;

    async function selectPoint(lat: number, lng: number, result?: NominatimResult) {
      if (coversEntireCityRef.current) return;

      const requestId = ++geocodeRequestRef.current;
      const initialAddress = result?.display_name
        ? toPersianDigits(result.display_name)
        : coordinatesLabel(lat, lng);
      const initialDetails = placeDetails(result?.address);

      setSearchQuery(initialAddress);
      setSearchResults([]);
      setSearchError("");
      onLocationChangeRef.current(lat, lng, initialAddress, initialDetails);
      setAnnouncement("موقعیت جدید روی نقشه انتخاب شد.");

      const L = leafletRef.current;
      const map = mapRef.current;
      if (L && map) {
        if (defaultMarkerRef.current) {
          map.removeLayer(defaultMarkerRef.current);
          defaultMarkerRef.current = null;
        }
        const center: [number, number] = [lat, lng];
        const primary = getComputedStyle(document.documentElement)
          .getPropertyValue("--vaka-primary")
          .trim();
        const surface = getComputedStyle(document.documentElement)
          .getPropertyValue("--vaka-surface")
          .trim();

        if (markerRef.current) markerRef.current.setLatLng(center);
        else {
          markerRef.current = L.circleMarker(center, {
            radius: 8,
            color: surface,
            weight: 3,
            fillColor: primary,
            fillOpacity: 1,
          }).addTo(map);
        }

        if (radiusRef.current) radiusRef.current.setLatLng(center).setRadius(radiusMetersRef.current);
        else {
          radiusRef.current = L.circle(center, {
            radius: radiusMetersRef.current,
            color: primary,
            weight: 2,
            opacity: 0.9,
            fillColor: primary,
            fillOpacity: 0.1,
          }).addTo(map);
        }

        const bounds = result?.boundingbox?.map(Number);
        if (bounds?.length === 4 && bounds.every(Number.isFinite)) {
          map.fitBounds(
            [[bounds[0], bounds[2]], [bounds[1], bounds[3]]],
            { padding: [24, 24], maxZoom: 15, animate: true },
          );
        } else {
          map.setView(center, Math.max(map.getZoom(), 13), { animate: true });
        }
      }

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=fa&addressdetails=1&zoom=18`,
          { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) },
        );
        if (!response.ok) return;

        const reverse = (await response.json()) as NominatimResult;
        if (requestId !== geocodeRequestRef.current || disposed) return;

        if (reverse.display_name) {
          const resolvedAddress = toPersianDigits(reverse.display_name);
          setSearchQuery(resolvedAddress);
          onLocationChangeRef.current(
            lat,
            lng,
            resolvedAddress,
            placeDetails(reverse.address),
          );
        }
      } catch {
        // The selected coordinates and the initial address remain available.
      }
    }

    selectPointRef.current = selectPoint;

    async function initializeMap() {
      if (!elementRef.current || mapRef.current) return;

      try {
        const L: LeafletModule = await import("leaflet");
        if (disposed || !elementRef.current) return;
        leafletRef.current = L;

        const map = L.map(elementRef.current, {
          zoomControl: false,
          scrollWheelZoom: true,
          doubleClickZoom: true,
          keyboard: true,
        }).setView(
          coversEntireCity || !locationSelected ? TEHRAN_CENTER : [latitude, longitude],
          coversEntireCity ? 10 : locationSelected ? 12 : 11,
        );

        mapRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        }).addTo(map);

        map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
          if (coversEntireCityRef.current) return;
          void selectPoint(event.latlng.lat, event.latlng.lng);
        });

        setMapReady(true);
        window.setTimeout(() => {
          if (!disposed) map.invalidateSize();
        }, 160);
      } catch {
        if (!disposed) setMapError(true);
      }
    }

    void initializeMap();

    return () => {
      disposed = true;
      geocodeRequestRef.current += 1;
      boundaryRequestRef.current += 1;
      selectPointRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      defaultMarkerRef.current = null;
      radiusRef.current = null;
      cityBoundaryRef.current = null;
    };
    // Map initialization is intentionally one-time; subsequent props are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    const primary = getComputedStyle(document.documentElement)
      .getPropertyValue("--vaka-primary")
      .trim();
    const surface = getComputedStyle(document.documentElement)
      .getPropertyValue("--vaka-surface")
      .trim();

    if (coversEntireCity) {
      if (markerRef.current) map.removeLayer(markerRef.current);
      if (defaultMarkerRef.current) map.removeLayer(defaultMarkerRef.current);
      if (radiusRef.current) map.removeLayer(radiusRef.current);
      markerRef.current = null;
      defaultMarkerRef.current = null;
      radiusRef.current = null;

      if (cityBoundaryRef.current) return;
      map.setView(TEHRAN_CENTER, 10, { animate: true });

      const requestId = ++boundaryRequestRef.current;
      setBoundaryError("");
      void fetchTehranBoundary()
        .then((geometry) => {
          if (
            requestId !== boundaryRequestRef.current ||
            !mapRef.current ||
            !coversEntireCityRef.current
          ) return;

          const boundary = geometry as never;
          const glow = L.geoJSON(boundary, {
            style: {
              color: primary,
              weight: 13,
              opacity: 0.24,
              fill: false,
              className: "vaka-tehran-boundary-glow",
              lineCap: "round",
              lineJoin: "round",
            },
          });
          const fill = L.geoJSON(boundary, {
            style: {
              color: primary,
              weight: 3,
              opacity: 1,
              fillColor: primary,
              fillOpacity: 0.15,
              className: "vaka-tehran-boundary",
              lineCap: "round",
              lineJoin: "round",
            },
          });
          const runner = L.geoJSON(boundary, {
            style: {
              color: primary,
              weight: 4,
              opacity: 0.98,
              fill: false,
              dashArray: "9 17",
              className: "vaka-tehran-boundary-runner",
              lineCap: "round",
              lineJoin: "round",
            },
          });

          const group = L.layerGroup([glow, fill, runner]).addTo(map);
          cityBoundaryRef.current = group;
          const bounds = fill.getBounds();
          if (bounds.isValid()) {
            map.fitBounds(bounds, {
              padding: [30, 30],
              maxZoom: 10,
              animate: true,
              duration: 0.9,
            });
          }
          setBoundaryError("");
        })
        .catch(() => {
          if (requestId === boundaryRequestRef.current) {
            setBoundaryError("مرز تهران از سرویس نقشه دریافت نشد؛ اتصال اینترنت را بررسی کنید.");
          }
        });

      return;
    }

    boundaryRequestRef.current += 1;
    if (cityBoundaryRef.current) {
      map.removeLayer(cityBoundaryRef.current);
      cityBoundaryRef.current = null;
    }
    if (!locationSelected) {
      if (markerRef.current) map.removeLayer(markerRef.current);
      if (radiusRef.current) map.removeLayer(radiusRef.current);
      markerRef.current = null;
      radiusRef.current = null;

      if (!defaultMarkerRef.current) {
        defaultMarkerRef.current = L.marker(TEHRAN_CENTER, {
          icon: createReadyPinIcon(L),
          interactive: false,
          keyboard: false,
          zIndexOffset: 500,
        }).addTo(map);
      } else {
        defaultMarkerRef.current.setLatLng(TEHRAN_CENTER);
      }

      map.setView(TEHRAN_CENTER, 11, { animate: true, duration: 0.6 });
      return;
    }

    if (defaultMarkerRef.current) {
      map.removeLayer(defaultMarkerRef.current);
      defaultMarkerRef.current = null;
    }

    const center: [number, number] = [latitude, longitude];
    if (markerRef.current) markerRef.current.setLatLng(center);
    else {
      markerRef.current = L.circleMarker(center, {
        radius: 8,
        color: surface,
        weight: 3,
        fillColor: primary,
        fillOpacity: 1,
      }).addTo(map);
    }

    if (radiusRef.current) radiusRef.current.setLatLng(center).setRadius(radiusMetersRef.current);
    else {
      radiusRef.current = L.circle(center, {
        radius: radiusMeters,
        color: primary,
        weight: 2,
        opacity: 0.9,
        fillColor: primary,
        fillOpacity: 0.1,
      }).addTo(map);
    }

    if (!map.getBounds().contains(center)) {
      map.panTo(center, { animate: true, duration: 0.35 });
    }
  }, [latitude, longitude, radiusMeters, locationSelected, coversEntireCity, mapReady]);

  async function searchAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query || coversEntireCity) return;

    setIsSearching(true);
    setSearchError("");
    setSearchResults([]);

    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        q: query,
        countrycodes: "ir",
        addressdetails: "1",
        limit: "5",
        "accept-language": "fa",
      });
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) },
      );
      if (!response.ok) throw new Error("جست‌وجوی مکان انجام نشد.");

      const results = (await response.json()) as NominatimResult[];
      if (!results.length) {
        setSearchError("مکان موردنظر پیدا نشد. نام محله یا خیابان را دقیق‌تر وارد کنید.");
        return;
      }
      setSearchResults(results);
    } catch (error) {
      setSearchError(
        error instanceof Error
          ? error.message
          : "در جست‌وجوی مکان خطایی رخ داد.",
      );
    } finally {
      setIsSearching(false);
    }
  }

  function chooseSearchResult(result: NominatimResult) {
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    void selectPointRef.current?.(lat, lng, result);
  }

  return (
    <div className={styles.mapPanel}>
      <form className={styles.mapSearchForm} onSubmit={searchAddress}>
        <input
          className={styles.mapSearchInput}
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="نام محله، خیابان یا آدرس را جست‌وجو کنید..."
          aria-label="جست‌وجوی محله، خیابان یا آدرس"
          disabled={!mapReady || mapError || coversEntireCity || isSearching}
          maxLength={180}
        />
        <button
          className={styles.mapSearchButton}
          type="submit"
          disabled={!mapReady || mapError || coversEntireCity || isSearching || !searchQuery.trim()}
        >
          {isSearching ? "در حال جست‌وجو..." : "جست‌وجو"}
        </button>
      </form>

      {searchError && <p className={styles.mapSearchMessage} role="status">{searchError}</p>}
      {searchResults.length > 0 && (
        <div className={styles.mapSearchResults} role="listbox" aria-label="نتایج جست‌وجوی مکان">
          {searchResults.map((result) => (
            <button
              key={result.place_id}
              type="button"
              className={styles.mapSearchResult}
              role="option"
              aria-selected="false"
              onClick={() => chooseSearchResult(result)}
            >
              <strong>{toPersianDigits(result.name || result.display_name || "مکان")}</strong>
              <span>{toPersianDigits(result.display_name || "")}</span>
            </button>
          ))}
        </div>
      )}

      <div
        className={styles.mapFrame}
        aria-label="نقشه محدوده جغرافیایی تحت پوشش"
      >
        <div
          ref={elementRef}
          className={styles.mapCanvas}
          role="application"
          aria-label={
            coversEntireCity
              ? "مرز محدوده شهر تهران"
              : "برای انتخاب محل فعالیت روی نقشه کلیک کنید"
          }
        />
        {!mapReady && !mapError && (
          <div className={styles.mapOverlay}>در حال بارگذاری نقشه...</div>
        )}
        {mapError && (
          <div className={styles.mapOverlay} role="status">
            نقشه بارگذاری نشد. دوباره صفحه را بارگذاری کنید.
          </div>
        )}
        {boundaryError && coversEntireCity && (
          <div className={styles.mapBoundaryError} role="status">{boundaryError}</div>
        )}
        <div className={styles.mapZoomControls} role="group" aria-label="کنترل بزرگ‌نمایی نقشه">
          <button
            type="button"
            className={styles.mapZoomButton}
            onClick={() => mapRef.current?.zoomIn()}
            disabled={!mapReady || mapError}
            aria-label="بزرگ‌نمایی نقشه"
            title="بزرگ‌نمایی"
          >
            +
          </button>
          <button
            type="button"
            className={styles.mapZoomButton}
            onClick={() => mapRef.current?.zoomOut()}
            disabled={!mapReady || mapError}
            aria-label="کوچک‌نمایی نقشه"
            title="کوچک‌نمایی"
          >
            −
          </button>
        </div>
      </div>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
