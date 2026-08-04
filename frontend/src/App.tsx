import { useState } from 'react';
import FileUpload from './components/FileUpload';
import RatesTable from './components/RatesTable';
import './index.css';

function App() {
  const [ratesUpdated, setRatesUpdated] = useState(0);

  const handleUploadSuccess = () => {
    setRatesUpdated(prev => prev + 1);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-icon">✈️</div>
            <h1>Air Freight Analytics</h1>
          </div>
          <p className="subtitle">Upload and analyze air freight rates seamlessly</p>
        </div>
      </header>

      <main className="app-main">
        <section className="upload-section">
          <FileUpload onUploadSuccess={handleUploadSuccess} />
        </section>

        <section className="data-section">
          <RatesTable key={ratesUpdated} />
        </section>
      </main>
    </div>
  );
}

export default App;
