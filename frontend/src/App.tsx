import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import FileUpload from './components/FileUpload';
import UploadHistory from './components/UploadHistory';
import TenderList from './components/TenderList';
import TenderWorkspace from './components/TenderWorkspace';

type View = 'dashboard' | 'upload' | 'history' | 'tenders' | 'tender-workspace';

function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [selectedUploadId, setSelectedUploadId] = useState<number | null>(null);
  const [selectedTenderId, setSelectedTenderId] = useState<number | null>(null);

  const handleNavigateToDashboard = (uploadId?: number) => {
    if (uploadId !== undefined) {
      setSelectedUploadId(uploadId);
    }
    setActiveView('dashboard');
  };

  const handleOpenTender = (tenderId: number) => {
    setSelectedTenderId(tenderId);
    setActiveView('tender-workspace');
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          Air Freight Analytics
        </div>
        <ul className="nav-list">
          <li 
            className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveView('dashboard')}
          >
            <span>📊</span> Dashboard
          </li>
          <li 
            className={`nav-item ${activeView === 'tenders' || activeView === 'tender-workspace' ? 'active' : ''}`}
            onClick={() => setActiveView('tenders')}
          >
            <span>🧮</span> Tenders
          </li>
          <li 
            className={`nav-item ${activeView === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveView('upload')}
          >
            <span>📤</span> Upload
          </li>
          <li 
            className={`nav-item ${activeView === 'history' ? 'active' : ''}`}
            onClick={() => setActiveView('history')}
          >
            <span>📋</span> History
          </li>
        </ul>
      </aside>

      <main className="main-content">
        {activeView === 'dashboard' && <Dashboard defaultUploadId={selectedUploadId} />}
        {activeView === 'tenders' && <TenderList onOpenTender={handleOpenTender} />}
        {activeView === 'tender-workspace' && selectedTenderId && (
          <TenderWorkspace tenderId={selectedTenderId} onBack={() => setActiveView('tenders')} />
        )}
        {activeView === 'upload' && <FileUpload onUploadSuccess={() => handleNavigateToDashboard()} />}
        {activeView === 'history' && <UploadHistory onNavigateToDashboard={handleNavigateToDashboard} />}
      </main>
    </div>
  );
}

export default App;
