/**
 * Typed API client for frontend-to-backend communication.
 * Centralizes auth, error handling, and response parsing.
 */
import { config } from "./config";

const API_BASE = config.apiUrl;

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("tf_token");
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public errorBody: { error: string; message?: string },
  ) {
    super(errorBody.message || errorBody.error);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  /** Override default headers */
  headers?: Record<string, string>;
  /** Skip auth header (for public routes) */
  skipAuth?: boolean;
  /** AbortController signal for cancellation */
  signal?: AbortSignal;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options?.headers || {}),
  };

  if (!options?.skipAuth) {
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    signal: options?.signal,
  });

  if (!res.ok) {
    let errorBody: { error: string; message?: string };
    try {
      errorBody = await res.json();
    } catch {
      errorBody = { error: `HTTP ${res.status}`, message: res.statusText };
    }

    // Auto-redirect on 401 (expired/invalid token)
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("tf_token");
      window.location.href = "/login";
    }

    throw new ApiError(res.status, errorBody);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ─── Convenience Methods ──────────────────────────────────────

export const api = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>("GET", path, undefined, options);
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>("POST", path, body, options);
  },

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>("PATCH", path, body, options);
  },

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>("DELETE", path, undefined, options);
  },

  /**
   * Upload files via multipart form.
   */
  upload<T>(path: string, formData: FormData, options?: RequestOptions): Promise<T> {
    return request<T>("POST", path, formData, options);
  },
};
