import type { IncidentType } from '../types';

export type IncidentCategory = 'human_wildlife_conflict' | 'protection' | 'wildlife_sighting';

interface IncidentCategoryGroup {
  id: IncidentCategory;
  label: string;
  options: { type: IncidentType; label: string }[];
}

export const INCIDENT_CATEGORIES: IncidentCategoryGroup[] = [
  {
    id: 'human_wildlife_conflict',
    label: 'Human-Wildlife Conflict',
    options: [
      { type: 'human_attack', label: 'Attack on Human' },
      { type: 'livestock_attack', label: 'Livestock Attack' },
      { type: 'crop_damage', label: 'Crop Damage' },
      { type: 'property_damage', label: 'Property Damage' },
      { type: 'road_kill', label: 'Road Kill' },
      { type: 'conflict_other', label: 'Other' },
    ],
  },
  {
    id: 'protection',
    label: 'Protection',
    options: [
      { type: 'poaching_sign', label: 'Poaching Sign' },
      { type: 'other', label: 'Other' },
    ],
  },
  {
    id: 'wildlife_sighting',
    label: 'Wildlife Sighting',
    options: [
      { type: 'wildlife_sighting', label: 'Wildlife Sighting' },
      { type: 'sighting_other', label: 'Other' },
    ],
  },
];

export const INCIDENT_TYPES: IncidentType[] = INCIDENT_CATEGORIES.flatMap((g) => g.options.map((o) => o.type));

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = INCIDENT_CATEGORIES.reduce(
  (acc, group) => {
    for (const opt of group.options) acc[opt.type] = opt.label;
    return acc;
  },
  {} as Record<IncidentType, string>,
);
