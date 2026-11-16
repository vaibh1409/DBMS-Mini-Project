'use client';
// Browser-side helper for calling the HerdSense API.
// The session cookie is sent automatically. A 401 (signed out or
// expired) sends the user back to the sign-in page.
import { useCallback, useEffect, useState } from 'react';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    // no JSON body
  }

  if (response.status === 401 && path !== '/api/auth/login') {
    window.location.href = '/login';
    throw new ApiError('Your session has ended. Please sign in again.', 401);
  }
  if (!response.ok) {
    const message = data?.error ?? `The request failed (${response.status})`;
    throw new ApiError(data?.detail ? `${message}. ${data.detail}` : message, response.status);
  }
  return data;
}

// Loads `path` when the component appears and whenever `path` changes.
// Pass null to load nothing. reload() fetches it again.
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!path) {
      setState({ data: null, error: null, loading: false });
      return undefined;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path)
      .then((data) => { if (!cancelled) setState({ data, error: null, loading: false }); })
      .catch((err) => { if (!cancelled) setState({ data: null, error: err.message, loading: false }); });
    return () => { cancelled = true; };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
