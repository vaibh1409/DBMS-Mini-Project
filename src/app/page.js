// The start page sends signed-in users to today's overview and
// everyone else to the sign-in page.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth.js';

export default async function Home() {
  const user = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  redirect(user ? '/dashboard' : '/login');
}
