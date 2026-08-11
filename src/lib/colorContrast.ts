const DARK_TEXT = '#0a0f0c';
const LIGHT_TEXT = '#f1f5f1';

function channelToLinear(value: number) {
  const channel = value / 255;
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

export function getContrastText(hex: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return LIGHT_TEXT;

  const value = match[1];
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  const luminance = 0.2126 * channelToLinear(red) + 0.7152 * channelToLinear(green) + 0.0722 * channelToLinear(blue);

  return luminance > 0.45 ? DARK_TEXT : LIGHT_TEXT;
}
