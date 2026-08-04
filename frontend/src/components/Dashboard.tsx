import React, { useState, useEffect } from 'react';

const API_BASE = 'https://athletic-essence-production-5a0c.up.railway.app';

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

  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [selectedAirline, setSelectedAirline] = useState<string>('');
  const [selectedUpload, setSelectedUpload] = useState<string>(defaultUploadId ? defaultUploadId.toString() : '');
  const [selectedBracket, setSelectedBracket] = useState<string>('q100');

  const [analytics, setAnalytics] = useState<any>(null);
  const [comparison, setComparison] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/rates/routes`).then(r => r.json()).then(setRoutes).catch(console.error);
    fetch(`${API_BASE}/api/rates/airlines`).then(r => r.json()).then(setAirlines).catch(console.error);
    fetch(`${API_BASE}/api/uploads/`).then(r => r.json()).then(setUploads).catch(console.error);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedRoute, selectedAirline, selectedUpload, selectedBracket]);

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

      const analParams = new URLSearchParams(queryParams.toString());
      analParams.append('weight_bracket', selectedBracket);
      const analRes = await fetch(`${API_BASE}/api/rates/analytics?${analParams.toString()}`);
      const analData = await analRes.json();
      setAnalytics(analData);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getColorClass = (val: number | null, columnPrices: number[]) => {
    if (val === null || val === undefined) return '';
    const validPrices = columnPrices.filter(p => p !== null && p !== undefined);
    if (validPrices.length === 0) return '';
    
    const min = Math.min(...validPrices);
    const max = Math.max(...validPrices);
    
    if (val === min) return 'price-best';
    if (val === max) return 'price-worst';
    
    // Percentiles
    validPrices.sort((a, b) => a - b);
    const q25 = validPrices[Math.floor(validPrices.length * 0.25)];
    const q75 = validPrices[Math.floor(validPrices.length * 0.75)];
    
    if (val <= q25) return 'price-good';
    if (val >= q75) return 'price-high';
    return 'price-mid';
  };

  const renderComparisonTable = () => {
    if (!comparison.length) return <div style={{padding: '20px', color: '#9ca3af'}}>No data available for the selected filters.</div>;

    const brackets = ['min_rate', 'normal_rate', 'q45', 'q100', 'q300', 'q500', 'q1000', 'q3000'];
    const columnsData: Record<string, number[]> = {};
    brackets.forEach(b => {
      columnsData[b] = comparison.map(row => row[b]).filter(v => v !== null && v !== undefined);
    });

    const sortedComparison = [...comparison].sort((a, b) => {
      const valA = a[selectedBracket] ?? Infinity;
      const valB = b[selectedBracket] ?? Infinity;
      return valA - valB;
    });

    return (
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Airline</th>
              <th>Product</th>
              <th>Via</th>
              {WEIGHT_BRACKETS.map(b => <th key={b.id}>{b.label}</th>)}
              <th>Curr</th>
            </tr>
          </thead>
          <tbody>
            {sortedComparison.map((row, idx) => (
              <tr key={idx}>
                <td>{row.airline}</td>
                <td>{row.product || '-'}</td>
                <td>{row.via || '-'}</td>
                {brackets.map(b => (
                  <td key={b} className={getColorClass(row[b], columnsData[b])}>
                    {row[b] !== null && row[b] !== undefined ? row[b].toFixed(2) : '-'}
                  </td>
                ))}
                <td>{row.currency || 'USD'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderChart = () => {
    if (!comparison.length) return null;
    
    const chartData = comparison
      .filter(row => row[selectedBracket] !== null && row[selectedBracket] !== undefined)
      .sort((a, b) => a[selectedBracket] - b[selectedBracket]);
      
    if (!chartData.length) return <div style={{padding: '20px'}}>No pricing data for this bracket.</div>;

    const maxPrice = Math.max(...chartData.map(d => d[selectedBracket]));
    const barHeight = 32;
    const barGap = 16;
    const svgHeight = chartData.length * (barHeight + barGap);

    return (
      <div className="chart-container">
        <svg width="100%" height={svgHeight} style={{ minHeight: '300px' }}>
          {chartData.map((d, i) => {
            const widthPct = (d[selectedBracket] / maxPrice) * 100;
            const y = i * (barHeight + barGap);
            let fill = '#3b82f6'; // mid
            if (i === 0) fill = '#10b981'; // cheapest
            if (i === chartData.length - 1 && chartData.length > 1) fill = '#ef4444'; // expensive
            
            return (
              <g key={i}>
                <text x="0" y={y + 20} fill="#9ca3af" fontSize="12" fontFamily="Inter">
                  {d.airline} {d.product ? `(${d.product})` : ''}
                </text>
                <rect 
                  x="180" 
                  y={y} 
                  width={`calc(${widthPct}% - 240px)`} 
                  height={barHeight} 
                  fill={fill} 
                  rx="4"
                  className="chart-bar"
                  style={{ width: `${Math.max(10, widthPct * 0.7)}%` }}
                />
                <text x={`calc(190px + ${Math.max(10, widthPct * 0.7)}%)`} y={y + 20} fill="#f9fafb" fontSize="12" fontFamily="Inter" fontWeight="bold">
                  {d[selectedBracket].toFixed(2)} {d.currency}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div className="view-container">
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
          <label className="filter-label">Upload Date</label>
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
            {analytics?.price_range_min ? `${analytics.price_range_min} - ${analytics.price_range_max}` : '-'}
          </div>
          <div className="summary-subtext">Min to Max spread</div>
        </div>
      </div>

      <div className="glass-card">
        <h3 style={{marginBottom: '16px', color: '#f9fafb', fontSize: '1.1rem'}}>Weight Bracket Analysis</h3>
        <div className="pills-container" style={{marginBottom: '24px'}}>
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
        
        {loading ? <div style={{color: '#9ca3af'}}>Loading chart...</div> : renderChart()}
      </div>

      <div className="glass-card">
        <h3 style={{marginBottom: '16px', color: '#f9fafb', fontSize: '1.1rem'}}>Rate Comparison</h3>
        {loading ? <div style={{color: '#9ca3af'}}>Loading table...</div> : renderComparisonTable()}
      </div>
    </div>
  );
}
