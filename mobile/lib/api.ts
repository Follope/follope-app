import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuthStore, getStoredRefreshToken, setStoredRefreshToken } from './authStore';

function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  // If running in a web browser, connect to the matching backend host
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://127.0.0.1:3000/v1';
    }
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      return `http://${host}:3000/v1`;
    }
    return 'https://api.follope.com/v1';
  }
  // When running in Expo Go or native dev, hostUri points to Metro packager e.g. "192.168.1.11:8081"
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:3000/v1`;
  }
  if (Constants.expoConfig?.extra?.apiBaseUrl) {
    return Constants.expoConfig.extra.apiBaseUrl as string;
  }
  return 'http://127.0.0.1:3000/v1';
}

export const API_BASE_URL = getApiBaseUrl();

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  skipAuth?: boolean;
  headers?: Record<string, string>;
  /** Internal — prevents infinite refresh loops if the refresh call itself 401s. */
  _isRetry?: boolean;
}

/**
 * A single in-flight refresh promise, shared across all callers that hit a
 * 401 at the same time. Without this, five concurrent requests that all
 * expire together would each try to refresh, racing to rotate the same
 * refresh token — only the first would succeed and the other four would
 * wrongly log the user out.
 */
let refreshPromise: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const currentRefreshToken = await getStoredRefreshToken();
  if (!currentRefreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: currentRefreshToken }),
    });
    if (!res.ok) return null;

    const { data } = await res.json();
    await setStoredRefreshToken(data.refreshToken);
    useAuthStore.getState().setAccessToken(data.accessToken);
    return data.accessToken as string;
  } catch {
    return null;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, skipAuth = false, _isRetry = false } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...options.headers };
  if (!skipAuth) {
    const token = useAuthStore.getState().accessToken;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', "You're offline. Please check your connection and try again.", 0);
  }

  if (res.status === 401 && !skipAuth && !_isRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiRequest<T>(path, { ...options, _isRetry: true });
    }
    // Refresh failed — the session is truly gone. Clear it so the app
    // routes back to login rather than silently failing every request.
    await useAuthStore.getState().clearSession();
    throw new ApiError('SESSION_EXPIRED', 'Your session expired. Please sign in again.', 401);
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      json?.error?.code ?? 'UNKNOWN_ERROR',
      json?.error?.message ?? 'Something went wrong. Please try again.',
      res.status
    );
  }

  if (!json || typeof json !== 'object') {
    throw new ApiError('INVALID_RESPONSE', 'Invalid response from server.', res.status);
  }

  return json.data as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Partial<RequestOptions>) =>
    apiRequest<T>(path, { method: 'POST', body, ...options }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};

/** Downloads an authenticated binary response to the app cache. JSON API
 * requests use apiRequest above; files need the native downloader instead. */
export async function downloadAuthenticatedFile(path: string, filename: string): Promise<string> {
  if (!FileSystem.cacheDirectory) {
    throw new ApiError('FILE_SYSTEM_UNAVAILABLE', 'File storage is unavailable on this device.', 0);
  }
  const destination = `${FileSystem.cacheDirectory}${filename}`;

  const download = async (accessToken: string | null) =>
    FileSystem.downloadAsync(`${API_BASE_URL}${path}`, destination, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });

  let response: Awaited<ReturnType<typeof download>>;
  try {
    response = await download(useAuthStore.getState().accessToken);
  } catch {
    throw new ApiError('NETWORK_ERROR', "You're offline. Please check your connection and try again.", 0);
  }

  if (response.status === 401) {
    const accessToken = await refreshAccessToken();
    if (accessToken) response = await download(accessToken);
  }

  if (response.status < 200 || response.status >= 300) {
    if (response.status === 401) await useAuthStore.getState().clearSession();
    throw new ApiError('FILE_DOWNLOAD_FAILED', 'Unable to download the invoice PDF. Please try again.', response.status);
  }

  return response.uri;
}

/** Generates a fresh idempotency key for a single create action (e.g. one tap of "Create Invoice"). */
export function newIdempotencyKey(): string {
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
