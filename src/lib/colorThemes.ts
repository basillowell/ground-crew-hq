export type ColorTheme = {
  id: string;
  label: string;
  primaryColor: string;
  accentColor: string;
  sidebarColor: string;
  fontThemePreset: string;
};

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: 'fairway',
    label: 'Fairway',
    primaryColor: '#2FA866',
    accentColor: '#16a34a',
    sidebarColor: '#0f172a',
    fontThemePreset: 'modern-sans',
  },
  {
    id: 'midnight-turf',
    label: 'Midnight Turf',
    primaryColor: '#34d399',
    accentColor: '#059669',
    sidebarColor: '#020617',
    fontThemePreset: 'compact-ops',
  },
  {
    id: 'clay-court',
    label: 'Clay Court',
    primaryColor: '#c2703d',
    accentColor: '#e08e57',
    sidebarColor: '#1c1410',
    fontThemePreset: 'classic-club',
  },
  {
    id: 'sunset-polo',
    label: 'Sunset Polo',
    primaryColor: '#f2711f',
    accentColor: '#ffb347',
    sidebarColor: '#d94f04',
    fontThemePreset: 'editorial-serif',
  },
  {
    id: 'polo-green',
    label: 'Polo Green',
    primaryColor: '#145a32',
    accentColor: '#e8dcb5',
    sidebarColor: '#0d2818',
    fontThemePreset: 'classic-club',
  },
  {
    id: 'slate-citrus',
    label: 'Slate & Citrus',
    primaryColor: '#ea7c3c',
    accentColor: '#64748b',
    sidebarColor: '#1e293b',
    fontThemePreset: 'modern-sans',
  },
];

export function getColorTheme(id: string) {
  return COLOR_THEMES.find((theme) => theme.id === id);
}
