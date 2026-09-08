'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface KratosError {
  id: string;
  code: number;
  status: string;
  message: string;
  reason?: string;
  debug?: string;
}

export default function ErrorPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const message = searchParams.get('message');
  const [error, setError] = useState<KratosError | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/.kratos/self-service/errors?id=${id}`)
      .then((r) => r.json())
      .then((data) => setError(data))
      .catch(() => {});
  }, [id]);

  return (
    <main className="container">
      <div className="card">
        <h1>Error</h1>
        <p className="subtitle">
          {message || error?.message || 'An unexpected error occurred'}
        </p>
        {error?.reason && (
          <p className="info" style={{ color: 'var(--fg-subtle)' }}>
            {error.reason}
          </p>
        )}
      </div>
      <div className="card">
        <Link className="btn btn-outline" href="/login">
          Sign In
        </Link>
      </div>
    </main>
  );
}