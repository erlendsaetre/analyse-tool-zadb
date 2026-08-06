import React, { useState, useEffect, useMemo } from 'react';

const API_BASE = 'https://athletic-essence-production-5a0c.up.railway.app';

interface TenderMini {
  id: number;
  name: string;
}

interface DashboardProps {
  defaultUploadId: number | null;
}

const WEIGHT_BRACKETS = [
  { id: 'min_rate', label: 'Min' },
  { id: 'normal_rate', label: 'Normal' },
  { id: 'q45', label: '+45kg' },
  { id: 'q100', label: '+100kg' },
  { id: 'q300', label: '+300kg' },
  { id: 'q500', label: '+500kg' },
  { id: 'q1000', label: '+1000kg' },
  { id: 'q3000', label: '+3000kg' }
];

export default function Dashboard({ defaultUploadId }: DashboardProps) {
  const [routes, setRoutes] = useState<any[]>([]);
  const [airlines, setAirlines] = useState<string[]>([]);
  const [uploads, setUploads] = useState<any[]>([]);
  const [comparison, setComparison] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [tendersList, setTendersList] = useState<TenderMini[]>([]);
  const [openTenderDropdown, setOpenTenderDropdown] = useState<number | null>(null);
  const [tenderToast, setTenderToast] = useState('');

  // Filters
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [selectedAirline, setSelectedAirline] = useState<string>('');
  const [selectedUpload, setSelectedUpload] = useState<string>(defaultUploadId ? defaultUploadId.toString() : '');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  
  const [selectedBracket, setSelectedBracket] = useState<string>('q100');
  
  // Sort State
  const [sortField, setSortField] = useState<string>('airline');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetch(`${API_BASE}/api/rates/routes`).then(r => r.json()).then(setRoutes).catch(console.error);
    fetch(`${API_BASE}/api/rates/airlines`).then(r => r.json()).then(setAirlines).catch(console.error);
    fetch(`${API_BASE}/api/uploads/`).then(r => r.json()).then(setUploads).catch(console.error);
    fetch(`${API_BASE}/api/tenders/`).then(r => r.json()).then((data: any[]) => setTendersList(data.map(t => ({ id: t.id, name: t.name })))).catch(console.error);
  }, []);

  const addToTender = async (tenderId: number, row: any) => {
    const origin = selectedRoute ? selectedRoute.split('-')[0] : '';
    const dest = selectedRoute ? selectedRoute.split('-')[1] : '';
    try {
      await fetch(`${API_BASE}/api/tenders/${tenderId}/rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          airline: row.airline, product: row.product,
          origin: origin || row.origin || '', destination: dest || row.destination || '',
          via: row.via, currency: row.currency,
          cost_min: row.min_rate, cost_normal: row.normal_rate,
          cost_q45: row.q45, cost_q100: row.q100, cost_q300: row.q300,
          cost_q500: row.q500, cost_q1000: row.q1000, cost_q3000: row.q3000,
          valid_from: row.valid_from, valid_until: row.valid_until
        })
      });
      setTenderToast('Added to tender!');
      setTimeout(() => setTenderToast(''), 2000);
    } catch (e) { console.error(e); }
    setOpenTenderDropdown(null);
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedRoute, selectedAirline, selectedUpload]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const origin = selectedRoute ? selectedRoute.split('-')[0] : '';
      const dest = selectedRoute ? selectedRoute.split('-')[1] : '';
      
      const queryParams = new URLSearchParams();
      if (origin) queryParams.append('origin', origin);
      if (dest) queryParams.append('destination', dest);
      if (selectedUpload) queryParams.append('upload_id', selectedUpload);
      if (selectedAirline) queryParams.append('airline', selectedAirline);
      
      const compRes = await fetch(`${API_BASE}/api/rates/comparison?${queryParams.toString()}`);
      const compData = await compRes.json();
      setComparison(compData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getProductCategory = (product: string) => {
    if (!product) return 'KN Extend / KN Expert';
    const p = product.toLowerCase();
    if (p.includes('flash') || p.includes('zoom') || p.includes('xps') || p.includes('express')) {
      return 'KN Express';
    }
    return 'KN Extend / KN Expert';
  };

  // Compute derived data locally for immediate filtering
  const { filteredData, products, categories, analytics } = useMemo(() => {
    const productsSet = new Set<string>();
    const categoriesSet = new Set<string>();

    let filtered = comparison;

    // Build sets for dropdowns based on current route/airline filter
    comparison.forEach(r => {
      if (r.product) productsSet.add(r.product);
      categoriesSet.add(getProductCategory(r.product));
    });

    // Apply product and category filters
    if (selectedProduct) {
      filtered = filtered.filter(r => r.product === selectedProduct);
    }
    if (selectedCategory) {
      filtered = filtered.filter(r => getProductCategory(r.product) === selectedCategory);
    }

    // Compute Analytics
    const validPrices = filtered.map(r => r[selectedBracket]).filter(p => p !== null && p !== undefined);
    const minPrice = validPrices.length ? Math.min(...validPrices) : null;
    const maxPrice = validPrices.length ? Math.max(...validPrices) : null;
    
    let cheapestItem = null;
    if (minPrice !== null) {
      cheapestItem = filtered.find(r => r[selectedBracket] === minPrice);
    }

    const airlinesWithPrices = new Set(filtered.filter(r => r[selectedBracket] !== null && r[selectedBracket] !== undefined).map(r => r.airline));
    const allAirlines = new Set(filtered.map(r => r.airline));

    const computedAnalytics = {
      total_rates: filtered.length,
      airlines_with_prices: airlinesWithPrices.size,
      total_airlines: allAirlines.size,
      cheapest_airline: cheapestItem?.airline || '-',
      cheapest_product: cheapestItem?.product || '-',
      cheapest_price: minPrice,
      price_range_min: minPrice,
      price_range_max: maxPrice,
    };

    return { 
      filteredData: filtered, 
      products: Array.from(productsSet).sort(), 
      categories: Array.from(categoriesSet).sort(),
      analytics: computedAnalytics
    };
  }, [comparison, selectedProduct, selectedCategory, selectedBracket]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedData = (data: any[]) => {
    return [...data].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA === null || valA === undefined) valA = sortDirection === 'asc' ? Infinity : -Infinity;
      if (valB === null || valB === undefined) valB = sortDirection === 'asc' ? Infinity : -Infinity;

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const getColorClass = (val: number | null, columnPrices: number[]) => {
    if (val === null || val === undefined) return '';
    const validPrices = columnPrices.filter(p => p !== null && p !== undefined);
    if (validPrices.length === 0) return '';
    
    const min = Math.min(...validPrices);
    const max = Math.max(...validPrices);
    
    if (val === min) return 'price-best';
    if (val === max) return 'price-worst';
    
    validPrices.sort((a, b) => a - b);
    const q25 = validPrices[Math.floor(validPrices.length * 0.25)];
    const q75 = validPrices[Math.floor(validPrices.length * 0.75)];
    
    if (val <= q25) return 'price-good';
    if (val >= q75) return 'price-high';
    return 'price-mid';
  };

  const getIataCode = (airline: string) => {
    const match = airline.split(' - ')[0];
    if (match && match.length === 2) return match;
    return '';
  };

  const daysUntil = (d: string | null | undefined): number | null => {
    if (!d) return null;
    return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  };

  const renderComparisonTable = () => {
    if (!filteredData.length) return <div style={{padding: '20px', color: '#9ca3af'}}>No data available for the selected filters.</div>;

    const brackets = ['min_rate', 'normal_rate', 'q45', 'q100', 'q300', 'q500', 'q1000', 'q3000'];
    const columnsData: Record<string, number[]> = {};
    
    const hasValidRate = (row: any) => brackets.some(b => row[b] !== null && row[b] !== undefined);
    
    // We only calculate min/max colors based on rows that ACTUALLY have rates
    const validData = filteredData.filter(hasValidRate);
    brackets.forEach(b => {
      columnsData[b] = validData.map(row => row[b]).filter(v => v !== null && v !== undefined);
    });

    const expressData = validData.filter(r => getProductCategory(r.product) === 'KN Express');
    const extendData = validData.filter(r => getProductCategory(r.product) === 'KN Extend / KN Expert');
    const adHocData = filteredData.filter(r => !hasValidRate(r));

    const renderTableGroup = (title: string, data: any[], color: string, showBrackets: boolean) => {
      if (!data.length) return null;
      const sorted = getSortedData(data);
      
      return (
        <div style={{ marginBottom: '32px' }}>
          <h4 style={{ color: color, marginBottom: '12px', fontSize: '1.1rem', borderBottom: '1px solid #374151', paddingBottom: '8px' }}>
            {title} ({data.length})
          </h4>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{width: '40px'}}></th>
                  <th onClick={() => handleSort('airline')} style={{cursor: 'pointer'}}>Airline {sortField === 'airline' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</th>
                  <th>GSA</th>
                  <th onClick={() => handleSort('product')} style={{cursor: 'pointer'}}>Product {sortField === 'product' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</th>
                  <th>Via</th>
                  {showBrackets && WEIGHT_BRACKETS.map(b => (
                    <th key={b.id} onClick={() => handleSort(b.id)} style={{cursor: 'pointer'}}>
                      {b.label} {sortField === b.id ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ))}
                  {!showBrackets && <th>Status</th>}
                  <th>Curr</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, idx) => {
                  const iata = getIataCode(row.airline);
                  const days = daysUntil(row.valid_until);
                  const expiryColor = days !== null ? (days < 0 ? '#f87171' : days <= 7 ? '#f59e0b' : '#10b981') : '#6b7280';
                  const expiryText = days !== null ? (days < 0 ? 'Expired' : `${days}d`) : '-';
                  
                  return (
                    <tr key={idx}>
                      <td style={{position: 'relative'}}>
                        <button className="add-to-tender-btn" title="Add to Tender" onClick={() => setOpenTenderDropdown(openTenderDropdown === idx ? null : idx)}>➕</button>
                        {openTenderDropdown === idx && (
                          <div className="tender-dropdown">
                            {tendersList.length === 0 ? (
                              <div style={{padding: '8px', color: '#9ca3af', fontSize: '0.8rem'}}>No tenders yet</div>
                            ) : tendersList.map(t => (
                              <div key={t.id} className="tender-dropdown-item" onClick={() => addToTender(t.id, row)}>{t.name}</div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                          {iata && <img src={`https://images.kiwi.com/airlines/64/${iata}.png`} alt={iata} width="24" height="24" style={{borderRadius: '4px'}} onError={(e) => (e.currentTarget.style.display = 'none')} />}
                          {row.airline}
                        </div>
                      </td>
                      <td>{row.gsa || '-'}</td>
                      <td>{row.product || '-'}</td>
                      <td>{row.via || '-'}</td>
                      {showBrackets ? brackets.map(b => (
                        <td key={b} className={getColorClass(row[b], columnsData[b])}>
                          {row[b] !== null && row[b] !== undefined ? row[b].toFixed(2) : '-'}
                        </td>
                      )) : (
                        <td style={{color: '#f87171'}}>Check Ad-Hoc / On Request</td>
                      )}
                      <td>{row.currency || 'USD'}</td>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: expiryColor, padding: '2px 6px', background: `${expiryColor}22`, borderRadius: '8px' }}>
                          {expiryText}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    };

    return (
      <div>
        {renderTableGroup('KN Express', expressData, '#f59e0b', true)}
        {renderTableGroup('KN Extend / KN Expert', extendData, '#3b82f6', true)}
        {renderTableGroup('Check Ad-Hoc (No published rates)', adHocData, '#9ca3af', false)}
      </div>
    );
  };

  return (
    <div className="view-container">
      {tenderToast && <div className="toast">{tenderToast}</div>}
      <div className="filter-bar">
        <div className="filter-group">
          <label className="filter-label">Route</label>
          <select value={selectedRoute} onChange={e => setSelectedRoute(e.target.value)}>
            <option value="">All Routes</option>
            {routes.map((r, i) => (
              <option key={i} value={`${r.origin}-${r.destination}`}>{r.origin} → {r.destination}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Airline</label>
          <select value={selectedAirline} onChange={e => setSelectedAirline(e.target.value)}>
            <option value="">All Airlines</option>
            {airlines.map((a, i) => <option key={i} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Category</label>
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map((c, i) => <option key={i} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Product</label>
          <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
            <option value="">All Products</option>
            {products.map((p, i) => <option key={i} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Upload</label>
          <select value={selectedUpload} onChange={e => setSelectedUpload(e.target.value)}>
            <option value="">All Time</option>
            {uploads.map(u => (
              <option key={u.id} value={u.id}>{new Date(u.upload_date).toLocaleDateString()} - {u.filename}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="summary-grid">
        <div className="glass-card summary-card blue">
          <div className="summary-label">Total Rates</div>
          <div className="summary-value">{analytics?.total_rates || 0}</div>
          <div className="summary-subtext">Across selected filters</div>
        </div>
        <div className="glass-card summary-card green">
          <div className="summary-label">Airlines Quoted</div>
          <div className="summary-value">{analytics?.airlines_with_prices || 0} / {analytics?.total_airlines || 0}</div>
          <div className="summary-subtext">Offering prices</div>
        </div>
        <div className="glass-card summary-card purple">
          <div className="summary-label">Cheapest Option</div>
          <div className="summary-value" style={{fontSize: '1.25rem'}}>{analytics?.cheapest_airline || '-'}</div>
          <div className="summary-subtext">{analytics?.cheapest_product || '-'} @ {analytics?.cheapest_price ? `${analytics.cheapest_price}` : 'N/A'}</div>
        </div>
        <div className="glass-card summary-card amber">
          <div className="summary-label">Price Range ({selectedBracket})</div>
          <div className="summary-value" style={{fontSize: '1.25rem'}}>
            {analytics?.price_range_min ? `${analytics.price_range_min.toFixed(2)} - ${analytics.price_range_max?.toFixed(2)}` : '-'}
          </div>
          <div className="summary-subtext">Min to Max spread</div>
        </div>
      </div>

      <div className="glass-card">
        <h3 style={{marginBottom: '16px', color: '#f9fafb', fontSize: '1.1rem'}}>Rate Comparison</h3>
        <div className="pills-container" style={{marginBottom: '24px'}}>
          <span style={{color: '#9ca3af', marginRight: '12px'}}>Pricing relative to:</span>
          {WEIGHT_BRACKETS.map(b => (
            <button 
              key={b.id} 
              className={`pill-btn ${selectedBracket === b.id ? 'active' : ''}`}
              onClick={() => setSelectedBracket(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
        {loading ? <div style={{color: '#9ca3af'}}>Loading table...</div> : renderComparisonTable()}
      </div>
    </div>
  );
}
