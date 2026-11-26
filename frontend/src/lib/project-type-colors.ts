import { useEffect, useState, type CSSProperties } from 'react';
import { supabase } from './supabase';

export type ProjectTypeColorMap = Record<string, string>;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export interface GoogleCalendarColor {
  name: string;
  hex: string;
  /** Google Calendar API event colorId. */
  colorId: string;
}

/**
 * The 11 event colours the Google Calendar API can set, in the order of Google's colour picker.
 * Hex values are the colours the Google Calendar UI draws. The Admin picker offers only these, so a
 * type's colour here and its event colour in Google Calendar are always the same.
 */
export const GOOGLE_CALENDAR_COLORS: GoogleCalendarColor[] = [
  { name: 'Flamingo', hex: '#E67C73', colorId: '4' },
  { name: 'Tomato', hex: '#D50000', colorId: '11' },
  { name: 'Tangerine', hex: '#F4511E', colorId: '6' },
  { name: 'Banana', hex: '#F6BF26', colorId: '5' },
  { name: 'Basil', hex: '#0B8043', colorId: '10' },
  { name: 'Sage', hex: '#33B679', colorId: '2' },
  { name: 'Peacock', hex: '#039BE5', colorId: '7' },
  { name: 'Lavender', hex: '#7986CB', colorId: '1' },
  { name: 'Blueberry', hex: '#3F51B5', colorId: '9' },
  { name: 'Grape', hex: '#8E24AA', colorId: '3' },
  { name: 'Graphite', hex: '#616161', colorId: '8' },
];

const GOOGLE_API_COLORS: GoogleCalendarColor[] = GOOGLE_CALENDAR_COLORS;

export function normalizeHex(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  return HEX_RE.test(v) ? v.toUpperCase() : null;
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

/**
 * Badge style derived from one base colour. The text uses the base colour mixed toward
 * the page text colour so it stays readable on both light and dark themes.
 */
export function typeBadgeStyle(hex?: string | null): CSSProperties | undefined {
  const base = normalizeHex(hex);
  if (!base) return undefined;
  const [r, g, b] = hexToRgb(base);
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.15)`,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.4)`,
    color: `color-mix(in srgb, ${base} 70%, var(--color-theme-text, currentColor))`,
  };
}

/** Case-insensitive lookup of a type's configured colour (null when none is set). */
export function lookupTypeColor(map: ProjectTypeColorMap, typeName?: string | null): string | null {
  if (!typeName) return null;
  if (map[typeName]) return map[typeName];
  const lower = typeName.trim().toLowerCase();
  const key = Object.keys(map).find((k) => k.trim().toLowerCase() === lower);
  return key ? map[key] : null;
}

/**
 * Colour for a type: the workspace's configured colour, otherwise the Google Calendar colour the app
 * already sends for that kind of type (Blueberry project, Sage support, Flamingo e-learning, Banana
 * the rest), so unconfigured types look the same here and in Google Calendar.
 */
export function resolveTypeColor(map: ProjectTypeColorMap, typeName?: string | null): string {
  const configured = lookupTypeColor(map, typeName);
  if (configured) return configured;
  const t = (typeName || '').trim().toLowerCase();
  if (t === 'project' || t === 'upgrade') return '#3F51B5'; // Blueberry, colorId 9
  if (t.includes('support')) return '#33B679'; // Sage, colorId 2
  if (t.includes('e-learning') || t === 'elearning') return '#E67C73'; // Flamingo, colorId 4
  return '#F6BF26'; // Banana, colorId 5
}

/**
 * The Google Calendar colour an event gets for a hex colour: the same colour when it is one of the 11
 * API colours, otherwise (older custom shades) the nearest of them (`exact` is false). Null for no colour.
 */
export function googleColorMatch(hex?: string | null): { colorId: string; name: string; hex: string; exact: boolean } | null {
  const base = normalizeHex(hex);
  if (!base) return null;
  const exactHit = GOOGLE_API_COLORS.find((c) => c.hex === base);
  if (exactHit) return { colorId: exactHit.colorId, name: exactHit.name, hex: exactHit.hex, exact: true };
  // Older custom shades: match by hue family first (red -> Tomato, purple -> Grape, ...), then by
  // saturation and lightness. Plain RGB distance sent red to Tangerine and purple to Lavender.
  const target = hexToHsl(base);
  let best = GOOGLE_API_COLORS[0];
  if (target.s < 0.2) {
    best = GOOGLE_API_COLORS.find((c) => c.name === 'Graphite') || best; // greys
  } else {
    let bestDist = Infinity;
    for (const c of GOOGLE_API_COLORS) {
      const hsl = hexToHsl(c.hex);
      const hueDiff = Math.min(Math.abs(target.h - hsl.h), 360 - Math.abs(target.h - hsl.h));
      const dist = 3 * (hueDiff / 180) + 0.5 * Math.abs(target.s - hsl.s) + 0.5 * Math.abs(target.l - hsl.l);
      if (dist < bestDist) {
        bestDist = dist;
        best = c;
      }
    }
  }
  return { colorId: best.colorId, name: best.name, hex: best.hex, exact: false };
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r8, g8, b8] = hexToRgb(hex);
  const r = r8 / 255, g = g8 / 255, b = b8 / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

/** Google Calendar colorId (1-11) for a hex colour, or null when no colour is given. */
export function nearestGoogleColorId(hex?: string | null): string | null {
  return googleColorMatch(hex)?.colorId ?? null;
}

/** One-off load of { type_name: #RRGGBB } for a workspace (empty when unset or the column is missing). */
export async function fetchProjectTypeColors(workspaceId?: string | null): Promise<ProjectTypeColorMap> {
  const map: ProjectTypeColorMap = {};
  if (!workspaceId || workspaceId === 'N/A') return map;
  const { data, error } = await supabase
    .from('tb_master_project_type')
    .select('type_name, color')
    .eq('workspace_id', workspaceId);
  if (!error && data) {
    for (const row of data as { type_name: string; color: string | null }[]) {
      const hex = normalizeHex(row.color);
      if (hex) map[row.type_name] = hex;
    }
  }
  return map;
}

/** Loads { type_name: #RRGGBB } for a workspace. Types without a colour are simply absent. */
export function useProjectTypeColors(workspaceId?: string | null): ProjectTypeColorMap {
  const [loaded, setLoaded] = useState<{ workspaceId: string; colors: ProjectTypeColorMap } | null>(null);

  useEffect(() => {
    if (!workspaceId || workspaceId === 'N/A') return;
    let cancelled = false;
    (async () => {
      // On error (e.g. the color column does not exist yet) the map stays empty so
      // every type falls back to its built-in colour.
      const map = await fetchProjectTypeColors(workspaceId);
      if (cancelled) return;
      setLoaded({ workspaceId, colors: map });
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return loaded && loaded.workspaceId === workspaceId ? loaded.colors : EMPTY_COLORS;
}

const EMPTY_COLORS: ProjectTypeColorMap = {};
