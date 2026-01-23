"use client"

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import api from '@/lib/api';

export default function AuthDebugPage() {
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Check localStorage token
    const token = localStorage.getItem('accessToken');
    if (token) {
      try {
        // Decode JWT (simple base64 decode, not verification)
        const payload = JSON.parse(atob(token.split('.')[1]));
        setTokenInfo({
          exists: true,
          payload,
          raw: token.substring(0, 50) + '...'
        });
      } catch (e) {
        setTokenInfo({ exists: true, error: 'Failed to decode token' });
      }
    } else {
      setTokenInfo({ exists: false });
    }

    // Try to fetch user info
    api.get('/api/auth/me')
      .then(res => setUserInfo(res.data))
      .catch(err => setError(err.message || 'Failed to fetch user info'));
  }, []);

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">🔍 Auth Debug Page</h1>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">📝 Token Info</h2>
        <pre className="bg-muted p-4 rounded text-xs overflow-auto">
          {JSON.stringify(tokenInfo, null, 2)}
        </pre>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">👤 User Info</h2>
        {error ? (
          <div className="text-red-600">Error: {error}</div>
        ) : (
          <pre className="bg-muted p-4 rounded text-xs overflow-auto">
            {JSON.stringify(userInfo, null, 2)}
          </pre>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">🔑 Test Access Keys API</h2>
        <button
          onClick={async () => {
            try {
              const res = await api.get('/api/dietitian/access-keys');
              alert('Success! Keys: ' + JSON.stringify(res.data));
            } catch (err: any) {
              alert('Error: ' + (err.message || JSON.stringify(err)));
            }
          }}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
        >
          Test GET /api/dietitian/access-keys
        </button>
      </Card>
    </div>
  );
}
