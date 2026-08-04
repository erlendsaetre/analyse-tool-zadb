import { useState, useEffect } from 'react';

interface Rate {
  id: number;
  airline: string;
  product: string;
  origin: string;
  destination: string;
  via: string | null;
  relation_kg_m3: number | null;
  fuel: string | null;
  security_surcharge: string | null;
  fixed: string | null;
  min_rate: number | null;
  normal_rate: number | null;
  q45: number | null;
  q100: number | null;
  q300: number | null;
  q500: number | null;
  q1000: number | null;
  q3000: number | null;
  currency: string;
}

const RatesTable: React.FC = () => {
  const [rates, setRates] = useState<Rate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRates = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/rates/');
      if (!response.ok) {
        throw new Error('Failed to fetch rates');
      }
      const data = await response.json();
      setRates(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const handleClearData = async () => {
    if (!window.confirm('Are you sure you want to clear all data?')) return;
    
    try {
      await fetch('http://localhost:8000/api/rates/', { method: 'DELETE' });
      fetchRates();
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return <div className="table-container"><div className="loading">Loading rates...</div></div>;
  }

  if (error) {
    return <div className="table-container"><div className="loading" style={{ color: 'var(--error)' }}>Error: {error}</div></div>;
  }

  return (
    <div className="table-container">
      <div className="table-header">
        <h2 className="table-title">Parsed Rates ({rates.length})</h2>
        <div className="table-actions">
          <button onClick={handleClearData}>Clear Data</button>
        </div>
      </div>
      
      {rates.length === 0 ? (
        <div className="no-data">No rates available. Please upload a file.</div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Airline</th>
                <th>Product</th>
                <th>Orig</th>
                <th>Dest</th>
                <th>Via</th>
                <th>Min</th>
                <th>Normal</th>
                <th>+45kg</th>
                <th>+100kg</th>
                <th>+300kg</th>
                <th>+500kg</th>
                <th>+1000kg</th>
                <th>Cur</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((rate) => (
                <tr key={rate.id}>
                  <td>{rate.airline}</td>
                  <td>{rate.product}</td>
                  <td>{rate.origin}</td>
                  <td>{rate.destination}</td>
                  <td>{rate.via || '-'}</td>
                  <td>{rate.min_rate !== null ? rate.min_rate : '-'}</td>
                  <td>{rate.normal_rate !== null ? rate.normal_rate : '-'}</td>
                  <td>{rate.q45 !== null ? rate.q45 : '-'}</td>
                  <td>{rate.q100 !== null ? rate.q100 : '-'}</td>
                  <td>{rate.q300 !== null ? rate.q300 : '-'}</td>
                  <td>{rate.q500 !== null ? rate.q500 : '-'}</td>
                  <td>{rate.q1000 !== null ? rate.q1000 : '-'}</td>
                  <td>{rate.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RatesTable;
