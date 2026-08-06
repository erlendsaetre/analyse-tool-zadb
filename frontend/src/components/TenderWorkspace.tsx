import React, { useState, useEffect, useMemo, useRef } from 'react';

const API_BASE = 'https://athletic-essence-production-5a0c.up.railway.app';

interface TenderWorkspaceProps {
  tenderId: number;
  onBack: () => void;
}

const BRACKETS = [
  { cost: 'cost_min',    markup: 'markup_min',    label: 'Min' },
  { cost: 'cost_normal', markup: 'markup_normal',  label: 'Normal' },
  { cost: 'cost_q45',   markup: 'markup_q45',     label: '+45' },
  { cost: 'cost_q100',  markup: 'markup_q100',    label: '+100' },
  { cost: 'cost_q300',  markup: 'markup_q300',    label: '+300' },
  { cost: 'cost_q500',  markup: 'markup_q500',    label: '+500' },
  { cost: 'cost_q1000', markup: 'markup_q1000',   label: '+1000' },
  { cost: 'cost_q3000', markup: 'markup_q3000',   label: '+3000' },
];

const STATUS_OPTIONS = ['draft','active','submitted','won','lost','expired'];

function daysUntil(d: string | null | undefined): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.substring(0, 10);
}

export default function TenderWorkspace({ tenderId, onBack }: TenderWorkspaceProps) {
  const [tender, setTender] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [markups, setMarkups] = useState<Record<string, number>>({});

  // Import panel
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importNotes, setImportNotes] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Simulator
  const [actualWeight, setActualWeight] = useState('');
  const [volumeWeight, setVolumeWeight] = useState('');

  // Copy config
  const [copyBrackets, setCopyBrackets] = useState<Record<string, boolean>>({
    cost_min: true, cost_normal: true, cost_q45: true, cost_q100: true,
    cost_q300: true, cost_q500: true, cost_q1000: true, cost_q3000: true,
  });
  const [copyMode, setCopyMode] = useState<'cost' | 'selling'>('selling');
  const [copyWithMeta, setCopyWithMeta] = useState(true);

  // Active tab
  const [tab, setTab] = useState<'rates' | 'simulator' | 'copy'>('rates');
  // Expanded row (metadata viewer)
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const fetchTender = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tenders/${tenderId}`);
      const data = await res.json();
      setTender(data);
      setMarkups({
        markup_min:   data.markup_min   || 0,
        markup_normal: data.markup_normal || 0,
        markup_q45:   data.markup_q45   || 0,
        markup_q100:  data.markup_q100  || 0,
        markup_q300:  data.markup_q300  || 0,
        markup_q500:  data.markup_q500  || 0,
        markup_q1000: data.markup_q1000 || 0,
        markup_q3000: data.markup_q3000 || 0,
      });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTender(); }, [tenderId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const updateTender = async (updates: Record<string, any>) => {
    await fetch(`${API_BASE}/api/tenders/${tenderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
  };

  const saveMarkups = async () => {
    await updateTender(markups);
    showToast('Markup lagret ✓');
  };

  const deleteRate = async (rateId: number) => {
    await fetch(`${API_BASE}/api/tenders/${tenderId}/rates/${rateId}`, { method: 'DELETE' });
    fetchTender();
  };

  const updateRateField = async (rateId: number, updates: Record<string, any>) => {
    await fetch(`${API_BASE}/api/tenders/${tenderId}/rates/${rateId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
  };

  const handlePreview = async () => {
    if (!importFile) return;
    setIsPreviewing(true);
    setPreview(null);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const res = await fetch(`${API_BASE}/api/tenders/${tenderId}/import/preview`, { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json();
        showToast(`Feil: ${err.detail}`);
        return;
      }
      setPreview(await res.json());
    } catch (e) { showToast('Kunne ikke lese fil'); }
    finally { setIsPreviewing(false); }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setIsImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      if (importNotes) fd.append('import_notes', importNotes);

      const res = await fetch(`${API_BASE}/api/tenders/${tenderId}/import`, { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json();
        showToast(`Feil: ${err.detail}`);
        return;
      }
      const data = await res.json();
      showToast(`✓ Importert ${data.lane_count} rater (${data.format_detected})`);
      setShowImport(false);
      setImportFile(null);
      setImportNotes('');
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchTender();
    } catch (e) { showToast('Importfeil'); }
    finally { setIsImporting(false); }
  };

  const getSelling = (cost: number | null, markupKey: string) => {
    if (cost == null) return null;
    return cost * (1 + (markups[markupKey] || 0) / 100);
  };

  // Simulator
  const chargeableWeight = Math.max(parseFloat(actualWeight) || 0, parseFloat(volumeWeight) || 0);
  const simResults = useMemo(() => {
    if (!tender || chargeableWeight <= 0) return [];
    const thresholds = [
      { min: 3000, costKey: 'cost_q3000', markupKey: 'markup_q3000', label: '+3000kg' },
      { min: 1000, costKey: 'cost_q1000', markupKey: 'markup_q1000', label: '+1000kg' },
      { min: 500,  costKey: 'cost_q500',  markupKey: 'markup_q500',  label: '+500kg' },
      { min: 300,  costKey: 'cost_q300',  markupKey: 'markup_q300',  label: '+300kg' },
      { min: 100,  costKey: 'cost_q100',  markupKey: 'markup_q100',  label: '+100kg' },
      { min: 45,   costKey: 'cost_q45',   markupKey: 'markup_q45',   label: '+45kg' },
      { min: 0,    costKey: 'cost_normal',markupKey: 'markup_normal', label: 'Normal' },
    ];
    const bracket = thresholds.find(t => chargeableWeight >= t.min)!;

    return (tender.rates || [])
      .filter((r: any) => r[bracket.costKey] != null)
      .map((r: any) => {
        const costRate = r[bracket.costKey];
        const sellRate = getSelling(costRate, bracket.markupKey);
        return {
          ...r,
          bracketLabel: bracket.label,
          costRate, totalCost: costRate * chargeableWeight,
          sellRate, totalSell: sellRate ? sellRate * chargeableWeight : null,
          margin: sellRate ? (sellRate - costRate) * chargeableWeight : null,
        };
      })
      .sort((a: any, b: any) => a.totalCost - b.totalCost);
  }, [tender, actualWeight, volumeWeight, markups]);

  const copyRateToClipboard = (rate: any) => {
    const parts: string[] = [];
    if (copyWithMeta) {
      const iata = rate.airline?.split(',')[0]?.trim() || '';
      parts.push(iata, rate.origin || '', rate.destination || '', rate.via || '');
    }
    parts.push(rate.currency || 'NOK');
    BRACKETS.forEach(b => {
      if (!copyBrackets[b.cost]) return;
      const cost = rate[b.cost];
      const val = copyMode === 'selling' ? getSelling(cost, b.markup) : cost;
      parts.push(val != null ? val.toFixed(2) : '');
    });
    navigator.clipboard.writeText(parts.join('\t'));
    showToast('Kopiert til utklippstavle ✓');
  };

  // Rate expiry info
  const getRateExpiryStatus = (rate: any) => {
    const days = daysUntil(rate.valid_until || tender?.valid_until);
    if (days === null) return null;
    if (days < 0) return { label: `Expired`, color: '#f87171' };
    if (days <= 7) return { label: `${days}d left`, color: '#f59e0b' };
    return { label: `${days}d`, color: '#6b7280' };
  };

  if (loading) return <div style={{ color: '#9ca3af', padding: '32px' }}>Loading tender...</div>;
  if (!tender) return <div style={{ color: '#f87171', padding: '32px' }}>Tender ikke funnet</div>;

  const tenderDays = daysUntil(tender.valid_until);

  return (
    <div className="view-container">
      {toast && <div className="toast">{toast}</div>}

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button className="btn back-btn" onClick={onBack}>← Tilbake</button>
        <select
          defaultValue={tender.status}
          onChange={e => { updateTender({ status: e.target.value }); fetchTender(); }}
          style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: '6px', background: 'var(--bg-secondary)', color: '#f9fafb', border: '1px solid var(--border-color)' }}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        {tenderDays !== null && (
          <span style={{
            fontSize: '0.8rem', fontWeight: 600, padding: '3px 10px', borderRadius: '12px',
            color: tenderDays < 0 ? '#f87171' : tenderDays <= 7 ? '#f59e0b' : '#10b981',
            background: tenderDays < 0 ? '#f8717122' : tenderDays <= 7 ? '#f59e0b22' : '#10b98122',
          }}>
            {tenderDays < 0 ? `⚠ Utløpt for ${Math.abs(tenderDays)} dager siden` : `⏰ ${tenderDays} dager igjen`}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button className="btn" style={{ fontSize: '0.8rem' }} onClick={() => setShowImport(!showImport)}>
            📂 Import Excel
          </button>
        </div>
      </div>

      {/* ── Tender Info ── */}
      <div className="glass-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div className="filter-group" style={{ flex: 3, minWidth: '160px' }}>
            <label className="filter-label">Tender navn</label>
            <input type="text" className="text-input" defaultValue={tender.name}
              onBlur={e => updateTender({ name: e.target.value })} />
          </div>
          <div className="filter-group" style={{ flex: 2, minWidth: '140px' }}>
            <label className="filter-label">Kunde</label>
            <input type="text" className="text-input" defaultValue={tender.customer || ''}
              onBlur={e => updateTender({ customer: e.target.value })} placeholder="Kundenavn..." />
          </div>
          <div className="filter-group" style={{ flex: 2, minWidth: '120px' }}>
            <label className="filter-label">Gyldig fra</label>
            <input type="date" className="text-input" defaultValue={toDateInputValue(tender.valid_from)}
              onBlur={e => updateTender({ valid_from: e.target.value || null })} />
          </div>
          <div className="filter-group" style={{ flex: 2, minWidth: '120px' }}>
            <label className="filter-label">Gyldig til / Frist</label>
            <input type="date" className="text-input" defaultValue={toDateInputValue(tender.valid_until)}
              onBlur={e => { updateTender({ valid_until: e.target.value || null }); setTimeout(fetchTender, 300); }} />
          </div>
        </div>

        {/* System URL */}
        <div className="filter-group" style={{ marginBottom: '12px' }}>
          <label className="filter-label">Systemlenke (TE Connect / Siouxfalls etc.)</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="url" className="text-input" defaultValue={tender.tender_url || ''}
              onBlur={e => updateTender({ tender_url: e.target.value || null })}
              placeholder="https://teconnect.te.com/tender/..." />
            {tender.tender_url && (
              <a href={tender.tender_url} target="_blank" rel="noopener noreferrer"
                className="btn" style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                🔗 Åpne
              </a>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="filter-group">
          <label className="filter-label">Notater & vurderinger</label>
          <textarea className="notes-textarea" defaultValue={tender.notes || ''}
            onBlur={e => updateTender({ notes: e.target.value })}
            placeholder="Skriv dine vurderinger, strategi, observasjoner..." rows={3} />
        </div>
      </div>

      {/* ── Import Panel ── */}
      {showImport && (
        <div className="glass-card" style={{ marginBottom: '20px', border: '1px dashed #3b82f666' }}>
          <h3 style={{ color: '#f9fafb', fontSize: '1rem', marginBottom: '12px' }}>📂 Smart Import</h3>
          <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginBottom: '12px' }}>
            Last opp en Excel-fil. Systemet auto-detekterer formatet, leser alle kolonner, og viser deg hva den fant før du importerer.
          </div>

          {/* Step 1: File selection */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'stretch', marginBottom: '16px' }}>
            <div 
              style={{ 
                flex: 3, 
                border: '2px dashed #4b5563', 
                borderRadius: '8px', 
                padding: '20px', 
                textAlign: 'center',
                position: 'relative',
                background: 'rgba(0,0,0,0.2)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                transition: 'all 0.2s'
              }}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'; }}
              onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#4b5563'; e.currentTarget.style.background = 'rgba(0,0,0,0.2)'; }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = '#4b5563';
                e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  setImportFile(e.dataTransfer.files[0]);
                  setPreview(null);
                  if (fileInputRef.current) fileInputRef.current.files = e.dataTransfer.files;
                }
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                ref={fileInputRef} 
                type="file" 
                accept=".xls,.xlsx" 
                style={{ display: 'none' }}
                onChange={e => { setImportFile(e.target.files?.[0] || null); setPreview(null); }} 
              />
              <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{importFile ? '📄' : '📁'}</div>
              <div style={{ color: importFile ? '#10b981' : '#f9fafb', fontWeight: 600, marginBottom: '4px' }}>
                {importFile ? importFile.name : 'Klikk for å velge fil, eller dra filen hit'}
              </div>
              <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Kun .xlsx og .xls filer (maks 10MB)</div>
            </div>
            
            <button className="btn" onClick={handlePreview}
              disabled={!importFile || isPreviewing} 
              style={{ whiteSpace: 'nowrap', alignSelf: 'center', height: 'fit-content' }}>
              {isPreviewing ? '🔍 Leser...' : '🔍 Forhåndsvis'}
            </button>
          </div>

          {/* Step 2: Preview results */}
          {preview && (
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div style={{ background: '#10b98122', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem' }}>
                  <span style={{ color: '#9ca3af' }}>Format: </span>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>{preview.format_detected}</span>
                </div>
                <div style={{ background: '#3b82f622', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem' }}>
                  <span style={{ color: '#9ca3af' }}>Ark: </span>
                  <span style={{ color: '#3b82f6', fontWeight: 600 }}>{preview.sheet_used}</span>
                </div>
                <div style={{ background: '#f59e0b22', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem' }}>
                  <span style={{ color: '#9ca3af' }}>Retning: </span>
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>{preview.direction === 'export' ? '📤 Eksport fra Norge' : preview.direction === 'import' ? '📥 Import til Norge' : '❓ Ukjent'}</span>
                </div>
                <div style={{ background: '#8b5cf622', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem' }}>
                  <span style={{ color: '#9ca3af' }}>Rater funnet: </span>
                  <span style={{ color: '#8b5cf6', fontWeight: 700, fontSize: '1rem' }}>{preview.total_rates}</span>
                </div>
              </div>

              {/* Mapped columns */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '6px' }}>✅ Gjenkjente kolonner ({Object.keys(preview.columns_mapped).length}):</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {Object.entries(preview.columns_mapped).map(([field, col]: any) => (
                    <span key={field} style={{ background: '#10b98115', border: '1px solid #10b98133', color: '#a7f3d0', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem' }}>
                      {col}: {field}
                    </span>
                  ))}
                </div>
              </div>

              {/* Unmapped columns */}
              {preview.columns_unmapped.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '6px' }}>⚠️ Ikke-gjenkjente kolonner ({preview.columns_unmapped.length}):</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {preview.columns_unmapped.map((col: string, i: number) => (
                      <span key={i} style={{ background: '#f59e0b15', border: '1px solid #f59e0b33', color: '#fcd34d', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem' }}>
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sample rows */}
              {preview.sample_rows.length > 0 && (
                <div>
                  <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '6px' }}>Eksempel (første {preview.sample_rows.length} rader):</div>
                  <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    <table style={{ fontSize: '0.75rem' }}>
                      <thead>
                        <tr>
                          <th>Airline</th><th>Product</th><th>Origin</th><th>Dest</th><th>Via</th>
                          <th>Min</th><th>Normal</th><th>+45</th><th>+100</th><th>+300</th><th>+500</th><th>+1000</th>
                          <th>Curr</th><th>Valid</th><th>Expires</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.sample_rows.map((r: any, i: number) => (
                          <tr key={i}>
                            <td>{r.airline || '-'}</td><td>{r.product || '-'}</td>
                            <td>{r.origin || '-'}</td><td>{r.destination || '-'}</td><td>{r.via || '-'}</td>
                            <td>{r.cost_min ?? '-'}</td><td>{r.cost_normal ?? '-'}</td>
                            <td>{r.cost_q45 ?? '-'}</td><td>{r.cost_q100 ?? '-'}</td>
                            <td>{r.cost_q300 ?? '-'}</td><td>{r.cost_q500 ?? '-'}</td><td>{r.cost_q1000 ?? '-'}</td>
                            <td>{r.currency || '-'}</td>
                            <td style={{ fontSize: '0.7rem' }}>{r.valid_from ? new Date(r.valid_from).toLocaleDateString('no-NO') : '-'}</td>
                            <td style={{ fontSize: '0.7rem' }}>{r.valid_until ? new Date(r.valid_until).toLocaleDateString('no-NO') : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Step 3: Confirm import */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <div className="filter-group" style={{ flex: 2 }}>
                  <label className="filter-label">2. Notat (valgfritt)</label>
                  <input type="text" className="text-input" value={importNotes} onChange={e => setImportNotes(e.target.value)}
                    placeholder="F.eks. Rev.2, Oppdaterte rater..." />
                </div>
                <button className="btn btn-primary" onClick={handleImport}
                  disabled={isImporting || preview.total_rates === 0} style={{ whiteSpace: 'nowrap' }}>
                  {isImporting ? 'Importerer...' : `✅ Importer ${preview.total_rates} rater`}
                </button>
              </div>
            </div>
          )}

          {/* Import history */}
          {tender.imports && tender.imports.length > 0 && (
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '8px' }}>Tidligere importer:</div>
              {tender.imports.map((imp: any) => (
                <div key={imp.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.8rem', color: '#6b7280', padding: '4px 0' }}>
                  <span>📄 {imp.filename}</span>
                  <span>·</span>
                  <span>{imp.lane_count} rater</span>
                  <span>·</span>
                  <span>{new Date(imp.imported_at).toLocaleDateString('no', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  {imp.notes && <span style={{ color: '#4b5563' }}>· {imp.notes}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Markup ── */}
      <div className="glass-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ color: '#f9fafb', fontSize: '1rem', fontWeight: 600 }}>Markup % per vektklasse</h3>
          <button className="btn" style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={saveMarkups}>Lagre</button>
        </div>
        <div className="markup-row">
          {BRACKETS.map(b => (
            <div key={b.markup} style={{ textAlign: 'center' }}>
              <div className="filter-label">{b.label}</div>
              <input type="number" className="markup-input" step="0.5"
                value={markups[b.markup] ?? 0}
                onChange={e => setMarkups({ ...markups, [b.markup]: parseFloat(e.target.value) || 0 })}
                onBlur={saveMarkups} />
              <div style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '2px' }}>%</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '0' }}>
        {([['rates', `Rater (${tender.rates?.length || 0})`], ['simulator', 'Simulator'], ['copy', 'Kopier til system']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              padding: '8px 16px', fontSize: '0.85rem', cursor: 'pointer', border: 'none', background: 'none',
              color: tab === key ? '#f9fafb' : '#6b7280',
              borderBottom: tab === key ? '2px solid #3b82f6' : '2px solid transparent',
              fontFamily: 'inherit', fontWeight: tab === key ? 600 : 400,
              marginBottom: '-1px', transition: 'all 0.15s ease',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ══ TAB: RATES ══ */}
      {tab === 'rates' && (
        <div className="glass-card">
          {(!tender.rates || tender.rates.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📭</div>
              Ingen rater ennå. Importer en Excel-fil, eller legg til rater fra Dashboard.
            </div>
          ) : (
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: '900px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '32px' }}></th>
                    <th>Carrier</th>
                    <th>Produkt</th>
                    <th>Lane</th>
                    <th>Via</th>
                    {BRACKETS.map(b => <th key={b.cost}>{b.label}</th>)}
                    <th>Curr</th>
                    <th>Gyldig til</th>
                    <th>Notater</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tender.rates.map((rate: any) => {
                    const iata = rate.airline?.split(',')[0]?.trim() || '';
                    const expiry = getRateExpiryStatus(rate);
                    return (
                      <React.Fragment key={rate.id}>
                        {/* Cost row */}
                        <tr className="cost-row">
                          <td rowSpan={2}>
                            <input type="checkbox" checked={rate.is_selected}
                              onChange={e => { updateRateField(rate.id, { is_selected: e.target.checked }); fetchTender(); }}
                              title="Merk som valgt" style={{ cursor: 'pointer' }} />
                          </td>
                          <td rowSpan={2}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {iata && <img src={`https://images.kiwi.com/airlines/64/${iata}.png`} alt={iata}
                                width="18" height="18" style={{ borderRadius: '3px' }}
                                onError={e => (e.currentTarget.style.display = 'none')} />}
                              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{rate.airline}</span>
                            </div>
                          </td>
                          <td rowSpan={2} style={{ fontSize: '0.78rem' }}>{rate.product || '-'}</td>
                          <td rowSpan={2} style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                            <div style={{ cursor: rate.extra_data ? 'pointer' : 'default' }} onClick={() => rate.extra_data && setExpandedRow(expandedRow === rate.id ? null : rate.id)}>
                              {rate.origin}→{rate.destination}
                              {rate.origin_city && <div style={{ color: '#6b7280', fontSize: '0.68rem' }}>{rate.origin_city}{rate.origin_zip ? ` (${rate.origin_zip})` : ''}</div>}
                              {rate.destination_city && <div style={{ color: '#6b7280', fontSize: '0.68rem' }}>→ {rate.destination_city}{rate.destination_zip ? ` (${rate.destination_zip})` : ''}</div>}
                              {rate.lane_id && <div style={{ color: '#4b5563', fontSize: '0.68rem' }}>#{rate.lane_id}</div>}
                              {rate.extra_data && <span style={{ color: '#3b82f6', fontSize: '0.65rem' }}>{expandedRow === rate.id ? '▼ Skjul detaljer' : '▶ Vis detaljer'}</span>}
                            </div>
                          </td>
                          <td rowSpan={2} style={{ fontSize: '0.75rem' }}>{rate.via || rate.routing || '-'}</td>
                          {BRACKETS.map(b => (
                            <td key={b.cost} style={{ fontSize: '0.8rem', color: '#d1d5db' }}>
                              {rate[b.cost] != null ? rate[b.cost].toFixed(2) : <span style={{ color: '#374151' }}>-</span>}
                            </td>
                          ))}
                          <td rowSpan={2} style={{ fontSize: '0.75rem', color: '#6b7280' }}>{rate.currency || 'NOK'}</td>
                          <td rowSpan={2}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <input type="date" className="text-input" style={{ fontSize: '0.7rem', padding: '3px 6px' }}
                                defaultValue={toDateInputValue(rate.valid_until || tender.valid_until)}
                                onBlur={e => updateRateField(rate.id, { valid_until: e.target.value || null })} />
                              {expiry && <span style={{ fontSize: '0.68rem', color: expiry.color, fontWeight: 600 }}>{expiry.label}</span>}
                            </div>
                          </td>
                          <td rowSpan={2}>
                            <input type="text" className="text-input" style={{ width: '90px', fontSize: '0.72rem', padding: '3px 6px' }}
                              defaultValue={rate.notes || ''} placeholder="Notat..."
                              onBlur={e => updateRateField(rate.id, { notes: e.target.value })} />
                          </td>
                          <td rowSpan={2}>
                            <button className="btn btn-danger" style={{ padding: '2px 7px', fontSize: '0.68rem' }}
                              onClick={() => deleteRate(rate.id)}>✕</button>
                          </td>
                        </tr>
                        {/* Selling row */}
                        <tr className="sell-row">
                          {BRACKETS.map(b => {
                            const sell = getSelling(rate[b.cost], b.markup);
                            return (
                              <td key={b.cost + '_s'} style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
                                {sell != null ? sell.toFixed(2) : <span style={{ color: '#374151' }}>-</span>}
                              </td>
                            );
                          })}
                        </tr>
                        {/* Metadata expansion row */}
                        {expandedRow === rate.id && rate.extra_data && (() => {
                          const meta = JSON.parse(rate.extra_data);
                          const entries = Object.entries(meta);
                          if (!entries.length) return null;
                          return (
                            <tr>
                              <td colSpan={20} style={{ background: 'rgba(0,0,0,0.25)', padding: '10px 16px' }}>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  {entries.map(([k, v]: [string, any]) => (
                                    <span key={k} style={{ background: '#1e293b', padding: '3px 8px', borderRadius: '6px', fontSize: '0.7rem' }}>
                                      <span style={{ color: '#9ca3af' }}>{k}: </span>
                                      <span style={{ color: '#e2e8f0' }}>{v}</span>
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })()}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ padding: '8px 16px', fontSize: '0.73rem', color: '#4b5563', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '16px' }}>
                <span><span style={{ color: '#d1d5db' }}>■</span> Kostpris (øvre rad)</span>
                <span><span style={{ color: '#10b981' }}>■</span> Salgspris = kostpris + markup% (nedre rad)</span>
                <span>☑ Merk preferert rate</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: SIMULATOR ══ */}
      {tab === 'simulator' && (
        <div className="glass-card">
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'flex-end' }}>
            <div className="filter-group">
              <label className="filter-label">Actual weight (kg)</label>
              <input type="number" className="text-input" value={actualWeight}
                onChange={e => setActualWeight(e.target.value)} placeholder="0" style={{ width: '130px' }} />
            </div>
            <div className="filter-group">
              <label className="filter-label">Volume weight (kg)</label>
              <input type="number" className="text-input" value={volumeWeight}
                onChange={e => setVolumeWeight(e.target.value)} placeholder="0" style={{ width: '130px' }} />
            </div>
            {chargeableWeight > 0 && (
              <div style={{ padding: '8px 16px', background: 'rgba(245,158,11,0.1)', borderRadius: '8px', border: '1px solid #f59e0b44' }}>
                <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Chargeable weight</div>
                <div style={{ color: '#f59e0b', fontSize: '1.4rem', fontWeight: 700 }}>{chargeableWeight.toFixed(1)} kg</div>
              </div>
            )}
          </div>

          {chargeableWeight > 0 && simResults.length === 0 && (
            <div style={{ color: '#9ca3af', padding: '16px' }}>Ingen rater å simulere på.</div>
          )}

          {simResults.length > 0 && (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Carrier</th>
                    <th>Produkt</th>
                    <th>Lane</th>
                    <th>Bracket</th>
                    <th>Rate/kg (kost)</th>
                    <th>Total kost</th>
                    <th>Rate/kg (salg)</th>
                    <th>Total salg</th>
                    <th>Margin</th>
                    <th>Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {simResults.map((r: any, i: number) => {
                    const marginPct = r.totalSell && r.totalCost ? ((r.totalSell - r.totalCost) / r.totalSell) * 100 : null;
                    const isFirst = i === 0;
                    return (
                      <tr key={i} style={{ background: isFirst ? 'rgba(16, 185, 129, 0.06)' : undefined }}>
                        <td style={{ fontWeight: isFirst ? 700 : 400 }}>
                          {isFirst && <span style={{ color: '#10b981', marginRight: '4px' }}>🏆</span>}
                          {r.airline}
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>{r.product || '-'}</td>
                        <td style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{r.origin}→{r.destination}</td>
                        <td><span style={{ background: '#1e3a5f', color: '#93c5fd', padding: '2px 7px', borderRadius: '10px', fontSize: '0.75rem' }}>{r.bracketLabel}</span></td>
                        <td>{r.costRate?.toFixed(2)} <span style={{ color: '#4b5563', fontSize: '0.75rem' }}>{r.currency}</span></td>
                        <td style={{ fontWeight: 600 }}>{r.totalCost?.toFixed(0)} {r.currency}</td>
                        <td style={{ color: '#10b981' }}>{r.sellRate?.toFixed(2)} <span style={{ color: '#4b5563', fontSize: '0.75rem' }}>{r.currency}</span></td>
                        <td style={{ color: '#10b981', fontWeight: 600 }}>{r.totalSell?.toFixed(0)} {r.currency}</td>
                        <td style={{ color: '#f59e0b', fontWeight: 600 }}>{r.margin?.toFixed(0)} {r.currency}</td>
                        <td style={{ color: marginPct && marginPct > 15 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                          {marginPct?.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: COPY ══ */}
      {tab === 'copy' && (
        <div className="glass-card">
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'flex-start' }}>
            <div>
              <label className="filter-label" style={{ display: 'block', marginBottom: '8px' }}>Inkluder vektklasser</label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {BRACKETS.map(b => (
                  <label key={b.cost} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#9ca3af', fontSize: '0.82rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={copyBrackets[b.cost]}
                      onChange={e => setCopyBrackets({ ...copyBrackets, [b.cost]: e.target.checked })} />
                    {b.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="filter-label" style={{ display: 'block', marginBottom: '8px' }}>Verdier</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {[['cost', 'Kostpris'], ['selling', 'Salgspris']].map(([val, lbl]) => (
                  <label key={val} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '0.85rem', color: copyMode === val ? '#f9fafb' : '#6b7280' }}>
                    <input type="radio" name="copyMode" checked={copyMode === val as any} onChange={() => setCopyMode(val as any)} />
                    {lbl}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="filter-label" style={{ display: 'block', marginBottom: '8px' }}>Med metadata</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '0.85rem', color: '#9ca3af' }}>
                <input type="checkbox" checked={copyWithMeta} onChange={e => setCopyWithMeta(e.target.checked)} />
                Carrier, Origin, Dest, Via
              </label>
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', color: '#4b5563', marginBottom: '16px' }}>
            Tab-separerte verdier — lim direkte inn i Excel/systemet.
          </div>

          {(!tender.rates || tender.rates.length === 0) ? (
            <div style={{ color: '#9ca3af' }}>Ingen rater å kopiere.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {tender.rates.map((rate: any) => (
                <div key={rate.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
                  background: rate.is_selected ? 'rgba(59,130,246,0.08)' : 'rgba(0,0,0,0.2)',
                  borderRadius: '8px',
                  border: rate.is_selected ? '1px solid #3b82f633' : '1px solid transparent'
                }}>
                  {rate.is_selected && <span style={{ color: '#3b82f6', fontSize: '0.75rem' }}>✓</span>}
                  <div style={{ flex: 1, fontSize: '0.82rem', color: '#d1d5db' }}>
                    <span style={{ fontWeight: 600 }}>{rate.airline}</span>
                    <span style={{ color: '#6b7280' }}> — {rate.product || 'N/A'}</span>
                    <span style={{ color: '#4b5563' }}> · {rate.origin}→{rate.destination}</span>
                    {rate.lane_id && <span style={{ color: '#374151', fontSize: '0.72rem' }}> · #{rate.lane_id}</span>}
                  </div>
                  <button className="btn" style={{ fontSize: '0.75rem', padding: '4px 12px', whiteSpace: 'nowrap' }}
                    onClick={() => copyRateToClipboard(rate)}>
                    📋 Kopier
                  </button>
                </div>
              ))}
              <div style={{ marginTop: '8px' }}>
                <button className="btn btn-primary" style={{ fontSize: '0.8rem' }}
                  onClick={() => {
                    const selected = tender.rates.filter((r: any) => r.is_selected);
                    const toProcess = selected.length > 0 ? selected : tender.rates;
                    const rows = toProcess.map((rate: any) => {
                      const parts: string[] = [];
                      if (copyWithMeta) {
                        const iata = rate.airline?.split(',')[0]?.trim() || '';
                        parts.push(iata, rate.origin || '', rate.destination || '', rate.via || '');
                      }
                      parts.push(rate.currency || 'NOK');
                      BRACKETS.forEach(b => {
                        if (!copyBrackets[b.cost]) return;
                        const cost = rate[b.cost];
                        const val = copyMode === 'selling' ? getSelling(cost, b.markup) : cost;
                        parts.push(val != null ? val.toFixed(2) : '');
                      });
                      return parts.join('\t');
                    });
                    navigator.clipboard.writeText(rows.join('\n'));
                    showToast(`✓ Kopiert ${toProcess.length} rater`);
                  }}>
                  📋 Kopier alle{tender.rates.filter((r: any) => r.is_selected).length > 0 ? ` valgte (${tender.rates.filter((r: any) => r.is_selected).length})` : ''}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
