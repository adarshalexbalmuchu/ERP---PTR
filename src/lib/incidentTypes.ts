import type { IncidentSeverity, IncidentType } from '../types';

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
      { type: 'conflict_other', label: 'Other' },
    ],
  },
  {
    id: 'protection',
    label: 'Protection',
    options: [
      { type: 'poaching_sign', label: 'Poaching Sign' },
      { type: 'road_kill', label: 'Road Kill' },
      { type: 'animal_injury', label: 'Animal Injury' },
      { type: 'tree_felling', label: 'Illegal Tree Felling' },
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

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = INCIDENT_CATEGORIES.reduce(
  (acc, group) => {
    for (const opt of group.options) acc[opt.type] = opt.label;
    return acc;
  },
  {} as Record<IncidentType, string>,
);

// The per-category "Other" catch-alls — selecting one of these prompts for
// a free-text label (Incident.typeOther) since the fixed subcategories
// don't cover it.
export const OTHER_INCIDENT_TYPES: IncidentType[] = ['conflict_other', 'other', 'sighting_other'];
export function isOtherIncidentType(type: IncidentType): boolean {
  return OTHER_INCIDENT_TYPES.includes(type);
}

// Display label for an incident's type — "Other — <what the reporter typed>"
// when applicable, otherwise the fixed subcategory label.
export function formatIncidentType(incident: { type: IncidentType; typeOther?: string }): string {
  const label = INCIDENT_TYPE_LABELS[incident.type] ?? incident.type;
  return isOtherIncidentType(incident.type) && incident.typeOther
    ? `${label} — ${incident.typeOther}`
    : label;
}

// A muted, earthy severity gradient (gray → bronze → rust → red) instead
// of bright saturated hues — reads as escalating urgency without turning
// the map into a rainbow of pins. Shared by desktop and mobile map views.
export const SEVERITY_COLOR: Record<IncidentSeverity, string> = {
  Low: '#9CA3AF',
  Medium: '#8A7F5C',
  High: '#A8551E',
  Critical: '#DC2626',
};

export function isHighSeverity(severity: IncidentSeverity): boolean {
  return severity === 'High' || severity === 'Critical';
}
