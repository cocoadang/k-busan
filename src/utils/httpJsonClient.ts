/**
 * Safe HTTP & JSON Client Utilities
 *
 * Implements strict response validation:
 * - Validates HTTP status code
 * - Validates Content-Type header before parsing JSON
 * - Prevents SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON
 * - Returns explicit UPSTREAM_NON_JSON_RESPONSE error objects
 * - Strictly avoids storing or logging raw HTML payloads
 */

export interface UpstreamNonJsonError {
  code: 'UPSTREAM_NON_JSON_RESPONSE';
  source: string;
  httpStatus: number;
  contentType: string;
  message: string;
}

export interface SafeFetchResult<T = any> {
  ok: boolean;
  status: number;
  contentType: string;
  data?: T;
  error?: UpstreamNonJsonError | { code: string; message: string; [key: string]: any };
}

/**
 * Safely fetches an endpoint expecting JSON.
 * Validates HTTP status and Content-Type before parsing.
 * Never throws syntax errors on HTML responses; returns an explicit UPSTREAM_NON_JSON_RESPONSE.
 * Does not store or log full HTML content.
 */
export async function safeFetchJson<T = any>(
  url: string,
  options: RequestInit = {},
  source: string = 'upstream'
): Promise<SafeFetchResult<T>> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json, text/plain, */*');
  }

  const res = await fetch(url, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';
  const isJson =
    contentType.includes('application/json') ||
    contentType.includes('+json') ||
    contentType.includes('text/json');

  if (!isJson) {
    return {
      ok: false,
      status: res.status,
      contentType,
      error: {
        code: 'UPSTREAM_NON_JSON_RESPONSE',
        source,
        httpStatus: res.status,
        contentType: contentType || 'unknown/empty',
        message: `Upstream service (${source}) returned non-JSON response [HTTP ${res.status}] with Content-Type '${contentType || 'none'}'`,
      },
    };
  }

  try {
    const data = (await res.json()) as T;
    return {
      ok: res.ok,
      status: res.status,
      contentType,
      data,
    };
  } catch (parseErr: any) {
    return {
      ok: false,
      status: res.status,
      contentType,
      error: {
        code: 'INVALID_JSON_PAYLOAD',
        source,
        httpStatus: res.status,
        contentType,
        message: `Failed to parse JSON response from ${source}: ${parseErr?.message || 'Invalid JSON syntax'}`,
      },
    };
  }
}

/**
 * Synchronous helper to validate response headers before calling res.json()
 */
export function validateJsonContentType(
  res: { status: number; headers: { get: (name: string) => string | null } },
  source: string
): { isValid: boolean; error?: UpstreamNonJsonError; contentType: string } {
  const contentType = res.headers.get('content-type') || '';
  const isJson =
    contentType.includes('application/json') ||
    contentType.includes('+json') ||
    contentType.includes('text/json');

  if (!isJson) {
    return {
      isValid: false,
      contentType,
      error: {
        code: 'UPSTREAM_NON_JSON_RESPONSE',
        source,
        httpStatus: res.status,
        contentType: contentType || 'unknown/empty',
        message: `Upstream service (${source}) returned non-JSON response [HTTP ${res.status}] with Content-Type '${contentType || 'none'}'`,
      },
    };
  }

  return { isValid: true, contentType };
}
