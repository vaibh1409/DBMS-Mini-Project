// Temporary start page while the API is built. The full interface
// (sign-in, dashboard, records and search) replaces this page.
export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 640 }}>
      <h1>HerdSense</h1>
      <p>The API is running. The web interface is being built.</p>
      <p>
        Check the API: <a href="/api/auth/me">/api/auth/me</a> answers 401 until you sign in.
      </p>
    </main>
  );
}
