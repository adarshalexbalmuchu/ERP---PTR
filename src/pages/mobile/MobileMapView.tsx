import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from 'react-leaflet';
import type { Map as LeafletMap, LatLng } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Map as MapIcon, Satellite, Mountain, LocateFixed, Layers, AlertTriangle,
  ClipboardList, ChevronUp, Navigation, Plus,
} from 'lucide-react';
import { useMapPoints } from '../../hooks/useMapPoints';
import { useLiveLocations, FRESH_AFTER_MS, STALE_AFTER_MS } from '../../hooks/useLiveLocation';
import { useRanges } from '../../hooks/useRanges';
import { useOfficerRanges } from '../../hooks/useOfficerRanges';
import useStore from '../../store/useStore';
import IncidentWizard from '../../components/mobile/IncidentWizard';
import { formatDateTime, formatRelative } from '../../utils/formatters';
import type { Coords } from '../../utils/geolocation';
import { formatIncidentType } from '../../lib/incidentTypes';
import type { IncidentSeverity } from '../../types';

const PTR_CENTER: [number, number] = [23.87, 84.19];

type LayerId = 'street' | 'satellite' | 'terrain';
const MAP_LAYERS: Record<LayerId, { label: string; icon: typeof MapIcon; url: string; attribution: string; maxZoom: number }> = {
  street: { label: 'Street', icon: MapIcon, url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 20 },
  satellite: { label: 'Satellite', icon: Satellite, url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Imagery &copy; Esri', maxZoom: 19 },
  terrain: { label: 'Terrain', icon: Mountain, url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: 'Map data &copy; OpenStreetMap, SRTM', maxZoom: 17 },
};
const SEVERITY_COLOR: Record<IncidentSeverity, string> = { Low: '#9CA3AF', Medium: '#8A7F5C', High: '#A8551E', Critical: '#DC2626' };

function haversineKm(a: Coords, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

// Captures long-press (touch) / long-click (mouse) on the map to pick a
// point for "report an incident here" — react-leaflet has no built-in
// long-press event, so this listens for a held pointerdown before any drag.
function LongPressCatcher({ onLongPress }: { onLongPress: (latlng: LatLng) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useMapEvents({
    mousedown: (e) => { timerRef.current = setTimeout(() => onLongPress(e.latlng), 550); },
    mouseup: () => { if (timerRef.current) clearTimeout(timerRef.current); },
    movestart: () => { if (timerRef.current) clearTimeout(timerRef.current); },
    dragstart: () => { if (timerRef.current) clearTimeout(timerRef.current); },
  });
  return null;
}

export default function MobileMapView() {
  const currentUser = useStore((s) => s.currentUser);
  const canSeeLive = currentUser?.role === 'director' || currentUser?.role === 'range_officer';
  const { incidents, patrolPoints } = useMapPoints();
  const { locations: liveLocations } = useLiveLocations();
  const { ranges } = useRanges();
  const { activeRangeId, rangeIds } = useOfficerRanges();

  const [layer, setLayer] = useState<LayerId>('street');
  const [layerOpen, setLayerOpen] = useState(false);
  const [myLocation, setMyLocation] = useState<Coords | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [tapPoint, setTapPoint] = useState<Coords | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);
  useEffect(() => () => { mapRef.current?.remove(); }, []);

  const locateMe = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setMyLocation(c);
      mapRef.current?.flyTo([c.lat, c.lng], 14, { duration: 1 });
    });
  };

  // Nearby list: incidents + patrol points, sorted by distance from the
  // ranger's current position (or the reserve centre if location isn't known).
  const origin = myLocation ?? { lat: PTR_CENTER[0], lng: PTR_CENTER[1] };
  const nearbyIncidents = incidents
    .filter((i) => i.lat !== undefined && i.lng !== undefined)
    .map((i) => ({ kind: 'incident' as const, id: i.id, title: formatIncidentType(i), sub: `${i.severity} · ${formatRelative(i.incidentDate)}`, lat: i.lat!, lng: i.lng!, distanceKm: haversineKm(origin, { lat: i.lat!, lng: i.lng! }) }));
  const nearbyPatrols = patrolPoints
    .map((p) => ({ kind: 'task' as const, id: p.id, title: p.taskTitle, sub: `${p.progressPercentage}% · ${formatRelative(p.createdAt)}`, lat: p.lat, lng: p.lng, distanceKm: haversineKm(origin, p) }));
  const nearby = [...nearbyIncidents, ...nearbyPatrols].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 30);

  const myRange = ranges.find((r) => r.id === activeRangeId);
  const canReport = true;

  const flyTo = (lat: number, lng: number) => { mapRef.current?.flyTo([lat, lng], 15, { duration: 0.8 }); setSheetExpanded(false); };

  return (
    <div className="fixed inset-0" style={{ top: 'calc(56px + env(safe-area-inset-top))', bottom: 'var(--ptr-bottom-nav-h)' }}>
      <MapContainer ref={mapRef} center={myLocation ? [myLocation.lat, myLocation.lng] : PTR_CENTER} zoom={myLocation ? 13 : 10} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer key={layer} attribution={MAP_LAYERS[layer].attribution} url={MAP_LAYERS[layer].url} maxZoom={MAP_LAYERS[layer].maxZoom} />
        <LongPressCatcher onLongPress={(latlng) => { setTapPoint({ lat: latlng.lat, lng: latlng.lng }); }} />

        {myLocation && (
          <>
            <CircleMarker center={[myLocation.lat, myLocation.lng]} radius={16} pathOptions={{ color: '#2563EB', weight: 0, fillColor: '#2563EB', fillOpacity: 0.15 }} />
            <CircleMarker center={[myLocation.lat, myLocation.lng]} radius={7} pathOptions={{ color: '#FFFFFF', weight: 2, fillColor: '#2563EB', fillOpacity: 1 }}><Popup>Your location</Popup></CircleMarker>
          </>
        )}
        {tapPoint && <CircleMarker center={[tapPoint.lat, tapPoint.lng]} radius={9} pathOptions={{ color: '#1A4731', weight: 2, fillColor: '#1A4731', fillOpacity: 0.3, dashArray: '4 3' }} />}

        {incidents.map((i) => i.lat !== undefined && i.lng !== undefined && (
          <CircleMarker key={i.id} center={[i.lat, i.lng]} radius={8} pathOptions={{ color: SEVERITY_COLOR[i.severity], fillColor: SEVERITY_COLOR[i.severity], fillOpacity: 0.85 }}>
            <Popup><div className="text-xs space-y-1"><div className="font-semibold">{formatIncidentType(i)}</div><div>{i.severity} severity</div><div>{formatDateTime(i.incidentDate)}</div></div></Popup>
          </CircleMarker>
        ))}
        {patrolPoints.map((p) => (
          <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={6} pathOptions={{ color: '#1A4731', fillColor: '#1A4731', fillOpacity: 0.7 }}>
            <Popup><div className="text-xs space-y-1"><div className="font-semibold">{p.taskTitle}</div><div>{p.progressPercentage}% · {formatDateTime(p.createdAt)}</div></div></Popup>
          </CircleMarker>
        ))}
        {canSeeLive && liveLocations.map((loc) => {
          const age = Date.now() - new Date(loc.updatedAt).getTime();
          const fresh = age <= FRESH_AFTER_MS ? 'live' : age <= STALE_AFTER_MS ? 'recent' : 'stale';
          const color = fresh === 'stale' ? '#9CA3AF' : '#2563EB';
          return (
            <CircleMarker key={loc.userId} center={[loc.lat, loc.lng]} radius={8} pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: fresh === 'live' ? 0.9 : 0.4 }}>
              <Popup><div className="text-xs space-y-1"><div className="font-semibold">{loc.userName}</div><div>{loc.taskTitle}</div></div></Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Layer switcher */}
      <div className="absolute top-3 right-3 z-[1000]">
        <button onClick={() => setLayerOpen((v) => !v)} className="w-11 h-11 rounded-full bg-white shadow-pop border border-n-30 flex items-center justify-center text-n-90"><Layers className="w-5 h-5" /></button>
        {layerOpen && (
          <div className="absolute top-12 right-0 bg-white rounded-md shadow-pop border border-n-30 p-1 flex flex-col gap-0.5 w-36">
            {(Object.keys(MAP_LAYERS) as LayerId[]).map((id) => {
              const Icon = MAP_LAYERS[id].icon;
              return (
                <button key={id} onClick={() => { setLayer(id); setLayerOpen(false); }} className={`flex items-center gap-2 h-10 px-2.5 rounded text-13 font-medium ${layer === id ? 'bg-ptr-green text-white' : 'text-n-90'}`}>
                  <Icon className="w-4 h-4" />{MAP_LAYERS[id].label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Locate me */}
      <button onClick={locateMe} className="absolute right-3 z-[1000] w-11 h-11 rounded-full bg-white shadow-pop border border-n-30 flex items-center justify-center text-ptr-green" style={{ bottom: 'calc(30dvh + 12px)' }}>
        <LocateFixed className="w-5 h-5" />
      </button>

      {/* Report incident here — appears once a point is long-pressed */}
      {tapPoint && (
        <div className="absolute left-3 right-3 z-[1000]" style={{ bottom: 'calc(30dvh + 12px)' }}>
          <button onClick={() => setWizardOpen(true)} className="w-full h-12 bg-signal-red text-white rounded font-semibold text-[15px] flex items-center justify-center gap-2 shadow-pop">
            <AlertTriangle className="w-4 h-4" />Report incident here
          </button>
        </div>
      )}

      {/* Bottom sheet: nearby tasks/incidents — collapsed peek / expanded list */}
      <div
        className="absolute left-0 right-0 bottom-0 bg-white rounded-t-xl shadow-pop transition-[height] duration-200 z-[1000]"
        style={{ height: sheetExpanded ? '55dvh' : '30dvh' }}
      >
        <button onClick={() => setSheetExpanded((v) => !v)} className="w-full flex flex-col items-center pt-2 pb-1">
          <span className="w-9 h-1 rounded-full bg-n-40 mb-2" aria-hidden="true" />
          <span className="flex items-center gap-1.5 text-13 font-semibold text-n-90 px-4">
            <ChevronUp className={`w-4 h-4 transition-transform ${sheetExpanded ? 'rotate-180' : ''}`} />
            {nearby.length} nearby {myRange ? `· ${myRange.name}` : ''}
          </span>
        </button>
        <div className="overflow-y-auto px-4" style={{ height: 'calc(100% - 44px)' }}>
          {nearby.length === 0 ? (
            <p className="text-13 text-n-70 py-4 text-center">No geotagged activity yet.</p>
          ) : (
            <div className="divide-y divide-n-20">
              {nearby.map((n) => (
                <button key={`${n.kind}-${n.id}`} onClick={() => flyTo(n.lat, n.lng)} className="w-full flex items-center gap-3 py-3 text-left">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${n.kind === 'incident' ? 'bg-signal-red-bg text-signal-red' : 'bg-ptr-green/10 text-ptr-green'}`}>
                    {n.kind === 'incident' ? <AlertTriangle className="w-3.5 h-3.5" /> : <ClipboardList className="w-3.5 h-3.5" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-13 font-medium text-n-100 truncate">{n.title}</div>
                    <div className="text-xs text-n-70">{n.sub} · {n.distanceKm < 1 ? `${Math.round(n.distanceKm * 1000)}m` : `${n.distanceKm.toFixed(1)}km`} away</div>
                  </div>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${n.lat},${n.lng}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-9 h-9 flex items-center justify-center rounded-full bg-n-10 text-ptr-accent flex-shrink-0" aria-label="Navigate">
                    <Navigation className="w-4 h-4" />
                  </a>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {canReport && !tapPoint && (
        <button
          onClick={() => { setTapPoint(origin); setWizardOpen(true); }}
          className="absolute right-3 z-[1000] w-14 h-14 rounded-full bg-signal-red text-white shadow-pop flex items-center justify-center"
          style={{ bottom: 'calc(30dvh + 68px)' }}
          aria-label="Report incident"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      <IncidentWizard
        isOpen={wizardOpen}
        onClose={() => { setWizardOpen(false); setTapPoint(null); }}
        defaultRangeId={activeRangeId || ranges[0]?.id || ''}
        lockRange={false}
        allowedRangeIds={rangeIds.length > 0 ? rangeIds : undefined}
        initialGps={tapPoint}
      />
    </div>
  );
}
