import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mapIncident } from '../lib/mappers';
import { uploadIncidentPhoto } from '../lib/incidentPhotos';
import { getCurrentPosition, describeGeolocationFailure } from '../utils/geolocation';
import { verifyAffectedRows, type VerifyAffectedRowsResult } from '../lib/mutationVerification';
import { getErrorMessage } from '../lib/errors';
import useStore from '../store/useStore';
import type { Incident, IncidentType, IncidentSeverity, IncidentStatus } from '../types';

type CreateIncidentData = {
  type: IncidentType;
  typeOther?: string;
  severity: IncidentSeverity;
  description: string;
  rangeId: string;
  areaId?: string;
};

const PHOTO_URL_TTL_SECONDS = 3600;

// incident_photos.path stores the bare storage path (the bucket is
// private); this swaps in time-limited signed URLs before the incidents
// reach the UI, same approach used for task attachments. One signed-url
// request across every photo in the list, not one per incident — the
// Storage API already batches by path, so looping per-incident here would
// just turn a single round trip into N.
export async function resolveIncidentPhotoUrls(incidents: Incident[]): Promise<Incident[]> {
  const allPaths = incidents.flatMap((i) => i.photos.map((p) => p.path));
  if (allPaths.length === 0) return incidents;
  const { data } = await supabase.storage
    .from('incident-photos')
    .createSignedUrls(allPaths, PHOTO_URL_TTL_SECONDS);
  const signedByPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return incidents.map((incident) => ({
    ...incident,
    photos: incident.photos.map((p) => ({ ...p, url: signedByPath.get(p.path) ?? p.url })),
  }));
}

export function useIncidents() {
  const queryClient = useQueryClient();
  const currentUser = useStore((s) => s.currentUser);

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['incidents'],
    queryFn: async (): Promise<Incident[]> => {
      const { data, error } = await supabase
        .from('incidents')
        .select('*, incident_photos(*), profiles!incidents_reported_by_fkey(name), assignee:profiles!incidents_assigned_to_fkey(name)')
        .order('incident_date', { ascending: false });
      if (error) throw error;
      return resolveIncidentPhotoUrls(data.map(mapIncident));
    },
  });

  // Realtime — unique topic per mount avoids reusing a channel still
  // mid-teardown from a previous mount.
  const channelId = useRef(crypto.randomUUID()).current;
  useEffect(() => {
    const channel = supabase
      .channel(`incidents-list-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['incidents'] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient, channelId]);

  const reportIncident = useMutation({
    mutationFn: async ({ files, ...data }: CreateIncidentData & { files: File[] }) => {
      if (!currentUser) throw new Error('Not authenticated');
      // Location is mandatory for incident reports (unlike task-update
      // geotagging, which stays best-effort) — a report with no coordinates
      // can't be placed on the map or matched to a range/beat with
      // confidence, so we refuse to save one rather than insert nulls.
      const { coords, failureReason } = await getCurrentPosition();
      if (!coords) throw new Error(describeGeolocationFailure(failureReason ?? 'position_unavailable'));
      const { data: row, error } = await supabase
        .from('incidents')
        .insert({
          type: data.type,
          type_other: data.typeOther ?? null,
          severity: data.severity,
          description: data.description,
          range_id: data.rangeId,
          area_id: data.areaId ?? null,
          reported_by: currentUser.id,
          lat: coords.lat,
          lng: coords.lng,
        })
        .select()
        .single();
      if (error) throw error;

      const failures: string[] = [];
      for (const file of files) {
        try {
          await uploadIncidentPhoto(row.id, currentUser.id, file);
        } catch (err) {
          failures.push(getErrorMessage(err, `Failed to upload "${file.name}"`));
        }
      }
      if (failures.length > 0) throw new Error(failures.join('; '));
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['incidents'] }),
  });

  const removePhoto = useMutation({
    mutationFn: async (photoId: string) => {
      const incident = incidents.find((i) => i.photos.some((p) => p.id === photoId));
      const photo = incident?.photos.find((p) => p.id === photoId);
      const { error } = await supabase.from('incident_photos').delete().eq('id', photoId);
      if (error) throw error;
      if (photo?.path) {
        await supabase.storage.from('incident-photos').remove([photo.path]);
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['incidents'] }),
  });

  const deleteIncident = useMutation({
    mutationFn: async (incidentId: string) => {
      const { error } = await supabase.from('incidents').delete().eq('id', incidentId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['incidents'] }),
  });

  // `.select('id')` is what makes this trustworthy: a bare `.update().in()`
  // reports success even when RLS silently drops every row (0 matched, no
  // Postgres error) — asking for the ids actually written is the only way
  // to tell "nothing changed" from "everything changed".
  const assignIncidents = useMutation({
    mutationFn: async ({ ids, userId }: { ids: string[]; userId: string }): Promise<VerifyAffectedRowsResult> => {
      const { data, error } = await supabase
        .from('incidents')
        .update({ assigned_to: userId, assigned_at: new Date().toISOString() })
        .in('id', ids)
        .select('id');
      if (error) throw error;
      return verifyAffectedRows({ requestedIds: ids, returnedRows: data, entityName: 'incident-assign' });
    },
    onSuccess: (result) => { if (result.updatedIds.length > 0) void queryClient.invalidateQueries({ queryKey: ['incidents'] }); },
  });

  const changeSeverity = useMutation({
    mutationFn: async ({ ids, severity }: { ids: string[]; severity: IncidentSeverity }): Promise<VerifyAffectedRowsResult> => {
      const { data, error } = await supabase.from('incidents').update({ severity }).in('id', ids).select('id');
      if (error) throw error;
      return verifyAffectedRows({ requestedIds: ids, returnedRows: data, entityName: 'incident-severity' });
    },
    onSuccess: (result) => { if (result.updatedIds.length > 0) void queryClient.invalidateQueries({ queryKey: ['incidents'] }); },
  });

  const setStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: IncidentStatus }): Promise<VerifyAffectedRowsResult> => {
      const { data, error } = await supabase
        .from('incidents')
        .update({ status, resolved_at: status === 'Resolved' ? new Date().toISOString() : null })
        .in('id', ids)
        .select('id');
      if (error) throw error;
      return verifyAffectedRows({ requestedIds: ids, returnedRows: data, entityName: 'incident-status' });
    },
    onSuccess: (result) => { if (result.updatedIds.length > 0) void queryClient.invalidateQueries({ queryKey: ['incidents'] }); },
  });

  return { incidents, isLoading, reportIncident, deleteIncident, removePhoto, assignIncidents, changeSeverity, setStatus };
}
