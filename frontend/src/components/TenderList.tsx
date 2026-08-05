import React, { useState, useEffect } from 'react';

const API_BASE = 'https://athletic-essence-production-5a0c.up.railway.app';

interface TenderListProps {
  onOpenTender: (tenderId: number) => void;
}

export default function TenderList({ onOpenTender }: TenderListProps) {
  const [tenders, setTenders] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchTenders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tenders/`);
      const data = await res.json();
      setTenders(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTenders(); }, []);

  const createTender = async () => {
    if (!newName.trim()) return;
    try {
      await fetch(`${API_BASE}/api/tenders/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, description: newDesc || null })
      });
      setNewName(''); setNewDesc(''); setShowCreate(false);
      fetchTenders();
    } catch (e) { console.error(e); }
  };

  const deleteTender = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Er du sikker på at du vil slette denne tenderen?')) return;
    try {
      await fetch(`${API_BASE}/api/tenders/${id}`, { method: 'DELETE' });
      fetchTenders();
    } catch (e) { console.error(e); }
  };

  const statusColor = (status: string) => {
    if (status === 'active') return '#3b82f6';
    if (status === 'completed') return '#10b981';
    return '#6b7280';
  };

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ color: '#f9fafb', fontSize: '1.5rem', fontWeight: 700 }}>Tenders</h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? '✕ Cancel' : '+ New Tender'}
        </button>
      </div>

      {showCreate && (
        <div className="glass-card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="filter-group">
              <label className="filter-label">Name</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Chicago Q3 2026" className="text-input" />
            </div>
            <div className="filter-group" style={{ flex: 1 }}>
              <label className="filter-label">Description</label>
              <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional description..." className="text-input" />
            </div>
            <button className="btn btn-primary" onClick={createTender}>Create</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: '#9ca3af' }}>Loading tenders...</div>
      ) : tenders.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧮</div>
          <div style={{ color: '#9ca3af', fontSize: '1.1rem' }}>No tenders yet. Create your first tender to start pricing!</div>
        </div>
      ) : (
        <div className="tender-grid">
          {tenders.map(t => (
            <div key={t.id} className="glass-card tender-card" onClick={() => onOpenTender(t.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ color: '#f9fafb', fontSize: '1.1rem', fontWeight: 600, marginBottom: '4px' }}>{t.name}</h3>
                  {t.description && <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '8px' }}>{t.description}</div>}
                </div>
                <span className="status-badge" style={{ backgroundColor: statusColor(t.status) + '22', color: statusColor(t.status), borderColor: statusColor(t.status) + '44' }}>
                  {t.status}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                  {t.rate_count} rate{t.rate_count !== 1 ? 's' : ''} · Updated {new Date(t.updated_at).toLocaleDateString()}
                </div>
                <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={(e) => deleteTender(t.id, e)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
