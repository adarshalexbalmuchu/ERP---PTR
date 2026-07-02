import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, ClipboardList } from 'lucide-react';
import { useMapPoints } from '../../hooks/useMapPoints';
import { formatDateTime } from '../../utils/formatters';
import type { IncidentSeverity } from '../../types';

// Approximate center of Palamu Tiger Reserve, Jharkhand.
const PTR_CENTER: [number, number] = [23.87, 84.19];

const SEVERITY_COLOR: Record<IncidentSeverity, string> = {
  Low: '#9CA3AF',
  Medium: '#F59E0B',
  High: '#EA580C',
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
        <h1 className="text-xl font-bold text-ptr-brown">Field Map</h1>
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

      <div className="card overflow-hidden" style={{ height: '65vh', isolation: 'isolate' }}>
        <MapContainer ref={mapRef} center={PTR_CENTER} zoom={10} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
