"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import styles from "./tasks.module.css";

export default function TaskMap({ latitude, longitude, label }: { latitude: number; longitude: number; label?: string | null }) {
  const element = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | undefined;
    void import("leaflet").then(L => {
      if (disposed || !element.current) return;
      map = L.map(element.current, { scrollWheelZoom: false, zoomControl: false }).setView([latitude, longitude], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      const icon = L.divIcon({ className: styles.mapMarker, iconSize: [32, 32], iconAnchor: [16, 16], html: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="1.7"><path d="M5 22V3h12v19M2 22h20M17 8h4v14M8 6h2m2 0h2M8 10h2m2 0h2M8 14h2m2 0h2M10 22v-4h3v4"/></svg>' });
      const marker = L.marker([latitude, longitude], { icon, keyboard: true, alt: "موقعیت کار" }).addTo(map);
      if (label) {
        const text = document.createElement("span");
        text.textContent = label;
        marker.bindTooltip(text, { permanent: true, direction: "top", offset: [0, -14], className: styles.mapLabel });
      }
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; map?.remove(); };
  }, [latitude, longitude, label]);
  return failed ? <p>بارگذاری نقشه ممکن نشد.</p> : <div ref={element} className={styles.map} role="img" aria-label="موقعیت کار روی نقشه" />;
}
