// Layout for every signed-in page. Runs on the server: checks the
// session cookie before any page is sent, and sends visitors without a
// valid session to the sign-in page.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth.js';
import AppShell from '@/components/AppShell.js';

export default async function SignedInLayout({ children }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = await verifySessionToken(token);
  if (!user) redirect('/login');

  return <AppShell user={user}>{children}</AppShell>;
}
