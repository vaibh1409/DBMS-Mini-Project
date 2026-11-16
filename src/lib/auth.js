// Sign-in and sessions.
// Passwords are checked against bcrypt hashes in Farm_Staff. A signed-in
// user gets a JWT (signed with JWT_SECRET) in an HttpOnly cookie, which
// browser JavaScript cannot read. Every API route checks the token and
// the user's role before touching the database.
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { loginPool } from './db.js';
import { HttpError } from './http.js';

export const SESSION_COOKIE = 'herdsense_session';
const SESSION_SECONDS = 8 * 60 * 60;   // 8 hours

// Used when the username does not exist, so a wrong username takes as
// long to reject as a wrong password
const DUMMY_HASH = '$2b$10$GrLbtT3oWnrBdDXaTMMAqeah35KCuI7CdVVYILcnYA1KV0zTo4s2G';

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set in .env and be at least 32 characters long');
  }
  return new TextEncoder().encode(secret);
}

// Returns the staff member if the username and password match, else null
export async function verifyLogin(username, password) {
  const { rows } = await loginPool().query(
    'SELECT staff_id, full_name, username, password_hash, role FROM Farm_Staff WHERE username = $1',
    [username],
  );
  const staff = rows[0];
  const ok = await bcrypt.compare(password, staff?.password_hash ?? DUMMY_HASH);
  if (!staff || !ok) return null;
  return { staffId: staff.staff_id, name: staff.full_name, username: staff.username, role: staff.role };
}

export async function createSessionToken(user) {
  return new SignJWT({ name: user.name, username: user.username, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.staffId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secretKey());
}

export function sessionCookie(token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearedSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

// Verifies a session token and returns the user, or null if it is
// missing, tampered with or expired
export async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    return { staffId: Number(payload.sub), name: payload.name, username: payload.username, role: payload.role };
  } catch {
    return null;
  }
}

export async function getSessionUser(request) {
  return verifySessionToken(readCookie(request, SESSION_COOKIE));
}

// Returns the signed-in user, or throws 401 (not signed in) or
// 403 (signed in, but the role is not allowed here)
export async function requireUser(request, allowedRoles) {
  const user = await getSessionUser(request);
  if (!user) throw new HttpError(401, 'Please sign in');
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw new HttpError(403, `This action is not available to the ${user.role} role`);
  }
  return user;
}
