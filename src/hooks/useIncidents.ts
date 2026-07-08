import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mapIncident } from '../lib/mappers';
import { uploadIncidentPhoto } from '../lib/incidentPhotos';
import { getCurrentPosition } from '../utils/geolocation';
import useStore from '../store/useStore';
import type { Incident, IncidentType, IncidentSeverity } from '../types';

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
// private); this swaps in a time-limited signed URL before the incident
// reaches the UI, same approach used for task attachments.
async function resolveIncidentPhotoUrls(incident: Incident): Promise<Incident> {
  if (incident.photos.length === 0) return incident;
  const paths = incident.photos.map((p) => p.path);
  const { data } = await supabase.storage
    .from('incident-photos')
    .createSignedUrls(paths, PHOTO_URL_TTL_SECONDS);
  const signedByPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return {
    ...incident,
    photos: incident.photos.map((p) => ({ ...p, url: signedByPath.get(p.path) ?? p.url })),
  };
}

export function useIncidents() {
  const queryClient = useQueryClient();
  const currentUser = useStore((s) => s.currentUser);

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['incidents'],
    queryFn: async (): Promise<Incident[]> => {
      const { data, error } = await supabase
        .from('incidents')
        .select('*, incident_photos(*)')
        .order('incident_date', { ascending: false });
      if (error) throw error;
      return Promise.all(data.map((row) => resolveIncidentPhotoUrls(mapIncident(row))));
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
      const position = await getCurrentPosition();
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
          lat: position?.lat ?? null,
          lng: position?.lng ?? null,
        })
        .select()
        .single();
      if (error) throw error;

      const failures: string[] = [];
      for (const file of files) {
        try {
          await uploadIncidentPhoto(row.id, currentUser.id, file);
        } catch (err) {
          failures.push(err instanceof Error ? err.message : `Failed to upload "${file.name}"`);
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

  return { incidents, isLoading, reportIncident, deleteIncident, removePhoto };
}
