import { useState, useRef } from 'react';

interface FileUploadProps {
  onUploadSuccess: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setStatus(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setStatus(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // In production, this would be an environment variable
      const response = await fetch('http://localhost:8000/api/upload/', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to upload file');
      }

      const data = await response.json();
      setStatus({ type: 'success', message: data.message });
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onUploadSuccess();
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'An error occurred during upload' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="upload-card">
      <div className="upload-icon">📊</div>
      <h2>Upload Air Freight Rates</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Upload your ML-Rates Excel file to parse and analyze.</p>
      
      <div>
        <label htmlFor="file-upload" className="upload-label">
          Choose Excel File
        </label>
        <input
          id="file-upload"
          type="file"
          accept=".xls,.xlsx"
          className="upload-input"
          onChange={handleFileChange}
          ref={fileInputRef}
        />
      </div>

      {file && (
        <div className="file-info">
          Selected: <strong>{file.name}</strong>
        </div>
      )}

      {file && (
        <button 
          className="upload-btn" 
          onClick={handleUpload} 
          disabled={isUploading}
        >
          {isUploading ? 'Processing...' : 'Upload & Process'}
        </button>
      )}

      {status && (
        <div className={`status-message status-${status.type}`}>
          {status.message}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
