import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, ClipboardList, Map as MapIcon, Satellite, Mountain } from 'lucide-react';
import { useMapPoints } from '../../hooks/useMapPoints';
import { formatDateTime } from '../../utils/formatters';
import type { IncidentSeverity } from '../../types';

// Approximate center of Palamu Tiger Reserve, Jharkhand.
const PTR_CENTER: [number, number] = [23.87, 84.19];

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
  const { incidents, patrolPoints, loading } = useMapPoints();
  const [showIncidents, setShowIncidents] = useState(true);
  const [showPatrols, setShowPatrols] = useState(true);
  const [layer, setLayer] = useState<LayerId>('street');
  const mapRef = useRef<LeafletMap | null>(null);

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
      <div>
        <h1 className="text-2xl font-bold text-ptr-brown tracking-tight">Field Map</h1>
        <p className="text-sm text-ptr-brown-light">
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
      </div>

      <div className="card overflow-hidden relative" style={{ height: '65vh', isolation: 'isolate' }}>
        {/* Google Maps-style base-layer switcher */}
        <div className="absolute top-3 right-3 z-[1000] bg-white rounded-xl shadow-md border border-ptr-cream-dark p-1 flex gap-0.5">
          {(Object.keys(MAP_LAYERS) as LayerId[]).map((id) => {
            const opt = MAP_LAYERS[id];
            const Icon = opt.icon;
            return (
              <button
                key={id}
                onClick={() => setLayer(id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
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

        <MapContainer ref={mapRef} center={PTR_CENTER} zoom={10} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            key={layer}
            attribution={MAP_LAYERS[layer].attribution}
            url={MAP_LAYERS[layer].url}
            maxZoom={MAP_LAYERS[layer].maxZoom}
          />

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
        </MapContainer>
      </div>
    </div>
  );
}
