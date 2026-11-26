import { useEffect, useState, type CSSProperties } from 'react';
import { supabase } from './supabase';

export type ProjectTypeColorMap = Record<string, string>;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Preset swatches offered in the Admin picker (workspace admins can also pick any custom shade). */
export const PROJECT_TYPE_COLOR_PRESETS: string[] = [
  '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#A855F7',
  '#EC4899', '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#64748B',
];

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

/** Loads { type_name: #RRGGBB } for a workspace. Types without a colour are simply absent. */
export function useProjectTypeColors(workspaceId?: string | null): ProjectTypeColorMap {
  const [loaded, setLoaded] = useState<{ workspaceId: string; colors: ProjectTypeColorMap } | null>(null);

  useEffect(() => {
    if (!workspaceId || workspaceId === 'N/A') return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('tb_master_project_type')
        .select('type_name, color')
        .eq('workspace_id', workspaceId);
      if (cancelled) return;
      const map: ProjectTypeColorMap = {};
      // On error (e.g. the color column does not exist yet) keep an empty map so
      // every type falls back to its built-in colour.
      if (!error && data) {
        for (const row of data as { type_name: string; color: string | null }[]) {
          const hex = normalizeHex(row.color);
          if (hex) map[row.type_name] = hex;
        }
      }
      setLoaded({ workspaceId, colors: map });
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return loaded && loaded.workspaceId === workspaceId ? loaded.colors : EMPTY_COLORS;
}

const EMPTY_COLORS: ProjectTypeColorMap = {};
