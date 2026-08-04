import React, { useState, useEffect } from 'react';

const API_BASE = 'https://athletic-essence-production-5a0c.up.railway.app';

interface UploadHistoryProps {
  onNavigateToDashboard: (uploadId: number) => void;
}

export default function UploadHistory({ onNavigateToDashboard }: UploadHistoryProps) {
  const [uploads, setUploads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUploads = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/uploads/`);
      const data = await res.json();
      setUploads(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUploads();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this upload?')) return;
    
    try {
      await fetch(`${API_BASE}/api/uploads/${id}`, { method: 'DELETE' });
      fetchUploads();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="view-container">
      <div className="glass-card">
        <h2 style={{marginBottom: '24px', fontSize: '1.25rem', color: '#f9fafb'}}>Upload History</h2>
        
        {loading ? (
          <div style={{color: '#9ca3af'}}>Loading history...</div>
        ) : uploads.length === 0 ? (
          <div style={{color: '#9ca3af'}}>No uploads found.</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Filename</th>
                  <th>Date</th>
                  <th>Records</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map(u => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.filename}</td>
                    <td>{new Date(u.upload_date).toLocaleString()}</td>
                    <td>{u.record_count}</td>
                    <td>
                      <div style={{display: 'flex', gap: '8px'}}>
                        <button className="btn" onClick={() => onNavigateToDashboard(u.id)}>
                          View in Dashboard
                        </button>
                        <button className="btn btn-danger" onClick={() => handleDelete(u.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
