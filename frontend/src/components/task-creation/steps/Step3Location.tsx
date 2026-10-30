"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { TaskFormData } from "../types";
import "leaflet/dist/leaflet.css";

type Field = keyof TaskFormData;

type Props = {
  data: TaskFormData;
  onChange: (field: Field, value: string) => void;
};

type SearchResult = {
  lat: string;
  lon: string;
  display_name: string;
};

type LeafletModule = typeof import("leaflet");
type RoutePoint = "origin" | "destination";

const DEFAULT_CENTER: [number, number] = [35.7002, 51.337];

const radiusOptions = [
  { value: "500", label: "۵۰۰ متر" },
  { value: "1000", label: "۱ کیلومتر" },
  { value: "2000", label: "۲ کیلومتر" },
  { value: "5000", label: "۵ کیلومتر" },
  { value: "10000", label: "۱۰ کیلومتر" },
];

function isValidCoordinates(lat: string, lng: string) {
  const latNumber = Number(lat);
  const lngNumber = Number(lng);

  return (
    lat !== "" &&
    lng !== "" &&
    Number.isFinite(latNumber) &&
    Number.isFinite(lngNumber)
  );
}

function buildMarkerHtml(color: string) {
  return `
    <span style="
      display:block;
      width:18px;
      height:18px;
      border-radius:9999px;
      background:${color};
      border:4px solid #ffffff;
      box-shadow:0 3px 12px rgba(0,0,0,.18);
    "></span>
  `;
}

function LocationIcon({
  name,
}: {
  name:
    | "pin"
    | "search"
    | "target"
    | "lock"
    | "check"
    | "map"
    | "home"
    | "route"
    | "flag"
    | "building";
}) {
  const icons: Record<
    | "pin"
    | "search"
    | "target"
    | "lock"
    | "check"
    | "map"
    | "home"
    | "route"
    | "flag"
    | "building",
    ReactNode
  > = {
    pin: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m16 16 5 5" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    check: (
      <>
        <path d="m5 12 4 4L19 6" />
      </>
    ),
    map: (
      <>
        <path d="M9 18 3 20V6l6-2 6 2 6-2v14l-6 2-6-2Z" />
        <path d="M9 4v14M15 6v14" />
      </>
    ),
    home: (
      <>
        <path d="m3 11 9-7 9 7" />
        <path d="M5 10.5V20h14v-9.5" />
      </>
    ),
    route: (
      <>
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="6" r="2" />
        <path d="M8 18h4a4 4 0 0 0 4-4V8" />
      </>
    ),
    flag: (
      <>
        <path d="M5 21V5" />
        <path d="M5 5c5-3 7 3 12 0v8c-5 3-7-3-12 0" />
      </>
    ),
    building: (
      <>
        <path d="M4 20V8l8-4 8 4v12" />
        <path d="M9 20v-4h6v4" />
        <path d="M8 10h.01M12 10h.01M16 10h.01M8 13h.01M12 13h.01M16 13h.01" />
      </>
    ),
  };

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  );
}

export default function Step3Location({ data, onChange }: Props) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<import("leaflet").Map | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);

  const fixedMarkerRef = useRef<import("leaflet").Marker | null>(null);
  const originMarkerRef = useRef<import("leaflet").Marker | null>(null);
  const destinationMarkerRef = useRef<import("leaflet").Marker | null>(null);
  const radiusCircleRef = useRef<import("leaflet").Circle | null>(null);
  const routeLineRef = useRef<import("leaflet").Polyline | null>(null);

  const dataRef = useRef(data);
  const onChangeRef = useRef(onChange);

  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [activeRoutePoint, setActiveRoutePoint] =
    useState<RoutePoint>("origin");

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const locationMode = data.locationMode || "fixed";
  const isRouteMode = locationMode === "route";

  const fixedSelected = isValidCoordinates(
    data.locationLatitude,
    data.locationLongitude,
  );
  const originSelected = isValidCoordinates(
    data.originLatitude,
    data.originLongitude,
  );
  const destinationSelected = isValidCoordinates(
    data.destinationLatitude,
    data.destinationLongitude,
  );

  const radiusLabel = useMemo(() => {
    return (
      radiusOptions.find(
        (item) => item.value === (data.locationRadiusMeters || "2000"),
      )?.label ?? "۲ کیلومتر"
    );
  }, [data.locationRadiusMeters]);

  const makeDivIcon = useCallback(
    (type: "fixed" | "origin" | "destination") => {
      const L = leafletRef.current;
      if (!L) return null;

      const colorMap = {
        fixed: "#007563",
        origin: "#007563",
        destination: "#d88520",
      };

      return L.divIcon({
        className: "vaka-custom-marker",
        html: buildMarkerHtml(colorMap[type]),
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
    },
    [],
  );

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fa`,
      );

      if (!response.ok) {
        throw new Error("reverse failed");
      }

      const result = (await response.json()) as { display_name?: string };

      return result.display_name ?? `${lat.toFixed(5)} ، ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)} ، ${lng.toFixed(5)}`;
    }
  }, []);

  const flyToLocation = useCallback((lat: number, lng: number) => {
    mapInstance.current?.flyTo([lat, lng], 15, { duration: 0.8 });
  }, []);

  const setFixedLocation = useCallback(
    async (lat: number, lng: number, address?: string) => {
      onChangeRef.current("locationLatitude", lat.toFixed(6));
      onChangeRef.current("locationLongitude", lng.toFixed(6));

      const resolvedAddress = address ?? (await reverseGeocode(lat, lng));
      onChangeRef.current("locationAddress", resolvedAddress);

      setMessage("موقعیت محل ثابت ثبت شد.");
    },
    [reverseGeocode],
  );

  const setRouteLocation = useCallback(
    async (point: RoutePoint, lat: number, lng: number, address?: string) => {
      const resolvedAddress = address ?? (await reverseGeocode(lat, lng));

      if (point === "origin") {
        onChangeRef.current("originLatitude", lat.toFixed(6));
        onChangeRef.current("originLongitude", lng.toFixed(6));
        onChangeRef.current("originAddress", resolvedAddress);
        setMessage("موقعیت مبدا ثبت شد.");
      } else {
        onChangeRef.current("destinationLatitude", lat.toFixed(6));
        onChangeRef.current("destinationLongitude", lng.toFixed(6));
        onChangeRef.current("destinationAddress", resolvedAddress);
        setMessage("موقعیت مقصد ثبت شد.");
      }
    },
    [reverseGeocode],
  );

  const applySelectedLocation = useCallback(
    async (lat: number, lng: number, address?: string) => {
      const currentData = dataRef.current;

      if ((currentData.locationMode || "fixed") === "route") {
        await setRouteLocation(activeRoutePoint, lat, lng, address);
      } else {
        await setFixedLocation(lat, lng, address);
      }

      flyToLocation(lat, lng);
    },
    [activeRoutePoint, flyToLocation, setFixedLocation, setRouteLocation],
  );

  useEffect(() => {
    let disposed = false;

    async function initializeMap() {
      if (!mapElement.current || mapInstance.current) return;

      const L = await import("leaflet");
      if (disposed || !mapElement.current) return;

      leafletRef.current = L;

      let center: [number, number] = DEFAULT_CENTER;
      let zoom = 12;

      if (isValidCoordinates(data.locationLatitude, data.locationLongitude)) {
        center = [
          Number(data.locationLatitude),
          Number(data.locationLongitude),
        ];
        zoom = 15;
      } else if (
        isValidCoordinates(data.originLatitude, data.originLongitude)
      ) {
        center = [Number(data.originLatitude), Number(data.originLongitude)];
        zoom = 14;
      }

      const map = L.map(mapElement.current, {
        zoomControl: false,
      }).setView(center, zoom);

      mapInstance.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      L.control.zoom({ position: "bottomleft" }).addTo(map);

      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        void applySelectedLocation(event.latlng.lat, event.latlng.lng);
      });

      setMapLoaded(true);

      setTimeout(() => {
        if (!disposed) {
          map.invalidateSize();
        }
      }, 150);
    }

    void initializeMap();

    return () => {
      disposed = true;

      mapInstance.current?.remove();
      mapInstance.current = null;
      leafletRef.current = null;

      fixedMarkerRef.current = null;
      originMarkerRef.current = null;
      destinationMarkerRef.current = null;
      radiusCircleRef.current = null;
      routeLineRef.current = null;
    };
  }, [applySelectedLocation]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstance.current;

    if (!L || !map || !mapLoaded) return;

    const fixedIcon = makeDivIcon("fixed");
    const originIcon = makeDivIcon("origin");
    const destinationIcon = makeDivIcon("destination");

    if (!isRouteMode) {
      if (originMarkerRef.current) {
        originMarkerRef.current.remove();
        originMarkerRef.current = null;
      }

      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
        destinationMarkerRef.current = null;
      }

      if (routeLineRef.current) {
        routeLineRef.current.remove();
        routeLineRef.current = null;
      }

      if (fixedSelected && fixedIcon) {
        const position: [number, number] = [
          Number(data.locationLatitude),
          Number(data.locationLongitude),
        ];

        if (fixedMarkerRef.current) {
          fixedMarkerRef.current.setLatLng(position);
        } else {
          const marker = L.marker(position, {
            draggable: true,
            icon: fixedIcon,
          }).addTo(map);

          marker.on("dragend", () => {
            const point = marker.getLatLng();
            void setFixedLocation(point.lat, point.lng);
          });

          fixedMarkerRef.current = marker;
        }

        const radius = Number(data.locationRadiusMeters || "2000");

        if (radiusCircleRef.current) {
          radiusCircleRef.current.setLatLng(position).setRadius(radius);
        } else {
          radiusCircleRef.current = L.circle(position, {
            radius,
            color: "#007563",
            fillColor: "#43a890",
            fillOpacity: 0.1,
            weight: 2,
          }).addTo(map);
        }
      } else {
        if (fixedMarkerRef.current) {
          fixedMarkerRef.current.remove();
          fixedMarkerRef.current = null;
        }

        if (radiusCircleRef.current) {
          radiusCircleRef.current.remove();
          radiusCircleRef.current = null;
        }
      }

      return;
    }

    if (fixedMarkerRef.current) {
      fixedMarkerRef.current.remove();
      fixedMarkerRef.current = null;
    }

    if (radiusCircleRef.current) {
      radiusCircleRef.current.remove();
      radiusCircleRef.current = null;
    }

    if (originSelected && originIcon) {
      const originPosition: [number, number] = [
        Number(data.originLatitude),
        Number(data.originLongitude),
      ];

      if (originMarkerRef.current) {
        originMarkerRef.current.setLatLng(originPosition);
      } else {
        const marker = L.marker(originPosition, {
          draggable: true,
          icon: originIcon,
        }).addTo(map);

        marker.on("dragend", () => {
          const point = marker.getLatLng();
          void setRouteLocation("origin", point.lat, point.lng);
        });

        originMarkerRef.current = marker;
      }
    } else if (originMarkerRef.current) {
      originMarkerRef.current.remove();
      originMarkerRef.current = null;
    }

    if (destinationSelected && destinationIcon) {
      const destinationPosition: [number, number] = [
        Number(data.destinationLatitude),
        Number(data.destinationLongitude),
      ];

      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.setLatLng(destinationPosition);
      } else {
        const marker = L.marker(destinationPosition, {
          draggable: true,
          icon: destinationIcon,
        }).addTo(map);

        marker.on("dragend", () => {
          const point = marker.getLatLng();
          void setRouteLocation("destination", point.lat, point.lng);
        });

        destinationMarkerRef.current = marker;
      }
    } else if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove();
      destinationMarkerRef.current = null;
    }

    if (originSelected && destinationSelected) {
      const linePoints: [number, number][] = [
        [Number(data.originLatitude), Number(data.originLongitude)],
        [Number(data.destinationLatitude), Number(data.destinationLongitude)],
      ];

      if (routeLineRef.current) {
        routeLineRef.current.setLatLngs(linePoints);
      } else {
        routeLineRef.current = L.polyline(linePoints, {
          color: "#007563",
          weight: 3,
          opacity: 0.7,
          dashArray: "7 6",
        }).addTo(map);
      }
    } else if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }
  }, [
    data.locationLatitude,
    data.locationLongitude,
    data.locationRadiusMeters,
    data.originLatitude,
    data.originLongitude,
    data.destinationLatitude,
    data.destinationLongitude,
    fixedSelected,
    originSelected,
    destinationSelected,
    isRouteMode,
    makeDivIcon,
    mapLoaded,
    setFixedLocation,
    setRouteLocation,
  ]);

  async function searchAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = query.trim();

    if (!value) {
      setMessage("ابتدا آدرس یا نام خیابان را وارد کنید.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=fa&q=${encodeURIComponent(value)}`,
      );

      if (!response.ok) {
        throw new Error("search failed");
      }

      const results = (await response.json()) as SearchResult[];

      if (!results.length) {
        setMessage(
          "نتیجه‌ای پیدا نشد. نشانی دقیق‌تری وارد کنید یا مستقیماً روی نقشه انتخاب کنید.",
        );
        return;
      }

      const result = results[0];
      await applySelectedLocation(
        Number(result.lat),
        Number(result.lon),
        result.display_name,
      );
    } catch {
      setMessage(
        "جست‌وجوی نقشه در دسترس نیست. می‌توانید موقعیت را دستی روی نقشه ثبت کنید.",
      );
    } finally {
      setBusy(false);
    }
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setMessage("مرورگر شما مکان‌یابی را پشتیبانی نمی‌کند.");
      return;
    }

    setBusy(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await applySelectedLocation(
          position.coords.latitude,
          position.coords.longitude,
        );
        setBusy(false);
      },
      () => {
        setMessage(
          "دسترسی به موقعیت فعلی ممکن نشد. لطفاً مجوز موقعیت مرورگر را بررسی کنید.",
        );
        setBusy(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
      },
    );
  }

  const activeTargetTitle = isRouteMode
    ? activeRoutePoint === "origin"
      ? "۱- نقطه مبدا (محل سرویس‌دهی)"
      : "۲- نقطه مقصد (تحویل‌گیرنده)"
    : "محل انجام کار";

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <section className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#7f8c86]">
        <span>۶۰٪ تکمیل شده</span>
        <span>گام ۳: تنظیم مختصات مأموریت</span>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#182522]">
          گام ۳: محدوده مکانی و مسیر خدمت
        </h2>
        <p className="mt-2 text-sm leading-7 text-[#66736d]">
          مشخص کنید این خدمت به صورت سیار و مقصدی یا در یک آدرس ثابت انجام
          می‌شود.
        </p>
      </section>

      {/* ساختار جغرافیایی */}
      <section className="rounded-2xl border border-[#e3ece7] bg-[#f7fbf9] p-4 sm:p-5">
        <h3 className="mb-4 text-sm font-bold text-[#174f46]">
          ساختار جغرافیایی کار را انتخاب کنید:
        </h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onChange("locationMode", "fixed")}
            className={`rounded-2xl border p-4 text-right transition ${
              locationMode === "fixed"
                ? "border-[#0b7c6d] bg-[#eaf5f1] shadow-sm"
                : "border-[#e1ebe5] bg-white hover:border-[#8bb5aa]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-[#1c3c34]">
                  انجام در محل ثابت
                </div>
                <div className="mt-1 text-xs leading-6 text-[#6b7c75]">
                  نشانی منزل، دفتر، تعمیرات ثابت یا نمایندگی
                </div>
              </div>

              <span
                className={`inline-flex size-9 items-center justify-center rounded-xl ${
                  locationMode === "fixed"
                    ? "bg-[#0b7c6d] text-white"
                    : "bg-[#eff5f1] text-[#73837c]"
                }`}
              >
                {locationMode === "fixed" ? (
                  <LocationIcon name="check" />
                ) : (
                  <LocationIcon name="home" />
                )}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onChange("locationMode", "route")}
            className={`rounded-2xl border p-4 text-right transition ${
              locationMode === "route"
                ? "border-[#0b7c6d] bg-[#eaf5f1] shadow-sm"
                : "border-[#e1ebe5] bg-white hover:border-[#8bb5aa]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-[#1c3c34]">
                  دارای مبدا و مقصد
                </div>
                <div className="mt-1 text-xs leading-6 text-[#6b7c75]">
                  پیک اختصاصی، اسنپ‌باکس، خرید حضوری و تحویل کالا
                </div>
              </div>

              <span
                className={`inline-flex size-9 items-center justify-center rounded-xl ${
                  locationMode === "route"
                    ? "bg-[#0b7c6d] text-white"
                    : "bg-[#eff5f1] text-[#73837c]"
                }`}
              >
                {locationMode === "route" ? (
                  <LocationIcon name="check" />
                ) : (
                  <LocationIcon name="route" />
                )}
              </span>
            </div>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowSearch((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-full bg-[#007563] px-4 py-2.5 text-xs font-semibold text-white"
          >
            <LocationIcon name="search" />
            جست‌وجو و درج دستی آدرس
          </button>

          <div className="inline-flex items-center gap-2 rounded-full bg-[#007563] px-4 py-2.5 text-xs font-semibold text-white">
            <LocationIcon name="map" />
            انتخاب دقیق روی نقشه (Map Picker)
          </div>
        </div>

        {showSearch && (
          <form onSubmit={searchAddress} className="mt-4 flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="تهران، خیابان سهروردی شمالی، نبش کوچه ..."
              className="min-w-0 flex-1 rounded-xl border border-[#dce7e1] bg-white px-4 py-3 text-sm outline-none focus:border-[#007563]"
            />

            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-[#007563] px-4 py-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              جست‌وجو
            </button>
          </form>
        )}
      </section>

      {/* پنل نقشه */}
      <section className="rounded-2xl border border-[#e4ece8] bg-white p-4 sm:p-5">
        {!isRouteMode ? (
          <div className="grid gap-3 text-center sm:grid-cols-3">
            <div className="rounded-xl bg-[#f7faf8] px-3 py-3">
              <p className="text-[11px] text-[#7b8a84]">موقعیت در حال تنظیم:</p>
              <p className="mt-1 text-xs font-bold text-[#1e3f36]">
                محل انجام کار
              </p>
            </div>

            <div className="rounded-xl bg-[#f7faf8] px-3 py-3">
              <p className="text-[11px] text-[#7b8a84]">مدل انتخاب فعال</p>
              <p className="mt-1 text-xs font-bold text-[#1e3f36]">
                انجام در محل ثابت
              </p>
            </div>

            <div className="rounded-xl bg-[#f7faf8] px-3 py-3">
              <p className="text-[11px] text-[#7b8a84]">
                شعاع حضور متخصصان محلی
              </p>
              <div className="mt-2">
                <select
                  value={data.locationRadiusMeters || "2000"}
                  onChange={(event) =>
                    onChange("locationRadiusMeters", event.target.value)
                  }
                  className="w-full rounded-xl border border-[#dce7e1] bg-white px-3 py-2 text-xs text-[#213a33] outline-none"
                >
                  {radiusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-[#f7faf8] px-3 py-3 text-center">
              <p className="text-[11px] text-[#7b8a84]">موقعیت در حال تنظیم:</p>
              <p className="mt-1 text-xs font-bold text-[#1e3f36]">
                {activeTargetTitle}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveRoutePoint("origin")}
              className={`rounded-xl border px-3 py-3 text-center transition ${
                activeRoutePoint === "origin"
                  ? "border-[#007563] bg-[#eaf5f1]"
                  : "border-[#e3ece7] bg-[#f7faf8]"
              }`}
            >
              <p className="text-[11px] text-[#7b8a84]">۱- نقطه مبدا</p>
              <p className="mt-1 text-xs font-bold text-[#1e3f36]">
                محل سرویس‌دهی
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveRoutePoint("destination")}
              className={`rounded-xl border px-3 py-3 text-center transition ${
                activeRoutePoint === "destination"
                  ? "border-[#007563] bg-[#eaf5f1]"
                  : "border-[#e3ece7] bg-[#f7faf8]"
              }`}
            >
              <p className="text-[11px] text-[#7b8a84]">۲- نقطه مقصد</p>
              <p className="mt-1 text-xs font-bold text-[#1e3f36]">
                تحویل‌گیرنده
              </p>
            </button>
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-2xl border border-[#dbe7e1] bg-[#eef4f0]">
          <div
            ref={mapElement}
            className="h-[300px] w-full sm:h-[360px]"
            aria-label="نقشه تعاملی انتخاب موقعیت"
          />

          {!mapLoaded && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[#6d7c75]">
              در حال بارگذاری نقشه...
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={locateMe}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-[#007563] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            <LocationIcon name="target" />
            {isRouteMode
              ? activeRoutePoint === "origin"
                ? "تثبیت و ثبت موقعیت مبدا"
                : "تثبیت و ثبت موقعیت مقصد"
              : "تثبیت و ثبت موقعیت"}
          </button>

          <p className="text-xs text-[#6b7c75]">
            {message ||
              "برای ثبت دقیق‌تر، نقطه مورد نظر را روی نقشه انتخاب یا جابه‌جا کنید."}
          </p>
        </div>
      </section>

      {/* خلاصه آدرس‌ها */}
      {!isRouteMode ? (
        <div className="grid gap-4">
          <section className="rounded-2xl bg-[#f7faf8] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-[#007563]">
                <LocationIcon name="pin" />
              </span>

              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-[#174f46]">
                  موقعیت انتخاب شده با پین:
                </h3>
                <p className="mt-2 text-sm leading-7 text-[#30423b]">
                  {data.locationAddress || "هنوز موقعیتی ثبت نشده است."}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-[#f7faf8] p-4 sm:p-5">
            <label
              htmlFor="location-address"
              className="mb-2 block text-sm font-bold text-[#174f46]"
            >
              آدرس دقیق یا محدوده انجام کار (لوکیشن)
            </label>

            <input
              id="location-address"
              value={data.locationAddress}
              onChange={(event) =>
                onChange("locationAddress", event.target.value)
              }
              placeholder="تهران، خیابان سهروردی شمالی، نبش کوچه نسترن"
              className="w-full rounded-xl border border-[#dce7e1] bg-white px-4 py-3 text-sm outline-none focus:border-[#007563]"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#7b8a84]">
              <span>GPS</span>
              <span>
                {fixedSelected
                  ? `${data.locationLatitude} ، ${data.locationLongitude}`
                  : "هنوز ثبت نشده"}
              </span>
            </div>
          </section>
        </div>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-[#f7faf8] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-[#007563]">
                <LocationIcon name="pin" />
              </span>

              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-[#174f46]">
                  آدرس مبدا (محل شروع / تحویل کالا)
                </h3>

                <input
                  value={data.originAddress}
                  onChange={(event) =>
                    onChange("originAddress", event.target.value)
                  }
                  placeholder="تهران، خیابان سهروردی شمالی، نبش کوچه نسترن"
                  className="mt-3 w-full rounded-xl border border-[#dce7e1] bg-white px-4 py-3 text-sm outline-none focus:border-[#007563]"
                />

                <p className="mt-3 text-xs text-[#7b8a84]">
                  {originSelected
                    ? `${data.originLatitude} ، ${data.originLongitude}`
                    : "هنوز ثبت نشده"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#f7faf8] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-[#d88520]">
                <LocationIcon name="flag" />
              </span>

              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-[#174f46]">
                  آدرس مقصد (نقطه پایان / تحویل‌گیرنده)
                </h3>

                <input
                  value={data.destinationAddress}
                  onChange={(event) =>
                    onChange("destinationAddress", event.target.value)
                  }
                  placeholder="تهران، خیابان سهروردی شمالی، خیابان خواجه عبدالله انصاری"
                  className="mt-3 w-full rounded-xl border border-[#dce7e1] bg-white px-4 py-3 text-sm outline-none focus:border-[#007563]"
                />

                <p className="mt-3 text-xs text-[#7b8a84]">
                  {destinationSelected
                    ? `${data.destinationLatitude} ، ${data.destinationLongitude}`
                    : "هنوز ثبت نشده"}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* اطلاعات محرمانه */}
      <section className="rounded-2xl bg-[#f7faf8] p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[#174f46]">
          <LocationIcon name="lock" />
          پلاک، طبقه و واحد اختصاصی (کاملاً محرمانه)
        </h3>

        <p className="mt-2 text-xs leading-6 text-[#84918b]">
          این اطلاعات فقط با پذیرش نهایی و برای هماهنگی با مجری استفاده می‌شود و
          به‌صورت عمومی نمایش داده نخواهد شد.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block text-xs text-[#65766e]">
            پلاک محل کار / ساختمان
            <input
              value={data.locationBuilding}
              onChange={(event) =>
                onChange("locationBuilding", event.target.value)
              }
              placeholder="مثلاً پلاک ۲۴"
              className="mt-2 w-full rounded-xl border border-[#dce7e1] bg-white px-3 py-3 text-sm outline-none focus:border-[#007563]"
            />
          </label>

          <label className="block text-xs text-[#65766e]">
            واحد / طبقه
            <input
              value={data.locationUnit}
              onChange={(event) => onChange("locationUnit", event.target.value)}
              placeholder="مثلاً طبقه ۳، واحد ۸"
              className="mt-2 w-full rounded-xl border border-[#dce7e1] bg-white px-3 py-3 text-sm outline-none focus:border-[#007563]"
            />
          </label>

          <label className="block text-xs text-[#65766e]">
            توضیح تحویل‌گیرنده
            <input
              value={data.locationDeliveryNotes}
              onChange={(event) =>
                onChange("locationDeliveryNotes", event.target.value)
              }
              placeholder="مثلاً فقط پس از زنگ درب وارد شود"
              className="mt-2 w-full rounded-xl border border-[#dce7e1] bg-white px-3 py-3 text-sm outline-none focus:border-[#007563]"
            />
          </label>
        </div>
      </section>
    </div>
  );
}
