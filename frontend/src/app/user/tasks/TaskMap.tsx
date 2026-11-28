"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { LatLngTuple } from "leaflet";
import type { AssignedTask } from "@/lib/assigned-tasks";
import "leaflet/dist/leaflet.css";
import { TaskIcon } from "./TaskVisuals";
import styles from "./tasks.module.css";

type Location = AssignedTask["locations"][number];
type Point = { position: LatLngTuple; label?: string | null };
type Endpoint = { kind: "origin" | "destination"; location: Location };

const endpointNames = { origin: "مبدأ", destination: "مقصد" };
const endpointTitles = { origin: "مبدأ (نقطه شروع)", destination: "مقصد نهایی" };
const markerPaths = {
  fixed: "M5 22V3h12v19M2 22h20M17 8h4v14M8 6h2m2 0h2M8 10h2m2 0h2M8 14h2m2 0h2M10 22v-4h3v4",
  origin: "m12 3 9 5v8l-9 5-9-5V8l9-5ZM3 8l9 5 9-5m-9 5v8M8 5l9 5",
  destination: "m3 12 5 5 4-4m-2-2 4 4 7-8",
};

function coordinates({ latitude, longitude }: Location): LatLngTuple | null {
  return typeof latitude === "number" && Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
    typeof longitude === "number" && Number.isFinite(longitude) && Math.abs(longitude) <= 180
    ? [latitude, longitude]
    : null;
}

function TaskMap({ points, route = false }: { points: (Point & { kind?: Endpoint["kind"] })[]; route?: boolean }) {
  const element = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | undefined;
    let resize: ResizeObserver | undefined;
    void import("leaflet").then(L => {
      if (disposed || !element.current) return;
      const view = L.map(element.current, {
        scrollWheelZoom: false, zoomControl: false,
        dragging: !route, touchZoom: !route, boxZoom: !route, doubleClickZoom: !route, keyboard: !route,
      });
      map = view;
      const positions = points.map(({ position }) => position);
      const [first, second] = positions;
      const sharedPoint = second && first[0] === second[0] && first[1] === second[1];
      const fit = () => {
        if (second && !sharedPoint) {
          view.fitBounds(L.latLngBounds(positions), { padding: [50, 56], maxZoom: 18 });
        } else {
          view.setView(first, 15);
        }
      };
      fit();
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(view);
      if (second && !sharedPoint) {
        L.polyline(positions, { color: "#005e50", weight: 4, dashArray: "8 7", lineCap: "butt", interactive: false }).addTo(view);
      }
      for (const { position, label, kind } of points) {
        const size = kind ? 38 : 32;
        const separation = sharedPoint ? (kind === "origin" ? -20 : 20) : 0;
        const icon = L.divIcon({
          className: `${styles.mapMarker} ${kind ? styles[kind] : ""}`,
          iconSize: [size, size],
          iconAnchor: [size / 2 + separation, size / 2],
          html: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="${markerPaths[kind ?? "fixed"]}"/></svg>`,
        });
        const marker = L.marker(position, { icon, keyboard: !route, alt: label || "موقعیت کار" }).addTo(view);
        if (label) {
          const text = document.createElement("span");
          text.textContent = label;
          marker.bindTooltip(text, {
            permanent: true,
            direction: sharedPoint ? (kind === "origin" ? "right" : "left") : "top",
            offset: sharedPoint ? [kind === "origin" ? 42 : -42, 0] : [0, kind ? -21 : -14],
            className: `${styles.mapLabel} ${kind ? `${styles.routeLabel} ${styles[kind]}` : ""}`,
          });
        }
      }
      if (route) {
        resize = new ResizeObserver(() => { view.invalidateSize(); fit(); });
        resize.observe(element.current);
      }
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; resize?.disconnect(); map?.remove(); };
  }, [points, route]);
  return failed ? <p>بارگذاری نقشه ممکن نشد.</p> : <div ref={element} className={`${styles.map} ${route ? styles.routeMap : ""}`} role={route ? "region" : "img"} aria-label={route ? "مبدأ و مقصد روی نقشه" : "موقعیت کار روی نقشه"} />;
}

function FixedLocation({ location }: { location: Location }) {
  const position = coordinates(location);
  return <div>
    <p>{[location.city, location.region, location.address].filter(Boolean).join("، ")}</p>
    {position ? <TaskMap points={[{ position, label: location.notes }]}/> : <p>مختصات موقعیت در دسترس نیست.</p>}
  </div>;
}

function RoutePreview({ endpoints }: { endpoints: Endpoint[] }) {
  const locatedEndpoints = endpoints.map(({ kind, location }) => {
    const position = coordinates(location);
    const area = location.region || location.city;
    const label = area ? `${endpointNames[kind]}: ${area}` : endpointNames[kind];
    return { kind, position, label };
  });
  const points = locatedEndpoints.flatMap(point => point.position ? [{ ...point, position: point.position }] : []);
  const missing = locatedEndpoints.filter(({ position }) => !position).map(({ kind }) => endpointNames[kind]);

  return <>
    <div className={styles.routeEndpoints}>
      {endpoints.map(({ kind, location }) => <div className={`${styles.routeEndpoint} ${styles[kind]}`} key={kind}>
        <span>{endpointTitles[kind]}</span>
        <strong>{[location.city, location.region, location.address || location.notes].filter(Boolean).join("، ") || "آدرس در دسترس نیست."}</strong>
      </div>)}
    </div>
    {points.length > 0 && <TaskMap points={points} route/>}
    {missing.length > 0 && <p>مختصات {missing.join(" و ")} در دسترس نیست.</p>}
  </>;
}

export default memo(function TaskLocations({ locations }: { locations: Location[] }) {
  const ordered = [...locations].sort((a, b) => (a.stop_order ?? 0) - (b.stop_order ?? 0));
  const legacyStops = ordered.filter(location => !location.location_type);
  const origin = ordered.find(location => /origin|pick.?up|source|مبدا|مبدأ/i.test(location.location_type ?? "")) ?? legacyStops[0];
  const destination = ordered.find(location => /destination|drop.?off|delivery|مقصد/i.test(location.location_type ?? "")) ??
    legacyStops.findLast(location => location !== origin);
  const hasRoute = origin && destination;
  const fixedLocations = hasRoute ? locations.filter(location => location !== origin && location !== destination) : locations;

  return <div className={styles.location}>
    <h3><TaskIcon name="pin"/>موقعیت مکانی</h3>
    {hasRoute && <RoutePreview endpoints={[{ kind: "origin", location: origin }, { kind: "destination", location: destination }]}/>}
    {fixedLocations.map((location, index) => <FixedLocation key={location.task_location_id ?? index} location={location}/>)}
    {locations.length === 0 && <p>موقعیتی ثبت نشده است.</p>}
  </div>;
});
