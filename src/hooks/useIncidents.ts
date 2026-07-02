import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mapIncident } from '../lib/mappers';
import { getCurrentPosition } from '../utils/geolocation';
import useStore from '../store/useStore';
import type { Incident, IncidentType, IncidentSeverity } from '../types';

type CreateIncidentData = {
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  rangeId: string;
  areaId?: string;
};

export function useIncidents() {
  const queryClient = useQueryClient();
  const currentUser = useStore((s) => s.currentUser);

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['incidents'],
    queryFn: async (): Promise<Incident[]> => {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .order('incident_date', { ascending: false });
      if (error) throw error;
      return data.map(mapIncident);
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
    mutationFn: async (data: CreateIncidentData) => {
      if (!currentUser) throw new Error('Not authenticated');
      const position = await getCurrentPosition();
      const { error } = await supabase.from('incidents').insert({
        type: data.type,
        severity: data.severity,
        description: data.description,
        range_id: data.rangeId,
        area_id: data.areaId ?? null,
        reported_by: currentUser.id,
        lat: position?.lat ?? null,
        lng: position?.lng ?? null,
      });
      if (error) throw error;
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

  return { incidents, isLoading, reportIncident, deleteIncident };
}
