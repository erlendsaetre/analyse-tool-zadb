import React, { useState, useEffect, useMemo } from 'react';

const API_BASE = 'https://athletic-essence-production-5a0c.up.railway.app';

interface TenderWorkspaceProps {
  tenderId: number;
  onBack: () => void;
}

const BRACKETS = [
  { cost: 'cost_min', markup: 'markup_min', label: 'Min' },
  { cost: 'cost_normal', markup: 'markup_normal', label: 'Normal' },
  { cost: 'cost_q45', markup: 'markup_q45', label: '+45' },
  { cost: 'cost_q100', markup: 'markup_q100', label: '+100' },
  { cost: 'cost_q300', markup: 'markup_q300', label: '+300' },
  { cost: 'cost_q500', markup: 'markup_q500', label: '+500' },
  { cost: 'cost_q1000', markup: 'markup_q1000', label: '+1000' },
  { cost: 'cost_q3000', markup: 'markup_q3000', label: '+3000' },
];

const WEIGHT_THRESHOLDS = [
  { min: 3000, bracket: 'cost_q3000', label: '+3000kg' },
  { min: 1000, bracket: 'cost_q1000', label: '+1000kg' },
  { min: 500, bracket: 'cost_q500', label: '+500kg' },
  { min: 300, bracket: 'cost_q300', label: '+300kg' },
  { min: 100, bracket: 'cost_q100', label: '+100kg' },
  { min: 45, bracket: 'cost_q45', label: '+45kg' },
  { min: 0, bracket: 'cost_normal', label: 'Normal' },
];

export default function TenderWorkspace({ tenderId, onBack }: TenderWorkspaceProps) {
  const [tender, setTender] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Markup local state
  const [markups, setMarkups] = useState<Record<string, number>>({});

  // Simulator
  const [actualWeight, setActualWeight] = useState<string>('');
  const [volumeWeight, setVolumeWeight] = useState<string>('');

  // Copy config
  const [copyBrackets, setCopyBrackets] = useState<Record<string, boolean>>({
    cost_min: true, cost_normal: true, cost_q45: true, cost_q100: true,
    cost_q300: true, cost_q500: true, cost_q1000: true, cost_q3000: true
  });
  const [copyMode, setCopyMode] = useState<'cost' | 'selling'>('selling');

  const fetchTender = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tenders/${tenderId}`);
      const data = await res.json();
      setTender(data);
      setMarkups({
        markup_min: data.markup_min || 0,
        markup_normal: data.markup_normal || 0,
        markup_q45: data.markup_q45 || 0,
        markup_q100: data.markup_q100 || 0,
        markup_q300: data.markup_q300 || 0,
        markup_q500: data.markup_q500 || 0,
        markup_q1000: data.markup_q1000 || 0,
        markup_q3000: data.markup_q3000 || 0,
      });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTender(); }, [tenderId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const updateTender = async (updates: Record<string, any>) => {
    try {
      await fetch(`${API_BASE}/api/tenders/${tenderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) { console.error(e); }
  };

  const saveMarkups = async () => {
    await updateTender(markups);
    showToast('Markup saved');
  };

  const deleteRate = async (rateId: number) => {
    try {
      await fetch(`${API_BASE}/api/tenders/${tenderId}/rates/${rateId}`, { method: 'DELETE' });
      fetchTender();
    } catch (e) { console.error(e); }
  };

  const updateRateNotes = async (rateId: number, notes: string) => {
    try {
      await fetch(`${API_BASE}/api/tenders/${tenderId}/rates/${rateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      });
    } catch (e) { console.error(e); }
  };

  const getSelling = (cost: number | null, markupKey: string) => {
    if (cost === null || cost === undefined) return null;
    const pct = markups[markupKey] || 0;
    return cost * (1 + pct / 100);
  };

  const getIataCode = (airline: string) => {
    const code = airline.split(' - ')[0];
    return (code && code.length === 2) ? code : '';
  };

  // Simulator calculations
  const simResults = useMemo(() => {
    if (!tender || !actualWeight && !volumeWeight) return [];
    const aw = parseFloat(actualWeight) || 0;
    const vw = parseFloat(volumeWeight) || 0;
    const cw = Math.max(aw, vw);
    if (cw <= 0) return [];

    // Find applicable bracket
    let bracketKey = 'cost_normal';
    let bracketLabel = 'Normal';
    for (const t of WEIGHT_THRESHOLDS) {
      if (cw >= t.min && t.min > 0) {
        bracketKey = t.bracket;
        bracketLabel = t.label;
        break;
      }
    }

    const markupKey = bracketKey.replace('cost_', 'markup_');

    return (tender.rates || [])
      .filter((r: any) => r[bracketKey] !== null && r[bracketKey] !== undefined)
      .map((r: any) => {
        const costRate = r[bracketKey];
        const totalCost = costRate * cw;
        const sellRate = getSelling(costRate, markupKey);
        const totalSell = sellRate ? sellRate * cw : null;
        const margin = totalSell && totalCost ? totalSell - totalCost : null;
        return {
          airline: r.airline,
          product: r.product,
          origin: r.origin,
          destination: r.destination,
          costRate,
          totalCost,
          sellRate,
          totalSell,
          margin,
          cw,
          bracketLabel,
          currency: r.currency
        };
      })
      .sort((a: any, b: any) => a.costRate - b.costRate);
  }, [tender, actualWeight, volumeWeight, markups]);

  const chargeableWeight = Math.max(parseFloat(actualWeight) || 0, parseFloat(volumeWeight) || 0);

  const copyRateToClipboard = (rate: any, includeMeta: boolean) => {
    const parts: string[] = [];
    if (includeMeta) {
      const iata = getIataCode(rate.airline);
      parts.push(iata, rate.origin || '', rate.destination || '', rate.via || '');
    }
    parts.push(rate.currency || 'NOK');
    
    BRACKETS.forEach(b => {
      if (copyBrackets[b.cost]) {
        const cost = rate[b.cost];
        if (copyMode === 'selling') {
          const sell = getSelling(cost, b.markup);
          parts.push(sell !== null ? sell.toFixed(2) : '');
        } else {
          parts.push(cost !== null && cost !== undefined ? cost.toFixed(2) : '');
        }
      }
    });

    navigator.clipboard.writeText(parts.join('\t'));
    showToast('Copied to clipboard!');
  };

  if (loading) return <div style={{ color: '#9ca3af', padding: '32px' }}>Loading tender...</div>;
  if (!tender) return <div style={{ color: '#f87171', padding: '32px' }}>Tender not found</div>;

  return (
    <div className="view-container">
      {toast && <div className="toast">{toast}</div>}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
        <button className="btn back-btn" onClick={onBack}>← Back</button>
        <span className="status-badge" style={{
          backgroundColor: tender.status === 'active' ? '#3b82f622' : tender.status === 'completed' ? '#10b98122' : '#6b728022',
          color: tender.status === 'active' ? '#3b82f6' : tender.status === 'completed' ? '#10b981' : '#6b7280',
          borderColor: tender.status === 'active' ? '#3b82f644' : tender.status === 'completed' ? '#10b98144' : '#6b728044'
        }}>{tender.status}</span>
      </div>

      {/* Tender Info */}
      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div className="filter-group" style={{ flex: 2 }}>
            <label className="filter-label">Tender Name</label>
            <input type="text" className="text-input" defaultValue={tender.name}
              onBlur={e => updateTender({ name: e.target.value })} />
          </div>
          <div className="filter-group" style={{ flex: 3 }}>
            <label className="filter-label">Description</label>
            <input type="text" className="text-input" defaultValue={tender.description || ''}
              onBlur={e => updateTender({ description: e.target.value })} />
          </div>
          <div className="filter-group">
            <label className="filter-label">Status</label>
            <select defaultValue={tender.status} onChange={e => updateTender({ status: e.target.value })}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
        <div className="filter-group">
          <label className="filter-label">Notes & Assessments</label>
          <textarea className="notes-textarea" defaultValue={tender.notes || ''}
            onBlur={e => updateTender({ notes: e.target.value })}
            placeholder="Write your notes, assessments, and observations here..." rows={3} />
        </div>
      </div>

      {/* Markup Configuration */}
      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ color: '#f9fafb', fontSize: '1.1rem', marginBottom: '16px' }}>Markup % per Weight Bracket</h3>
        <div className="markup-row">
          {BRACKETS.map(b => (
            <div key={b.markup} className="filter-group" style={{ textAlign: 'center' }}>
              <label className="filter-label">{b.label}</label>
              <input type="number" className="markup-input"
                value={markups[b.markup] || 0}
                onChange={e => setMarkups({ ...markups, [b.markup]: parseFloat(e.target.value) || 0 })}
                onBlur={saveMarkups}
                step="0.5" />
              <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rates Table */}
      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ color: '#f9fafb', fontSize: '1.1rem', marginBottom: '16px' }}>
          Rates ({tender.rates?.length || 0})
        </h3>
        {(!tender.rates || tender.rates.length === 0) ? (
          <div style={{ color: '#9ca3af', textAlign: 'center', padding: '32px' }}>
            No rates added yet. Go to Dashboard and click ➕ to add rates to this tender.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Airline</th>
                  <th>Product</th>
                  <th>Lane</th>
                  <th>Via</th>
                  {BRACKETS.map(b => <th key={b.cost}>{b.label}</th>)}
                  <th>Curr</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tender.rates.map((rate: any) => {
                  const iata = getIataCode(rate.airline);
                  return (
                    <React.Fragment key={rate.id}>
                      {/* Cost Row */}
                      <tr className="cost-row">
                        <td rowSpan={2}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {iata && <img src={`https://images.kiwi.com/airlines/64/${iata}.png`} alt={iata} width="20" height="20" style={{ borderRadius: '3px' }} onError={e => (e.currentTarget.style.display = 'none')} />}
                            <span style={{ fontSize: '0.8rem' }}>{rate.airline}</span>
                          </div>
                        </td>
                        <td rowSpan={2} style={{ fontSize: '0.8rem' }}>{rate.product || '-'}</td>
                        <td rowSpan={2} style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{rate.origin}→{rate.destination}</td>
                        <td rowSpan={2} style={{ fontSize: '0.75rem' }}>{rate.via || '-'}</td>
                        {BRACKETS.map(b => (
                          <td key={b.cost} style={{ fontSize: '0.8rem' }}>
                            {rate[b.cost] !== null && rate[b.cost] !== undefined ? rate[b.cost].toFixed(2) : '-'}
                          </td>
                        ))}
                        <td rowSpan={2} style={{ fontSize: '0.75rem' }}>{rate.currency || 'NOK'}</td>
                        <td rowSpan={2}>
                          <input type="text" className="text-input" style={{ width: '100px', fontSize: '0.75rem', padding: '4px 6px' }}
                            defaultValue={rate.notes || ''} placeholder="..."
                            onBlur={e => updateRateNotes(rate.id, e.target.value)} />
                        </td>
                        <td rowSpan={2}>
                          <button className="btn btn-danger" style={{ padding: '2px 8px', fontSize: '0.7rem' }} onClick={() => deleteRate(rate.id)}>✕</button>
                        </td>
                      </tr>
                      {/* Selling Row */}
                      <tr className="sell-row">
                        {BRACKETS.map(b => {
                          const sell = getSelling(rate[b.cost], b.markup);
                          return (
                            <td key={b.cost + '_sell'} style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
                              {sell !== null ? sell.toFixed(2) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            <div style={{ padding: '8px 16px', display: 'flex', gap: '8px', alignItems: 'center', borderTop: '1px solid var(--border-color)', fontSize: '0.75rem', color: '#6b7280' }}>
              <span style={{ color: '#f9fafb' }}>Cost</span> = top row &nbsp;|&nbsp; <span style={{ color: '#10b981' }}>Selling</span> = bottom row (cost + markup%)
            </div>
          </div>
        )}
      </div>

      {/* Weight Simulator */}
      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ color: '#f9fafb', fontSize: '1.1rem', marginBottom: '16px' }}>Weight Simulator</h3>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div className="filter-group">
            <label className="filter-label">Actual Weight (kg)</label>
            <input type="number" className="text-input" value={actualWeight} onChange={e => setActualWeight(e.target.value)} placeholder="0" />
          </div>
          <div className="filter-group">
            <label className="filter-label">Volume Weight (kg)</label>
            <input type="number" className="text-input" value={volumeWeight} onChange={e => setVolumeWeight(e.target.value)} placeholder="0" />
          </div>
          {chargeableWeight > 0 && (
            <div className="filter-group">
              <label className="filter-label">Chargeable Weight</label>
              <div style={{ color: '#f59e0b', fontSize: '1.2rem', fontWeight: 700, padding: '8px 0' }}>{chargeableWeight.toFixed(1)} kg</div>
            </div>
          )}
        </div>

        {simResults.length > 0 && (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Airline</th>
                  <th>Product</th>
                  <th>Bracket</th>
                  <th>Rate/kg (cost)</th>
                  <th>Total Cost</th>
                  <th>Rate/kg (sell)</th>
                  <th>Total Selling</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {simResults.map((r: any, i: number) => (
                  <tr key={i}>
                    <td style={{ fontSize: '0.85rem' }}>{r.airline}</td>
                    <td style={{ fontSize: '0.85rem' }}>{r.product || '-'}</td>
                    <td style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{r.bracketLabel}</td>
                    <td>{r.costRate?.toFixed(2)} {r.currency}</td>
                    <td style={{ fontWeight: 600 }}>{r.totalCost?.toFixed(2)} {r.currency}</td>
                    <td style={{ color: '#10b981' }}>{r.sellRate?.toFixed(2)} {r.currency}</td>
                    <td style={{ color: '#10b981', fontWeight: 600 }}>{r.totalSell?.toFixed(2)} {r.currency}</td>
                    <td style={{ color: '#f59e0b', fontWeight: 600 }}>{r.margin?.toFixed(2)} {r.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Copy to System */}
      {tender.rates && tender.rates.length > 0 && (
        <div className="glass-card">
          <h3 style={{ color: '#f9fafb', fontSize: '1.1rem', marginBottom: '16px' }}>Copy to System</h3>

          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
            <div>
              <label className="filter-label" style={{ marginBottom: '8px', display: 'block' }}>Include Brackets</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {BRACKETS.map(b => (
                  <label key={b.cost} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#9ca3af', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={copyBrackets[b.cost]}
                      onChange={e => setCopyBrackets({ ...copyBrackets, [b.cost]: e.target.checked })} />
                    {b.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="filter-label" style={{ marginBottom: '8px', display: 'block' }}>Copy Values</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#9ca3af', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="radio" name="copyMode" checked={copyMode === 'cost'} onChange={() => setCopyMode('cost')} /> Cost
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="radio" name="copyMode" checked={copyMode === 'selling'} onChange={() => setCopyMode('selling')} /> Selling
                </label>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tender.rates.map((rate: any) => (
              <div key={rate.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                <span style={{ flex: 1, fontSize: '0.85rem', color: '#d1d5db' }}>
                  {rate.airline} — {rate.product || 'N/A'} ({rate.origin}→{rate.destination})
                </span>
                <button className="btn" style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={() => copyRateToClipboard(rate, false)}>
                  📋 Copy Rates
                </button>
                <button className="btn" style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={() => copyRateToClipboard(rate, true)}>
                  📋 Copy Full
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
