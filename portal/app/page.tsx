import Link from 'next/link';
import { fetchLogoutUrl, fetchSession } from '@/lib/server/kratos';

export default async function HomePage() {
  const session = await fetchSession();

  if (!session) {
    return (
      <main className="container">
        <h1>Infiniteteam</h1>
        <p className="subtitle">Identity Portal</p>
        <div className="card">
          <div className="btn" style={{ display: 'flex', gap: '0.5rem' }}>
            <Link className="btn btn-primary" href="/login">
              Sign In
            </Link>
            <Link className="btn btn-outline" href="/registration">
              Create Account
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const identity = session.identity;
  const logoutUrl = await fetchLogoutUrl();

  return (
    <main className="container">
      <h1>Infiniteteam</h1>
      <p className="subtitle">Identity Portal</p>
      <div className="card">
        <p className="info">
          Signed in as <strong>{identity.traits.email}</strong>
          <br />
          Role: {identity.traits.role || 'user'}
        </p>
        <div className="btn" style={{ display: 'flex', gap: '0.5rem' }}>
          <Link className="btn btn-outline" href="/settings">
            Account Settings
          </Link>
          {logoutUrl && (
            <a className="btn btn-danger" href={logoutUrl}>
              Sign Out
            </a>
          )}
        </div>
      </div>
    </main>
  );
}