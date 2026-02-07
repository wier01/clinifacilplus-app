export function getApiBaseUrl(): string {
  const base = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim().replace(/\/+$/, '');
  return base;
}
