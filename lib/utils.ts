export function isrecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isaborterror(error: unknown): boolean {
  return isrecord(error) && error.name === 'AbortError';
}

export function errormessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function optionalnumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

export interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

export function togglefullscreen(element: HTMLElement | null) {
  if (!element) return;
  const doc = document as FullscreenDocument;
  if (doc.fullscreenElement || doc.webkitFullscreenElement) {
    if (doc.exitFullscreen) void doc.exitFullscreen();
    else if (doc.webkitExitFullscreen) void doc.webkitExitFullscreen();
    return;
  }
  const target = element as FullscreenElement;
  if (target.requestFullscreen) void target.requestFullscreen();
  else if (target.webkitRequestFullscreen) void target.webkitRequestFullscreen();
}
