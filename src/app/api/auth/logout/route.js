// POST /api/auth/logout
// Clears the session cookie.
import { clearedSessionCookie } from '@/lib/auth.js';
import { route, json } from '@/lib/http.js';

export const POST = route(async () => json({ ok: true }, 200, { 'Set-Cookie': clearedSessionCookie() }));
