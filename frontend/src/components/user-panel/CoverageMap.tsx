"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import styles from "./UserSkillsPage.module.css";

type CoverageMapProps = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  onLocationChange: (latitude: number, longitude: number, address: string) => void;
  onAreaSelect?: (area: string) => void;
};

type LeafletModule = typeof import("leaflet");

type ReverseGeocodeResult = {
  display_name?: string;
  address?: Record<string, string | undefined>;
};

function extractNeighborhood(address?: ReverseGeocodeResult["address"]) {
  if (!address) return "";
  return (
    address.neighbourhood ||
    address.suburb ||
    address.quarter ||
    address.residential ||
    address.city_district ||
    address.district ||
    ""
  ).trim();
}

function toPersianDigits(value: string | number) {
  return String(value)
    .replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)])
    .replace(/[٠-٩]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"["٠١٢٣٤٥٦٧٨٩".indexOf(digit)]);
}

function coordinatesLabel(latitude: number, longitude: number) {
  return toPersianDigits(`${latitude.toFixed(5)} ، ${longitude.toFixed(5)}`);
}

export default function CoverageMap({
  latitude,
  longitude,
  radiusMeters,
  onLocationChange,
  onAreaSelect,
}: CoverageMapProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").CircleMarker | null>(null);
  const radiusRef = useRef<import("leaflet").Circle | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  const onAreaSelectRef = useRef(onAreaSelect);
  const geocodeRequestRef = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    onAreaSelectRef.current = onAreaSelect;
  }, [onAreaSelect]);

  useEffect(() => {
    let disposed = false;

    async function selectPoint(lat: number, lng: number) {
      const requestId = ++geocodeRequestRef.current;
      const fallbackAddress = coordinatesLabel(lat, lng);
      onLocationChangeRef.current(lat, lng, fallbackAddress);
      setAnnouncement("موقعیت جدید روی نقشه انتخاب شد.");

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=fa&addressdetails=1&zoom=18`,
          { signal: AbortSignal.timeout(9000) },
        );
        if (!response.ok) return;
        const result = (await response.json()) as ReverseGeocodeResult;
        if (requestId !== geocodeRequestRef.current) return;

        if (result.display_name) {
          onLocationChangeRef.current(lat, lng, toPersianDigits(result.display_name));
        }

        const neighborhood = extractNeighborhood(result.address);
        if (neighborhood) {
          const localizedNeighborhood = toPersianDigits(neighborhood);
          onAreaSelectRef.current?.(localizedNeighborhood);
          setAnnouncement(`موقعیت و محله ${localizedNeighborhood} انتخاب شد.`);
        }
      } catch {
        // Coordinates remain selected even when reverse geocoding is unavailable.
      }
    }

    async function initializeMap() {
      if (!elementRef.current || mapRef.current) return;

      try {
        const L: LeafletModule = await import("leaflet");
        if (disposed || !elementRef.current) return;

        const map = L.map(elementRef.current, {
          zoomControl: false,
          scrollWheelZoom: true,
          doubleClickZoom: true,
          keyboard: true,
        }).setView([latitude, longitude], 12);

        mapRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        }).addTo(map);

        const primary = getComputedStyle(document.documentElement)
          .getPropertyValue("--vaka-primary")
          .trim();
        const surface = getComputedStyle(document.documentElement)
          .getPropertyValue("--vaka-surface")
          .trim();

        markerRef.current = L.circleMarker([latitude, longitude], {
          radius: 8,
          color: surface,
          weight: 3,
          fillColor: primary,
          fillOpacity: 1,
        }).addTo(map);

        radiusRef.current = L.circle([latitude, longitude], {
          radius: radiusMeters,
          color: primary,
          weight: 2,
          opacity: 0.9,
          fillColor: primary,
          fillOpacity: 0.1,
        }).addTo(map);

        map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
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
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      radiusRef.current = null;
    };
    // The map is initialized once; the next effect updates its center and radius.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !markerRef.current || !radiusRef.current) return;

    const center: [number, number] = [latitude, longitude];
    markerRef.current.setLatLng(center);
    radiusRef.current.setLatLng(center).setRadius(radiusMeters);

    if (!map.getBounds().contains(center)) {
      map.panTo(center, { animate: true, duration: 0.35 });
    }
  }, [latitude, longitude, radiusMeters]);

  return (
    <div className={styles.mapPanel}>
      <div
        className={styles.mapFrame}
        aria-label="نقشه محدوده جغرافیایی تحت پوشش"
      >
        <div
          ref={elementRef}
          className={styles.mapCanvas}
          role="application"
          aria-label="برای انتخاب محل فعالیت روی نقشه کلیک کنید"
        />
        {!mapReady && !mapError && (
          <div className={styles.mapOverlay}>در حال بارگذاری نقشه...</div>
        )}
        {mapError && (
          <div className={styles.mapOverlay} role="status">
            نقشه بارگذاری نشد. دوباره صفحه را بارگذاری کنید.
          </div>
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
        <div className={styles.mapRadiusBadge}>
          شعاع فعال: {toPersianDigits((radiusMeters / 1000).toLocaleString("fa-IR"))} کیلومتر
        </div>
      </div>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
