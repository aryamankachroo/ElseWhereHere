import type { QualityTagDef } from '@/types/api'

/**
 * The full catalog of qualities a user can confirm on the "Here's what we
 * picked up" screen. Tag `id`s are stable identifiers used for matching;
 * `label`s are the only thing shown to the user and may be reworded freely.
 */
export const QUALITY_TAG_CATALOG: QualityTagDef[] = [
  { id: 'calm', label: 'Calm settings', category: 'mood' },
  { id: 'lively', label: 'Lively atmosphere', category: 'mood' },
  { id: 'greenery', label: 'Greenery', category: 'setting' },
  { id: 'small-food-shops', label: 'Small food shops', category: 'food' },
  { id: 'linger', label: 'Places to linger', category: 'mood' },
  { id: 'art', label: 'Art', category: 'culture' },
  { id: 'independent-shops', label: 'Independent shops', category: 'culture' },
  { id: 'waterfront', label: 'Waterfront settings', category: 'setting' },
  { id: 'reading', label: 'Reading', category: 'mood' },
  { id: 'evening-activity', label: 'Evening activity', category: 'time' },
]

export function getTagLabel(tagId: string): string {
  return QUALITY_TAG_CATALOG.find((t) => t.id === tagId)?.label ?? tagId
}
