import React, { useState, useEffect } from 'react';

const API_BASE = 'https://athletic-essence-production-5a0c.up.railway.app';

interface TenderListProps {
  onOpenTender: (tenderId: number) => void;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  draft:     { color: '#9ca3af', bg: '#9ca3af22', label: 'Draft' },
  active:    { color: '#3b82f6', bg: '#3b82f622', label: 'Active' },
  submitted: { color: '#f59e0b', bg: '#f59e0b22', label: 'Submitted' },
  won:       { color: '#10b981', bg: '#10b98122', label: 'Won' },
  lost:      { color: '#f87171', bg: '#f8717122', label: 'Lost' },
  expired:   { color: '#6b7280', bg: '#6b728022', label: 'Expired' },
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function TenderList({ onOpenTender }: TenderListProps) {
  const [tenders, setTenders] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCustomer, setNewCustomer] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchTenders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tenders/`);
      setTenders(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTenders(); }, []);

  const createTender = async () => {
    if (!newName.trim()) return;
    setIsSubmitting(true);
    try {
      await fetch(`${API_BASE}/api/tenders/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, customer: newCustomer || null, description: newDesc || null })
      });
      setNewName(''); setNewCustomer(''); setNewDesc(''); setShowCreate(false);
      fetchTenders();
    } catch (e) { console.error(e); }
    finally { setIsSubmitting(false); }
  };

  const deleteTender = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Slett denne tenderen og alle dens rater?')) return;
    try {
      await fetch(`${API_BASE}/api/tenders/${id}`, { method: 'DELETE' });
      fetchTenders();
    } catch (e) { console.error(e); }
  };

  const filtered = filterStatus === 'all' ? tenders : tenders.filter(t => t.status === filterStatus);

  return (
    <div className="view-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ color: '#f9fafb', fontSize: '1.5rem', fontWeight: 700, marginBottom: '4px' }}>Tenders</h2>
          <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>{tenders.length} tender{tenders.length !== 1 ? 's' : ''} totalt</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? '✕ Cancel' : '+ New Tender'}
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="glass-card" style={{ marginBottom: '24px', border: '1px solid #3b82f644' }}>
          <h3 style={{ color: '#f9fafb', fontSize: '1rem', marginBottom: '16px', fontWeight: 600 }}>New Tender</h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <div className="filter-group" style={{ flex: 2, minWidth: '160px' }}>
              <label className="filter-label">Tender Name *</label>
              <input autoFocus type="text" value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createTender()}
                placeholder="e.g. TE Connect Q4 2026" className="text-input" />
            </div>
            <div className="filter-group" style={{ flex: 1, minWidth: '140px' }}>
              <label className="filter-label">Customer</label>
              <input type="text" value={newCustomer} onChange={e => setNewCustomer(e.target.value)}
                placeholder="e.g. TE Connectivity" className="text-input" />
            </div>
            <div className="filter-group" style={{ flex: 2, minWidth: '160px' }}>
              <label className="filter-label">Description</label>
              <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                placeholder="Optional notes..." className="text-input" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={createTender} disabled={!newName.trim() || isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Tender'}
            </button>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['all', 'draft', 'active', 'submitted', 'won', 'lost', 'expired'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className="btn" style={{
              padding: '4px 12px', fontSize: '0.8rem',
              background: filterStatus === s ? '#3b82f633' : 'transparent',
              border: filterStatus === s ? '1px solid #3b82f6' : '1px solid var(--border-color)',
              color: filterStatus === s ? '#3b82f6' : '#6b7280'
            }}>
            {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label || s}
            {s === 'all' ? ` (${tenders.length})` : ` (${tenders.filter(t => t.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Tender Grid */}
      {loading ? (
        <div style={{ color: '#9ca3af' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧮</div>
          <div style={{ color: '#9ca3af' }}>
            {filterStatus === 'all' ? 'Ingen tenders ennå.' : `Ingen tenders med status "${filterStatus}".`}
          </div>
        </div>
      ) : (
        <div className="tender-grid">
          {filtered.map(t => {
            const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.draft;
            const days = daysUntil(t.valid_until);
            const isUrgent = days !== null && days <= 7 && days >= 0;
            const isExpired = days !== null && days < 0;
            return (
              <div key={t.id} className="glass-card tender-card" onClick={() => onOpenTender(t.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ flex: 1, marginRight: '12px' }}>
                    <h3 style={{ color: '#f9fafb', fontSize: '1rem', fontWeight: 600, marginBottom: '2px' }}>{t.name}</h3>
                    {t.customer && <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>🏢 {t.customer}</div>}
                  </div>
                  <span className="status-badge" style={{ backgroundColor: cfg.bg, color: cfg.color, borderColor: cfg.color + '44', whiteSpace: 'nowrap' }}>
                    {cfg.label}
                  </span>
                </div>

                {t.description && (
                  <div style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '12px', fontStyle: 'italic' }}>{t.description}</div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.78rem', color: '#6b7280' }}>
                    <span>{t.rate_count} lane{t.rate_count !== 1 ? 's' : ''}</span>
                    {t.tender_url && <span title="Has system link">🔗</span>}
                    {t.valid_until && (
                      <span style={{ color: isExpired ? '#f87171' : isUrgent ? '#f59e0b' : '#6b7280', fontWeight: isUrgent || isExpired ? 600 : 400 }}>
                        {isExpired ? `Expired ${Math.abs(days!)}d ago` : `⏰ ${days}d left`}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-danger" style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                      onClick={e => deleteTender(t.id, e)}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
