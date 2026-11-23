"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import styles from "./tasks.module.css";

export default function TaskMap({ latitude, longitude }: { latitude: number; longitude: number }) {
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
      L.circleMarker([latitude, longitude], { radius: 9, color: "#fff", weight: 3, fillColor: "#006052", fillOpacity: 1 }).addTo(map);
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; map?.remove(); };
  }, [latitude, longitude]);
  return failed ? <p>بارگذاری نقشه ممکن نشد.</p> : <div ref={element} className={styles.map} role="img" aria-label="موقعیت تسک روی نقشه" />;
}
