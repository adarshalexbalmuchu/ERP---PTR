import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from 'react-leaflet';
import type { Map as LeafletMap, LatLng } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Map as MapIcon, Satellite, Mountain, LocateFixed, Layers, AlertTriangle,
  ClipboardList, ChevronUp, Target, Plus, MapPinOff, RefreshCw, Navigation,
} from 'lucide-react';
import { useMapPoints } from '../../hooks/useMapPoints';
import { useLiveLocations, FRESH_AFTER_MS, STALE_AFTER_MS } from '../../hooks/useLiveLocation';
import { useRanges } from '../../hooks/useRanges';
import { useOfficerRanges } from '../../hooks/useOfficerRanges';
import useStore from '../../store/useStore';
import IncidentWizard from '../../components/mobile/IncidentWizard';
import { formatDateTime, formatRelative } from '../../utils/formatters';
import { getCurrentPosition, type Coords, type GeolocationFailureReason } from '../../utils/geolocation';
import { haversineKm, formatDistanceKm, isLowAccuracy } from '../../utils/distance';
import { formatIncidentType, SEVERITY_COLOR } from '../../lib/incidentTypes';

const PTR_CENTER: [number, number] = [23.87, 84.19];

type LayerId = 'street' | 'satellite' | 'terrain';
const MAP_LAYERS: Record<LayerId, { label: string; icon: typeof MapIcon; url: string; attribution: string; maxZoom: number }> = {
  street: { label: 'Street', icon: MapIcon, url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 20 },
  satellite: { label: 'Satellite', icon: Satellite, url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Imagery &copy; Esri', maxZoom: 19 },
  terrain: { label: 'Terrain', icon: Mountain, url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: 'Map data &copy; OpenStreetMap, SRTM', maxZoom: 17 },
};
type LocationState =
  | { status: 'locating' }
  | { status: 'unavailable'; reason: GeolocationFailureReason }
  | { status: 'low-accuracy'; coords: Coords }
  | { status: 'available'; coords: Coords };

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
  const [locationState, setLocationState] = useState<LocationState>({ status: 'locating' });
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [tapPoint, setTapPoint] = useState<Coords | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);

  const applyFix = (coords: Coords) => setLocationState(isLowAccuracy(coords.accuracy) ? { status: 'low-accuracy', coords } : { status: 'available', coords });
  const myLocation = locationState.status === 'available' || locationState.status === 'low-accuracy' ? locationState.coords : null;

  useEffect(() => {
    if (!('geolocation' in navigator)) { setLocationState({ status: 'unavailable', reason: 'unsupported' }); return; }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => applyFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => setLocationState({
        status: 'unavailable',
        reason: err.code === err.PERMISSION_DENIED ? 'permission_denied' : err.code === err.TIMEOUT ? 'timeout' : 'position_unavailable',
      }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);
  useEffect(() => () => { mapRef.current?.remove(); }, []);

  const locateMe = async () => {
    setLocationState({ status: 'locating' });
    const { coords, failureReason } = await getCurrentPosition(10_000);
    if (coords) {
      applyFix(coords);
      mapRef.current?.flyTo([coords.lat, coords.lng], 14, { duration: 1 });
    } else {
      setLocationState({ status: 'unavailable', reason: failureReason ?? 'position_unavailable' });
    }
  };

  // Nearby list: incidents + patrol points, sorted by distance from the
  // ranger's real device location. Falls back to a manually tapped map
  // point, then the reserve centre — but only the first case is ever
  // labelled "nearby"; the others say plainly what they're measuring from
  // so a bad or missing fix can never masquerade as "you are here".
  const usingDeviceLocation = myLocation !== null;
  const origin = myLocation ?? tapPoint ?? { lat: PTR_CENTER[0], lng: PTR_CENTER[1] };
  const distanceLabel = usingDeviceLocation ? 'nearby' : tapPoint ? 'from selected point' : 'from reserve centre';
  const nearbyIncidents = incidents
    .filter((i) => i.lat !== undefined && i.lng !== undefined)
    .map((i) => ({ kind: 'incident' as const, id: i.id, title: formatIncidentType(i), sub: `${i.severity} · ${formatRelative(i.incidentDate)}`, lat: i.lat!, lng: i.lng!, distanceKm: haversineKm(origin, { lat: i.lat!, lng: i.lng! }) }));
  const nearbyPatrols = patrolPoints
    .map((p) => ({ kind: 'task' as const, id: p.id, title: p.taskTitle, sub: `${p.progressPercentage}% · ${formatRelative(p.createdAt)}`, lat: p.lat, lng: p.lng, distanceKm: haversineKm(origin, p) }));
  const nearby = [...nearbyIncidents, ...nearbyPatrols]
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
    .slice(0, 30);

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
            <Popup>
              <div className="text-xs space-y-1.5 min-w-[140px]">
                <div className="font-semibold">{formatIncidentType(i)}</div>
                <div>{i.severity} severity</div>
                <div>{formatDateTime(i.incidentDate)}</div>
                <button
                  onClick={() => flyTo(i.lat!, i.lng!)}
                  className="w-full flex items-center justify-center gap-1 h-7 rounded bg-n-20 text-n-90 font-medium mt-1"
                >
                  <Target className="w-3 h-3" />Centre map
                </button>
              </div>
            </Popup>
          </CircleMarker>
        ))}
        {patrolPoints.map((p) => (
          <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={6} pathOptions={{ color: '#1A4731', fillColor: '#1A4731', fillOpacity: 0.7 }}>
            <Popup>
              <div className="text-xs space-y-1.5 min-w-[140px]">
                <div className="font-semibold">{p.taskTitle}</div>
                <div>{p.progressPercentage}% · {formatDateTime(p.createdAt)}</div>
                <button
                  onClick={() => flyTo(p.lat, p.lng)}
                  className="w-full flex items-center justify-center gap-1 h-7 rounded bg-n-20 text-n-90 font-medium mt-1"
                >
                  <Target className="w-3 h-3" />Centre map
                </button>
              </div>
            </Popup>
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
        <button onClick={() => setLayerOpen((v) => !v)} className="w-11 h-11 rounded-full bg-white shadow-pop border border-n-30 flex items-center justify-center text-n-90 active:bg-n-10" aria-label="Map layers" aria-haspopup="menu" aria-expanded={layerOpen}><Layers className="w-5 h-5" /></button>
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
      <button onClick={locateMe} className="absolute right-3 z-[1000] w-11 h-11 rounded-full bg-white shadow-pop border border-n-30 flex items-center justify-center text-ptr-green active:bg-n-10" style={{ bottom: 'calc(30dvh + 12px)' }} aria-label="Find my location">
        {locationState.status === 'locating' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <LocateFixed className="w-5 h-5" />}
      </button>

      {/* Report incident here — appears once a point is long-pressed */}
      {tapPoint && (
        <div className="absolute left-3 right-3 z-[1000]" style={{ bottom: 'calc(30dvh + 12px)' }}>
          <button onClick={() => setWizardOpen(true)} className="w-full h-12 bg-ptr-green text-white rounded font-semibold text-[15px] flex items-center justify-center gap-2 shadow-pop active:bg-ptr-green-dark">
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
            {nearby.length} {usingDeviceLocation ? 'nearby' : `results · ${distanceLabel}`} {myRange ? `· ${myRange.name}` : ''}
          </span>
          {locationState.status === 'low-accuracy' && (
            <span className="text-[11px] text-signal-amber mt-0.5 px-4">Location signal is imprecise — distances may be approximate</span>
          )}
        </button>
        <div className="overflow-y-auto px-4" style={{ height: 'calc(100% - 44px)' }}>
          {locationState.status === 'unavailable' && !tapPoint ? (
            <div className="flex flex-col items-center text-center py-4">
              <MapPinOff className="w-6 h-6 text-n-60 mb-1.5" />
              <p className="text-13 font-semibold text-n-100">Location unavailable</p>
              <p className="text-xs text-n-70 mt-0.5 max-w-[240px]">Enable location access to calculate nearby incidents.</p>
              <div className="flex gap-2 mt-2.5">
                <button onClick={locateMe} className="btn-secondary h-9 text-13">Retry</button>
                {locationState.reason === 'permission_denied' && (
                  <a href="#" onClick={(e) => { e.preventDefault(); locateMe(); }} className="btn-primary h-9 text-13 flex items-center px-3">Enable location</a>
                )}
              </div>
              {nearby.length > 0 && <p className="text-xs text-n-70 mt-3">Showing distances from the reserve centre instead.</p>}
            </div>
          ) : nearby.length === 0 ? (
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
                    <div className="text-xs text-n-70">{n.sub} · {formatDistanceKm(n.distanceKm)} {usingDeviceLocation ? 'away' : distanceLabel}</div>
                  </div>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${n.lat},${n.lng}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-9 h-9 flex items-center justify-center rounded-full bg-n-10 text-ptr-accent flex-shrink-0" aria-label={`Get directions to ${n.title}`}>
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
          className="absolute right-3 z-[1000] w-14 h-14 rounded-full bg-ptr-green text-white shadow-pop flex items-center justify-center active:bg-ptr-green-dark"
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
