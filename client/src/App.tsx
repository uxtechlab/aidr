import { useState, useEffect } from 'react';
import { Sparkles, Calendar, Settings, Sun, Moon, X } from 'lucide-react';
import ClinicDashboard from './components/ClinicDashboard';
import ChatWidget from './components/ChatWidget';
import AppointmentForm from './components/AppointmentForm';
import AdminConfig from './components/AdminConfig';

interface Treatment {
  id: string;
  departmentId: string;
  name: string;
  cost: number;
}

export default function App() {
  const [activeView, setActiveView] = useState<'patient' | 'admin'>('patient');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [selectedTreatment, setSelectedTreatment] = useState<Treatment | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [showEmergencyBanner, setShowEmergencyBanner] = useState(true);

  // Restore saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('auracare-theme');
    if (saved === 'light') {
      setThemeMode('light');
      document.body.classList.add('light-theme');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(newTheme);
    localStorage.setItem('auracare-theme', newTheme);
    const body = document.body;
    if (newTheme === 'light') {
      body.classList.add('light-theme');
    } else {
      body.classList.remove('light-theme');
    }
  };

  const handleBookFromCatalog = (treatment: Treatment) => {
    setSelectedTreatment(treatment);
    setBookingModalOpen(true);
  };

  const handleBookingCompleted = () => {
    // Refresh the dashboard data
    setDashboardRefreshKey(prev => prev + 1);
  };

  const handleConfigChanged = () => {
    // Force catalog refresh when new treatments or FAQs are added in Admin
    setDashboardRefreshKey(prev => prev + 1);
  };

  return (
    <div className="app-container">
      
      {/* Background Ambient Orbs */}
      <div className="ambient-orb orb-emerald"></div>
      <div className="ambient-orb orb-indigo"></div>

      {/* Emergency Contact Banner */}
      {showEmergencyBanner && (
        <div className="emergency-banner">
          <span>
            🚨 Dental/Medical Emergency? Call our 24/7 hotline:{' '}
            <a href="tel:+15558722273" style={{ color: '#fff', fontWeight: 700, textDecoration: 'underline' }}>
              +1 (555) 872-2273
            </a>
          </span>
          <button
            className="emergency-banner-close"
            onClick={() => setShowEmergencyBanner(false)}
            aria-label="Dismiss emergency banner"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header / Navbar */}
      <header className="glass-panel navbar" style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <a href="/" className="brand" onClick={(e) => { e.preventDefault(); setActiveView('patient'); }}>
          <div className="brand-icon">
            <Sparkles size={20} />
          </div>
          <div className="brand-text">
            <h1>AuraCare Clinic</h1>
            <p>Dental, Skin, Hair & Laser Aesthetics</p>
          </div>
        </a>

        <div className="nav-controls">
          <button 
            className={`btn ${activeView === 'patient' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveView('patient')}
            id="nav-patient-view"
          >
            <Calendar size={16} /> Patient Portal
          </button>
          
          <button 
            className={`btn ${activeView === 'admin' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveView('admin')}
            id="nav-admin-view"
          >
            <Settings size={16} /> Admin Console
          </button>

          <button 
            className="btn btn-secondary" 
            onClick={toggleTheme} 
            style={{ padding: '0.6rem', borderRadius: '10px' }}
            title="Toggle Light/Dark Theme"
            aria-label="Toggle theme color"
            id="theme-toggle"
          >
            {themeMode === 'dark' ? <Sun size={16} style={{ color: '#fbbf24' }} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {activeView === 'patient' ? (
        <main className="dashboard-grid">
          
          {/* Left: Dynamic Catalog & FAQs */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <ClinicDashboard 
              onSelectTreatment={handleBookFromCatalog} 
              refreshTrigger={dashboardRefreshKey}
            />
          </div>

          {/* Right: AI Assistant Panel */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <ChatWidget 
              onBookTreatment={handleBookFromCatalog}
              onBookingCompleted={handleBookingCompleted}
            />
          </div>

        </main>
      ) : (
        <main className="admin-view" style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Settings size={22} className="text-secondary" style={{ color: 'var(--color-secondary)' }} />
            <h2 style={{ fontSize: '1.4rem' }}>Clinic Administration</h2>
          </div>
          <AdminConfig onConfigChanged={handleConfigChanged} />
        </main>
      )}

      {/* Appointment Booking Modal Form */}
      <AppointmentForm 
        isOpen={bookingModalOpen}
        onClose={() => {
          setBookingModalOpen(false);
          setSelectedTreatment(null);
        }}
        selectedTreatment={selectedTreatment}
        onSuccess={handleBookingCompleted}
      />

      {/* Simple Footer */}
      <footer style={{ marginTop: '3rem', padding: '1rem 0', borderTop: '1px solid var(--glass-border)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
        © {new Date().getFullYear()} AuraCare Aesthetics & Wellness. All rights reserved. Hackathon Project.
      </footer>

    </div>
  );
}
