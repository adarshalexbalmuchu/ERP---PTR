import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, ClipboardList, Map as MapIcon, Satellite, Mountain, LocateFixed, RadioTower } from 'lucide-react';
import { useMapPoints } from '../../hooks/useMapPoints';
import { useLiveLocations, STALE_AFTER_MS } from '../../hooks/useLiveLocation';
import useStore from '../../store/useStore';
import { formatDateTime, formatRelative } from '../../utils/formatters';
import type { Coords } from '../../utils/geolocation';
import type { IncidentSeverity } from '../../types';

// Approximate center of Palamu Tiger Reserve, Jharkhand.
const PTR_CENTER: [number, number] = [23.87, 84.19];
const USER_LOCATION_ZOOM = 14;

// Base-map choices, Google Maps-style (Street / Satellite / Terrain) but
// backed by free, key-less tile providers — true Google Maps tiles require
// a billed Google Cloud API key, which this project intentionally avoids.
type LayerId = 'street' | 'satellite' | 'terrain';

const MAP_LAYERS: Record<LayerId, { label: string; icon: typeof MapIcon; url: string; attribution: string; maxZoom: number }> = {
  street: {
    label: 'Street',
    icon: MapIcon,
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
  satellite: {
    label: 'Satellite',
    icon: Satellite,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  terrain: {
    label: 'Terrain',
    icon: Mountain,
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM &middot; Style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
  },
};

// A muted, earthy severity gradient (gray → bronze → rust → red) instead
// of bright saturated hues — reads as escalating urgency without turning
// the map into a rainbow of pins.
const SEVERITY_COLOR: Record<IncidentSeverity, string> = {
  Low: '#9CA3AF',
  Medium: '#8A7F5C',
  High: '#A8551E',
  Critical: '#DC2626',
};

const TYPE_LABELS: Record<string, string> = {
  human_attack: 'Attack on Human',
  livestock_attack: 'Livestock Attack',
  crop_damage: 'Crop Damage',
  property_damage: 'Property Damage',
  poaching_sign: 'Poaching Sign',
  wildlife_sighting: 'Wildlife Sighting',
  other: 'Other',
};

export default function MapView() {
  const currentUser = useStore((s) => s.currentUser);
  const canSeeLiveLocations = currentUser?.role === 'director' || currentUser?.role === 'range_officer';
  const { incidents, patrolPoints, loading } = useMapPoints();
  const { locations: liveLocations } = useLiveLocations();
  const [showIncidents, setShowIncidents] = useState(true);
  const [showPatrols, setShowPatrols] = useState(true);
  const [showLive, setShowLive] = useState(true);
  const [layer, setLayer] = useState<LayerId>('street');
  const [myLocation, setMyLocation] = useState<Coords | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);
  const hasCenteredOnUser = useRef(false);

  const flyToUser = (coords: Coords, zoom = USER_LOCATION_ZOOM) => {
    mapRef.current?.flyTo([coords.lat, coords.lng], zoom, { duration: 1.2 });
  };

  const locateMe = () => {
    if (!('geolocation' in navigator)) { setLocationDenied(true); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLocation(coords);
        setLocationDenied(false);
        flyToUser(coords);
      },
      () => setLocationDenied(true),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  };

  // Open the map centered on the ranger's live location (falls back silently
  // to the reserve-wide view if permission is denied/unavailable), then keep
  // the blue "you are here" dot live-updating like Google Maps.
  useEffect(() => {
    if (!('geolocation' in navigator)) { setLocationDenied(true); return; }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLocation(coords);
        setLocationDenied(false);
        if (!hasCenteredOnUser.current) {
          hasCenteredOnUser.current = true;
          flyToUser(coords);
        }
      },
      () => setLocationDenied(true),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Explicit teardown as a safety net: Leaflet's zoom-control panes use
  // z-index up to 1000 (higher than our own modals/dropdowns). If the map
  // instance isn't fully destroyed on unmount, its leftover DOM can render
  // on top of whatever page you navigate to next.
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
    };
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="border-b border-ptr-brown/10 pb-4">
        <h1 className="text-lg md:text-xl font-bold text-ptr-brown uppercase tracking-[0.06em]">Field Map</h1>
        <p className="text-[13px] text-ptr-brown-light mt-1">
          Geotagged incidents and patrol activity {loading && '· loading…'}
        </p>
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-ptr-brown cursor-pointer select-none">
          <input type="checkbox" checked={showIncidents} onChange={(e) => setShowIncidents(e.target.checked)} className="accent-red-600" />
          <AlertTriangle className="w-4 h-4 text-red-600" />
          Incidents ({incidents.length})
        </label>
        <label className="flex items-center gap-2 text-sm text-ptr-brown cursor-pointer select-none">
          <input type="checkbox" checked={showPatrols} onChange={(e) => setShowPatrols(e.target.checked)} className="accent-ptr-green" />
          <ClipboardList className="w-4 h-4 text-ptr-green" />
          Patrol updates ({patrolPoints.length})
        </label>
        {canSeeLiveLocations && (
          <label className="flex items-center gap-2 text-sm text-ptr-brown cursor-pointer select-none">
            <input type="checkbox" checked={showLive} onChange={(e) => setShowLive(e.target.checked)} className="accent-blue-600" />
            <RadioTower className="w-4 h-4 text-blue-600" />
            Staff on patrol ({liveLocations.length})
          </label>
        )}
      </div>

      <div className="card overflow-hidden relative" style={{ height: '65vh', isolation: 'isolate' }}>
        {/* Google Maps-style base-layer switcher */}
        <div className="absolute top-3 right-3 z-[1000] bg-white rounded-xl shadow-md border border-ptr-cream-dark p-1 flex gap-1">
          {(Object.keys(MAP_LAYERS) as LayerId[]).map((id) => {
            const opt = MAP_LAYERS[id];
            const Icon = opt.icon;
            return (
              <button
                key={id}
                onClick={() => setLayer(id)}
                className={`flex items-center justify-center gap-1.5 min-w-[40px] min-h-[40px] px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  layer === id ? 'bg-ptr-green text-white' : 'text-ptr-brown-light hover:bg-ptr-cream'
                }`}
                title={opt.label}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Locate me — re-centers on live GPS position, Google Maps-style */}
        <button
          onClick={locateMe}
          title={locationDenied ? 'Location unavailable — check permissions' : 'Center on my location'}
          className="absolute bottom-4 right-3 z-[1000] w-10 h-10 rounded-full bg-white shadow-md border border-ptr-cream-dark flex items-center justify-center hover:bg-ptr-cream transition-colors"
        >
          <LocateFixed className={`w-5 h-5 ${locationDenied ? 'text-ptr-brown-light/50' : 'text-ptr-green'}`} />
        </button>

        <MapContainer ref={mapRef} center={PTR_CENTER} zoom={10} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            key={layer}
            attribution={MAP_LAYERS[layer].attribution}
            url={MAP_LAYERS[layer].url}
            maxZoom={MAP_LAYERS[layer].maxZoom}
          />

          {myLocation && (
            <>
              {/* Soft accuracy halo */}
              <CircleMarker
                center={[myLocation.lat, myLocation.lng]}
                radius={16}
                pathOptions={{ color: '#2563EB', weight: 0, fillColor: '#2563EB', fillOpacity: 0.15 }}
              />
              {/* Solid "you are here" dot, Google Maps-style */}
              <CircleMarker
                center={[myLocation.lat, myLocation.lng]}
                radius={7}
                pathOptions={{ color: '#FFFFFF', weight: 2, fillColor: '#2563EB', fillOpacity: 1 }}
              >
                <Popup>Your location</Popup>
              </CircleMarker>
            </>
          )}

          {showIncidents && incidents.map((incident) => (
            incident.lat !== undefined && incident.lng !== undefined && (
              <CircleMarker
                key={incident.id}
                center={[incident.lat, incident.lng]}
                radius={8}
                pathOptions={{
                  color: SEVERITY_COLOR[incident.severity],
                  fillColor: SEVERITY_COLOR[incident.severity],
                  fillOpacity: 0.8,
                }}
              >
                <Popup>
                  <div className="text-xs space-y-1">
                    <div className="font-semibold">{TYPE_LABELS[incident.type] ?? incident.type}</div>
                    <div className="text-ptr-brown-light">{incident.severity} severity</div>
                    <div>{incident.description}</div>
                    <div className="text-ptr-brown-light">{formatDateTime(incident.incidentDate)}</div>
                  </div>
                </Popup>
              </CircleMarker>
            )
          ))}

          {showPatrols && patrolPoints.map((point) => (
            <CircleMarker
              key={point.id}
              center={[point.lat, point.lng]}
              radius={6}
              pathOptions={{ color: '#1A4731', fillColor: '#1A4731', fillOpacity: 0.7 }}
            >
              <Popup>
                <div className="text-xs space-y-1">
                  <div className="font-semibold">{point.taskTitle}</div>
                  <div>{point.note}</div>
                  <div className="text-ptr-brown-light">{point.progressPercentage}% · {formatDateTime(point.createdAt)}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {showLive && liveLocations.map((loc) => {
            const isStale = Date.now() - new Date(loc.updatedAt).getTime() > STALE_AFTER_MS;
            return (
              <CircleMarker
                key={loc.userId}
                center={[loc.lat, loc.lng]}
                radius={8}
                pathOptions={{
                  color: '#2563EB',
                  weight: 2,
                  fillColor: '#2563EB',
                  fillOpacity: isStale ? 0.3 : 0.85,
                }}
              >
                <Popup>
                  <div className="text-xs space-y-1">
                    <div className="font-semibold">{loc.userName}</div>
                    <div className="text-ptr-brown-light">{loc.designation}</div>
                    <div>{loc.taskTitle}</div>
                    <div className="text-ptr-brown-light">
                      {isStale ? 'Last known location · ' : 'Live · '}
                      {formatRelative(loc.updatedAt)}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
