const rawBasePath = import.meta.env.BASE_URL || '/';
export const APP_BASE_PATH = rawBasePath.endsWith('/') ? rawBasePath : `${rawBasePath}/`;

export function appPath(path: string) {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${APP_BASE_PATH}${cleanPath}`.replace(/\/{2,}/g, '/');
}

export function routePathFromLocation(pathname = window.location.pathname) {
  const normalizedBase = APP_BASE_PATH.replace(/\/$/, '');
  if (normalizedBase && normalizedBase !== '/' && pathname === normalizedBase) return '/';
  if (normalizedBase && normalizedBase !== '/' && pathname.startsWith(`${normalizedBase}/`)) {
    return pathname.slice(normalizedBase.length) || '/';
  }
  return pathname;
}
