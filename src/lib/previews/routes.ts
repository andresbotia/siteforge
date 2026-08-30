export function isPublicPreviewPath(pathname: string): boolean {
  return /^\/p\/[^/]+$/.test(pathname);
}

export function isPublicOutreachPreviewPath(pathname: string): boolean {
  return /^\/o\/[^/]+$/.test(pathname);
}

export function isPreviewEventPath(pathname: string): boolean {
  return pathname === "/api/preview-events";
}
