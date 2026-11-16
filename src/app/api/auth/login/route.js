// POST /api/auth/login  { "username": "...", "password": "..." }
// Checks the password against the bcrypt hash and, if it matches, sets
// the session cookie and returns the user (id, name, role).
import { verifyLogin, createSessionToken, sessionCookie } from '@/lib/auth.js';
import { route, readJson, requireFields, json, HttpError } from '@/lib/http.js';

export const POST = route(async (request) => {
  const body = await readJson(request);
  requireFields(body, ['username', 'password']);
  if (typeof body.username !== 'string' || typeof body.password !== 'string') {
    throw new HttpError(400, 'username and password must be text');
  }

  const user = await verifyLogin(body.username.trim(), body.password);
  if (!user) {
    throw new HttpError(401, 'Wrong username or password');
  }

  const token = await createSessionToken(user);
  return json({ user }, 200, { 'Set-Cookie': sessionCookie(token) });
});
