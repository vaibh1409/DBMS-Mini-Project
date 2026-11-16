'use client';
// The frame around every signed-in page: navigation for the user's
// role, who is signed in, and sign out. Pages read the user with useUser().
import { createContext, useContext, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/apiClient.js';

const UserContext = createContext(null);

export function useUser() {
  return useContext(UserContext);
}

const NAV = [
  { href: '/dashboard', label: 'Today', roles: ['Owner', 'Vet', 'Farmhand'] },
  { href: '/cattle', label: 'Cattle', roles: ['Owner', 'Vet', 'Farmhand'] },
  { href: '/milk', label: 'Milk yield', roles: ['Owner', 'Vet', 'Farmhand'] },
  { href: '/breeding', label: 'Breeding', roles: ['Owner', 'Vet'] },
  { href: '/health', label: 'Health records', roles: ['Owner', 'Vet'] },
  { href: '/search', label: 'Similar cases', roles: ['Owner', 'Vet'] },
  { href: '/vaccinations', label: 'Vaccinations', roles: ['Owner', 'Vet'] },
];

export default function AppShell({ user, children }) {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  }

  return (
    <UserContext.Provider value={user}>
      <div className="shell">
        <aside className="sidebar">
          <Link href="/dashboard" className="brand">
            <span className="brand-tag" aria-hidden="true">HS</span>
            <span className="brand-name">HerdSense</span>
          </Link>

          <nav aria-label="Main">
            <ul className="nav-list">
              {NAV.filter((item) => item.roles.includes(user.role)).map((item) => {
                const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link href={item.href} className="nav-link" aria-current={current ? 'page' : undefined}>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="signed-in">
            <p className="signed-in-name">{user.name}</p>
            <p className="signed-in-role">{user.role}</p>
            <button type="button" className="button button-quiet" onClick={signOut} disabled={signingOut}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </aside>

        <main className="content">{children}</main>
      </div>
    </UserContext.Provider>
  );
}

// Shown when a page is opened by a role that cannot use it
export function RoleGate({ allow, children }) {
  const user = useUser();
  if (allow.includes(user.role)) return children;
  return (
    <div className="content-narrow">
      <h1>Not available</h1>
      <p>This page is for {allow.join(' and ')} accounts. You are signed in as {user.role}.</p>
      <p><Link href="/dashboard">Go to today&rsquo;s overview</Link></p>
    </div>
  );
}
