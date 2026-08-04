import React, { useState, useRef } from 'react';

const API_BASE = 'https://athletic-essence-production-5a0c.up.railway.app';

interface FileUploadProps {
  onUploadSuccess: () => void;
}

export default function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setLoading(true);
    setMessage('');
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch(`${API_BASE}/api/upload/`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (res.ok) {
        setMessage(`Successfully uploaded ${data.count} records from ${data.filename}.`);
        setTimeout(() => {
          onUploadSuccess();
        }, 2000);
      } else {
        setMessage(`Error: ${data.detail || 'Upload failed'}`);
      }
    } catch (err) {
      setMessage('Network error during upload.');
    } finally {
      setLoading(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const onDragLeave = () => {
    setIsDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="view-container" style={{maxWidth: '600px', margin: '0 auto', paddingTop: '40px'}}>
      <div className="glass-card">
        <h2 style={{marginBottom: '24px', fontSize: '1.25rem', color: '#f9fafb'}}>Upload Rates Data</h2>
        
        <div 
          className={`upload-dropzone ${isDragActive ? 'drag-active' : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange}
            accept=".csv,.xlsx,.xls"
          />
          <div className="upload-icon">📄</div>
          {file ? (
            <div className="upload-text">Selected: {file.name}</div>
          ) : (
            <>
              <div className="upload-text">Click to select or drag and drop</div>
              <div className="upload-hint">CSV, XLSX up to 50MB</div>
            </>
          )}
        </div>

        <div style={{marginTop: '24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px'}}>
          {message && <span style={{color: message.startsWith('Error') ? '#ef4444' : '#10b981', fontSize: '0.875rem'}}>{message}</span>}
          <button 
            className="btn btn-primary" 
            disabled={!file || loading}
            onClick={handleUpload}
          >
            {loading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>
      </div>
    </div>
  );
}
