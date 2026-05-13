import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const TABS = ['Workspace', 'Workforce', 'Scheduler', 'Weather', 'Access', 'Help'] as const;

type Tab = (typeof TABS)[number];

export default function SettingsPage() {
  const { orgId, user, userRole } = useAuth();
  const [tab, setTab] = useState<Tab>('Scheduler');

  return (
    <div style={{ padding: '1.5rem', maxWidth: '900px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 4px' }}>Operations Control Center</h1>
      <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 1.5rem' }}>{user?.email}</p>

      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '0',
          flexWrap: 'wrap',
        }}
      >
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px',
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? '#166534' : '#6b7280',
              borderBottom: tab === t ? '2px solid #166534' : '2px solid transparent',
              fontSize: '14px',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Workspace' && <WorkspaceTab orgId={orgId} />}
      {tab === 'Workforce' && <WorkforceTab orgId={orgId} />}
      {tab === 'Scheduler' && <SchedulerTab orgId={orgId} />}
      {tab === 'Weather' && <WeatherTab orgId={orgId} />}
      {tab === 'Access' && <AccessTab userEmail={user?.email ?? ''} userRole={userRole} orgId={orgId} />}
      {tab === 'Help' && <HelpTab />}
    </div>
  );
}

function WorkspaceTab({ orgId }: { orgId: string | null }) {
  return (
    <div>
      <p>Workspace settings coming</p>
      <p style={{ color: '#6b7280', fontSize: '13px' }}>Org: {orgId ?? 'Not available'}</p>
    </div>
  );
}

function WorkforceTab({ orgId }: { orgId: string | null }) {
  return (
    <div>
      <p>Workforce settings coming</p>
      <p style={{ color: '#6b7280', fontSize: '13px' }}>Org: {orgId ?? 'Not available'}</p>
    </div>
  );
}

function SchedulerTab({ orgId }: { orgId: string | null }) {
  return (
    <div>
      <p>Scheduler settings coming</p>
      <p style={{ color: '#6b7280', fontSize: '13px' }}>Org: {orgId ?? 'Not available'}</p>
    </div>
  );
}

function WeatherTab({ orgId }: { orgId: string | null }) {
  return (
    <div>
      <p>Weather settings coming</p>
      <p style={{ color: '#6b7280', fontSize: '13px' }}>Org: {orgId ?? 'Not available'}</p>
    </div>
  );
}

function AccessTab({
  userEmail,
  userRole,
  orgId,
}: {
  userEmail: string;
  userRole: string | null;
  orgId: string | null;
}) {
  return (
    <div>
      <p>Access settings coming</p>
      <p style={{ color: '#6b7280', fontSize: '13px' }}>{userEmail || 'No user email'}</p>
      <p style={{ color: '#6b7280', fontSize: '13px' }}>Role: {userRole ?? 'Not available'}</p>
      <p style={{ color: '#6b7280', fontSize: '13px' }}>Org: {orgId ?? 'Not available'}</p>
    </div>
  );
}

function HelpTab() {
  return (
    <div>
      <p>Operations Assistant</p>
      <p style={{ color: '#6b7280', fontSize: '13px' }}>Coming soon</p>
    </div>
  );
}
