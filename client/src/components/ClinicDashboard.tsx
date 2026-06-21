import { useState, useEffect } from 'react';
import { Search, Clock, ShieldCheck, HelpCircle, Calendar, ChevronDown, ChevronUp, Stethoscope, User } from 'lucide-react';
import { apiFetch } from '../config/api';

interface ClinicInfo {
  name: string;
  phone: string;
  email: string;
  address: string;
  hours: string;
}

interface Department {
  id: string;
  name: string;
  description: string;
  specialist: string;
}

interface Treatment {
  id: string;
  departmentId: string;
  name: string;
  description: string;
  duration: string;
  recoveryTime: string;
  cost: number;
  safetyInfo: string;
}

interface FAQ {
  category: string;
  question: string;
  answer: string;
}

interface ClinicDashboardProps {
  onSelectTreatment: (treatment: Treatment) => void;
  refreshTrigger: number; // Used to reload when treatments are added
}

export default function ClinicDashboard({ onSelectTreatment, refreshTrigger }: ClinicDashboardProps) {
  const [clinicInfo, setClinicInfo] = useState<ClinicInfo | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Load services
        const resServices = await apiFetch('/api/services');
        if (!resServices.ok) throw new Error('Failed to load clinic services.');
        const dataServices = await resServices.json();
        
        setClinicInfo(dataServices.clinic);
        setDepartments(dataServices.departments);
        setTreatments(dataServices.treatments);

        // Load FAQs
        const resFaqs = await apiFetch('/api/faqs');
        if (resFaqs.ok) {
          const dataFaqs = await resFaqs.json();
          setFaqs(dataFaqs);
        }
        setError(null);
      } catch (err: any) {
        console.error(err);
        setError('Connection to backend clinic server failed. Please ensure the server is running on port 5000.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [refreshTrigger]);

  const toggleFaq = (index: number) => {
    setExpandedFaqIndex(expandedFaqIndex === index ? null : index);
  };

  const getDeptBadgeClass = (deptId: string) => {
    switch (deptId.toLowerCase()) {
      case 'dental': return 'dept-badge dept-badge-dental';
      case 'skin': return 'dept-badge dept-badge-skin';
      case 'hair': return 'dept-badge dept-badge-hair';
      case 'laser': return 'dept-badge dept-badge-laser';
      default: return 'dept-badge dept-badge-cosmetic';
    }
  };

  // Filter treatments by department tab and search query
  const filteredTreatments = treatments.filter((treatment) => {
    const matchesTab = activeTab === 'all' || treatment.departmentId.toLowerCase() === activeTab.toLowerCase();
    const matchesSearch = treatment.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          treatment.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', flexDirection: 'column', gap: '1rem' }}>
        <div className="typing-indicator">
          <span className="typing-dot"></span>
          <span className="typing-dot"></span>
          <span className="typing-dot"></span>
        </div>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Loading clinic catalog...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
        <p style={{ color: '#ef4444', marginBottom: '1rem', fontWeight: 600 }}>{error}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry Connection</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Clinic Header Summary */}
      {clinicInfo && (
        <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{clinicInfo.name}</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem' }}>{clinicInfo.address}</p>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem' }}>
            <div>
              <strong style={{ display: 'block', color: 'var(--color-text-secondary)' }}>Hours:</strong>
              <span>{clinicInfo.hours}</span>
            </div>
            <div>
              <strong style={{ display: 'block', color: 'var(--color-text-secondary)' }}>Phone:</strong>
              <a href={`tel:${clinicInfo.phone}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>{clinicInfo.phone}</a>
            </div>
          </div>
        </section>
      )}

      {/* Specialist Cards */}
      {departments.length > 0 && (
        <section className="specialist-cards">
          {departments.map(dept => {
            const badgeClass = getDeptBadgeClass(dept.id);
            return (
              <div key={dept.id} className="glass-panel specialist-card">
                <div className="specialist-card-icon">
                  <User size={20} />
                </div>
                <span className={badgeClass} style={{ alignSelf: 'flex-start' }}>
                  {dept.name.replace(' Department', '')}
                </span>
                <strong style={{ fontSize: '0.95rem' }}>{dept.specialist}</strong>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                  {dept.description}
                </p>
              </div>
            );
          })}
        </section>
      )}

      {/* Directory & Catalog Search */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Stethoscope size={20} className="text-emerald" style={{ color: 'var(--color-primary)' }} />
            Explore Services & Treatments
          </h2>
          <div className="search-container" style={{ marginBottom: 0, width: '100%', maxWidth: '300px' }}>
            <div className="search-input-wrapper">
              <Search size={16} />
              <input 
                type="text" 
                placeholder="Search treatments..." 
                className="input-field" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search treatments"
                id="treatment-search"
              />
            </div>
          </div>
        </div>

        {/* Department Selection Tabs */}
        <div className="tab-list">
          <button 
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
            id="tab-all"
          >
            All Services
          </button>
          {departments.map(dept => (
            <button
              key={dept.id}
              className={`tab-btn ${activeTab === dept.id ? 'active' : ''}`}
              onClick={() => setActiveTab(dept.id)}
              id={`tab-${dept.id}`}
            >
              {dept.name.replace(' Department', '')}
            </button>
          ))}
        </div>

        {/* Selected Department Info */}
        {activeTab !== 'all' && (
          <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)' }}>
            {departments.filter(d => d.id === activeTab).map(d => (
              <div key={d.id}>
                <p style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>{d.description}</p>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  Lead Specialist: <strong>{d.specialist}</strong>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Treatments List */}
        {filteredTreatments.length > 0 ? (
          <div className="treatment-cards-grid">
            {filteredTreatments.map((treatment) => (
              <div key={treatment.id} className="glass-panel glass-panel-hover treatment-card" id={`treatment-${treatment.id}`}>
                <div>
                  <div className="treatment-header">
                    <span className={getDeptBadgeClass(treatment.departmentId)}>
                      {treatment.departmentId}
                    </span>
                    <span className="treatment-cost">${treatment.cost}</span>
                  </div>
                  <h3 className="treatment-title">{treatment.name}</h3>
                  <p className="treatment-desc">{treatment.description}</p>
                </div>
                
                <div>
                  <div className="treatment-details">
                    <div>
                      <strong>Duration:</strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.2rem' }}>
                        <Clock size={12} /> {treatment.duration}
                      </div>
                    </div>
                    <div>
                      <strong>Downtime:</strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.2rem' }}>
                        <ShieldCheck size={12} /> {treatment.recoveryTime}
                      </div>
                    </div>
                  </div>
                  <button 
                    className="btn btn-primary" 
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => onSelectTreatment(treatment)}
                    id={`book-btn-${treatment.id}`}
                  >
                    <Calendar size={16} /> Book Service
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            No treatments found matching "{searchQuery}" in this category.
          </div>
        )}
      </section>

      {/* FAQs Section */}
      <section className="glass-panel" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <HelpCircle size={20} style={{ color: 'var(--color-primary)' }} />
          Frequently Asked Questions
        </h2>
        <div className="faq-list">
          {faqs.map((faq, index) => (
            <div key={index} className="faq-item" id={`faq-${index}`}>
              <button 
                className="faq-question-btn" 
                onClick={() => toggleFaq(index)}
                aria-expanded={expandedFaqIndex === index}
              >
                <span>[{faq.category}] {faq.question}</span>
                {expandedFaqIndex === index ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {expandedFaqIndex === index && (
                <div className="faq-answer">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
