import React, { useState, useEffect } from 'react';
import { Plus, FileCode, CheckCircle, AlertTriangle, Calendar, List, Check, X, ClipboardList, Info } from 'lucide-react';
import { apiFetch } from '../config/api';

interface AdminConfigProps {
  onConfigChanged: () => void;
}

interface Appointment {
  id: string;
  name: string;
  phone: string;
  concern: string;
  preferredDate: string;
  preferredTime: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
}

export default function AdminConfig({ onConfigChanged }: AdminConfigProps) {
  const [jsonConfig, setJsonConfig] = useState<any>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'appointments' | 'treatments' | 'faqs' | 'schema'>('appointments');
  const [loadingApts, setLoadingApts] = useState<boolean>(false);
  const [aptsError, setAptsError] = useState<string | null>(null);

  // Treatment Form state
  const [treatmentForm, setTreatmentForm] = useState({
    name: '',
    departmentId: 'skin',
    description: '',
    duration: '45 mins',
    recoveryTime: 'Immediate',
    cost: '',
    safetyInfo: 'Safe for all skin types. Wear sunscreen post treatment.',
    keywords: ''
  });

  // FAQ Form state
  const [faqForm, setFaqForm] = useState({
    category: 'General',
    question: '',
    answer: ''
  });

  const [tStatus, setTStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [fStatus, setFStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  // Fetch config layout to preview JSON contents
  const fetchCurrentConfig = async () => {
    try {
      const res = await apiFetch('/api/services');
      if (res.ok) {
        const data = await res.json();
        setJsonConfig(data);
      }
    } catch (e) {
      console.error('Failed to reload json database preview:', e);
    }
  };

  // Fetch appointments list
  const fetchAppointments = async () => {
    setLoadingApts(true);
    setAptsError(null);
    try {
      const res = await apiFetch('/api/appointments');
      if (!res.ok) throw new Error('Failed to load appointments.');
      const data = await res.json();
      // Sort by createdAt descending
      data.sort((a: Appointment, b: Appointment) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAppointments(data);
    } catch (e: any) {
      console.error(e);
      setAptsError('Could not connect to appointments API.');
    } finally {
      setLoadingApts(false);
    }
  };

  useEffect(() => {
    fetchCurrentConfig();
    fetchAppointments();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: 'confirmed' | 'cancelled') => {
    try {
      const res = await apiFetch(`/api/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        // Refresh local list
        setAppointments(prev => 
          prev.map(apt => apt.id === id ? { ...apt, status: newStatus } : apt)
        );
      } else {
        alert('Failed to update status.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating status.');
    }
  };

  const handleAddTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    setTStatus(null);

    const costNum = Number(treatmentForm.cost);
    if (!treatmentForm.name || isNaN(costNum) || costNum <= 0 || !treatmentForm.description) {
      setTStatus({ type: 'error', msg: 'Please provide valid values for Name, Cost, and Description.' });
      return;
    }

    try {
      const kwArray = treatmentForm.keywords
        ? treatmentForm.keywords.split(',').map(k => k.trim())
        : [treatmentForm.name.toLowerCase()];

      const res = await apiFetch('/api/admin/treatments', {
        method: 'POST',
        body: JSON.stringify({
          ...treatmentForm,
          cost: costNum,
          keywords: kwArray
        })
      });

      const data = await res.json();
      if (res.ok) {
        setTStatus({ type: 'success', msg: `Added treatment: "${data.treatment.name}" successfully!` });
        setTreatmentForm({
          name: '',
          departmentId: 'skin',
          description: '',
          duration: '45 mins',
          recoveryTime: 'Immediate',
          cost: '',
          safetyInfo: 'Safe for all skin types. Wear sunscreen post treatment.',
          keywords: ''
        });
        fetchCurrentConfig();
        onConfigChanged();
      } else {
        setTStatus({ type: 'error', msg: data.error || 'Failed to save treatment.' });
      }
    } catch (err) {
      setTStatus({ type: 'error', msg: 'Network error communicating with admin API.' });
    }
  };

  const handleAddFAQ = async (e: React.FormEvent) => {
    e.preventDefault();
    setFStatus(null);

    if (!faqForm.question || !faqForm.answer) {
      setFStatus({ type: 'error', msg: 'Question and Answer are required.' });
      return;
    }

    try {
      const res = await apiFetch('/api/admin/faqs', {
        method: 'POST',
        body: JSON.stringify(faqForm)
      });

      const data = await res.json();
      if (res.ok) {
        setFStatus({ type: 'success', msg: 'FAQ entry successfully added!' });
        setFaqForm({
          category: 'General',
          question: '',
          answer: ''
        });
        fetchCurrentConfig();
        onConfigChanged();
      } else {
        setFStatus({ type: 'error', msg: data.error || 'Failed to save FAQ.' });
      }
    } catch (err) {
      setFStatus({ type: 'error', msg: 'Network error communicating with admin FAQ API.' });
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'confirmed':
        return { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' };
      case 'cancelled':
        return { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' };
      default:
        return { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Admin Dashboard Sub-navigation Tabs */}
      <div className="tab-list" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', marginBottom: '0.5rem' }}>
        <button 
          className={`tab-btn ${activeSubTab === 'appointments' ? 'active' : ''}`}
          onClick={() => { setActiveSubTab('appointments'); fetchAppointments(); }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          id="admin-tab-appointments"
        >
          <ClipboardList size={16} /> Appointments Queue
        </button>
        <button 
          className={`tab-btn ${activeSubTab === 'treatments' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('treatments')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          id="admin-tab-treatments"
        >
          <Plus size={16} /> Add Treatment
        </button>
        <button 
          className={`tab-btn ${activeSubTab === 'faqs' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('faqs')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          id="admin-tab-faqs"
        >
          <List size={16} /> Add FAQ
        </button>
        <button 
          className={`tab-btn ${activeSubTab === 'schema' ? 'active' : ''}`}
          onClick={() => { setActiveSubTab('schema'); fetchCurrentConfig(); }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          id="admin-tab-schema"
        >
          <FileCode size={16} /> Config Schema Explorer
        </button>
      </div>

      {/* Active Tab Panels */}
      
      {/* 1. APPOINTMENTS MANAGER */}
      {activeSubTab === 'appointments' && (
        <section className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Incoming Appointments Queue</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                Track and manage active patient booking requests submitted via the chat widget or direct forms.
              </p>
            </div>
            <button className="btn btn-secondary" onClick={fetchAppointments} style={{ padding: '0.5rem 0.8rem', fontSize: '0.8rem' }}>
              Refresh list
            </button>
          </div>

          {loadingApts ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
              Loading queue details...
            </div>
          ) : aptsError ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#ef4444' }}>
              {aptsError}
            </div>
          ) : appointments.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--color-text-secondary)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Patient</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Contact</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Requested Concern</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Date & Time</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((apt) => (
                    <tr key={apt.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }} className="hover-row">
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{apt.name}</td>
                      <td style={{ padding: '1rem', color: 'var(--color-text-secondary)' }}>{apt.phone}</td>
                      <td style={{ padding: '1rem', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={apt.concern}>
                        {apt.concern}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ display: 'block', fontWeight: 500 }}>{apt.preferredDate}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{apt.preferredTime}</span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span 
                          style={{ 
                            fontSize: '0.75rem', 
                            padding: '0.25rem 0.5rem', 
                            borderRadius: '100px', 
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            ...getStatusBadgeStyle(apt.status)
                          }}
                        >
                          {apt.status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          {apt.status === 'pending' && (
                            <>
                              <button 
                                className="btn btn-primary" 
                                onClick={() => handleUpdateStatus(apt.id, 'confirmed')}
                                style={{ padding: '0.35rem', borderRadius: '6px' }}
                                title="Confirm Appointment"
                                id={`confirm-apt-${apt.id}`}
                              >
                                <Check size={14} />
                              </button>
                              <button 
                                className="btn" 
                                onClick={() => handleUpdateStatus(apt.id, 'cancelled')}
                                style={{ padding: '0.35rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                                title="Cancel Appointment"
                                id={`cancel-apt-${apt.id}`}
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                          {apt.status !== 'pending' && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                              Handled
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--color-text-secondary)' }}>
              <Calendar size={48} style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }} />
              <p>No appointments scheduled yet.</p>
            </div>
          )}
        </section>
      )}

      {/* 2. ADD TREATMENT */}
      {activeSubTab === 'treatments' && (
        <section className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} style={{ color: 'var(--color-primary)' }} />
            Add Clinic Treatment
          </h2>
          
          {tStatus && (
            <div style={{ 
              background: tStatus.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', 
              color: tStatus.type === 'success' ? 'var(--color-primary)' : '#ef4444', 
              padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
              {tStatus.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              {tStatus.msg}
            </div>
          )}

          <form onSubmit={handleAddTreatment} id="add-treatment-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="admin-t-name">Treatment Name</label>
                <input 
                  type="text" 
                  id="admin-t-name"
                  className="form-input" 
                  placeholder="e.g. Skin Whitening Facial"
                  value={treatmentForm.name}
                  onChange={(e) => setTreatmentForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="admin-t-dept">Department</label>
                <select
                  id="admin-t-dept"
                  className="form-input"
                  value={treatmentForm.departmentId}
                  onChange={(e) => setTreatmentForm(p => ({ ...p, departmentId: e.target.value }))}
                >
                  <option value="dental">Dental</option>
                  <option value="skin">Skin</option>
                  <option value="hair">Hair</option>
                  <option value="laser">Laser</option>
                  <option value="cosmetic">Cosmetic Procedures</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="admin-t-duration">Duration</label>
                <input 
                  type="text" 
                  id="admin-t-duration"
                  className="form-input" 
                  placeholder="e.g. 45 minutes"
                  value={treatmentForm.duration}
                  onChange={(e) => setTreatmentForm(p => ({ ...p, duration: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="admin-t-downtime">Downtime / Recovery</label>
                <input 
                  type="text" 
                  id="admin-t-downtime"
                  className="form-input" 
                  placeholder="e.g. 1-2 days"
                  value={treatmentForm.recoveryTime}
                  onChange={(e) => setTreatmentForm(p => ({ ...p, recoveryTime: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="admin-t-cost">Cost ($ USD)</label>
                <input 
                  type="number" 
                  id="admin-t-cost"
                  className="form-input" 
                  placeholder="e.g. 250"
                  value={treatmentForm.cost}
                  onChange={(e) => setTreatmentForm(p => ({ ...p, cost: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="admin-t-keywords">Keywords (Comma separated)</label>
                <input 
                  type="text" 
                  id="admin-t-keywords"
                  className="form-input" 
                  placeholder="e.g. glow, whitening, dullness, spot"
                  value={treatmentForm.keywords}
                  onChange={(e) => setTreatmentForm(p => ({ ...p, keywords: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-t-desc">Description</label>
              <textarea 
                id="admin-t-desc"
                className="form-input" 
                style={{ minHeight: '80px' }}
                placeholder="Briefly describe what this treatment does..."
                value={treatmentForm.description}
                onChange={(e) => setTreatmentForm(p => ({ ...p, description: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-t-safety">Safety Warnings</label>
              <input 
                type="text" 
                id="admin-t-safety"
                className="form-input" 
                value={treatmentForm.safetyInfo}
                onChange={(e) => setTreatmentForm(p => ({ ...p, safetyInfo: e.target.value }))}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              Add Treatment to services.json
            </button>
          </form>
        </section>
      )}

      {/* 3. ADD FAQ */}
      {activeSubTab === 'faqs' && (
        <section className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} style={{ color: 'var(--color-primary)' }} />
            Add Clinic FAQ
          </h2>

          {fStatus && (
            <div style={{ 
              background: fStatus.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', 
              color: fStatus.type === 'success' ? 'var(--color-primary)' : '#ef4444', 
              padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
              {fStatus.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              {fStatus.msg}
            </div>
          )}

          <form onSubmit={handleAddFAQ} id="add-faq-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="admin-f-cat">Category</label>
                <select
                  id="admin-f-cat"
                  className="form-input"
                  value={faqForm.category}
                  onChange={(e) => setFaqForm(p => ({ ...p, category: e.target.value }))}
                >
                  <option value="General">General</option>
                  <option value="Bookings">Bookings</option>
                  <option value="Dental">Dental</option>
                  <option value="Skin">Skin</option>
                  <option value="Hair">Hair</option>
                  <option value="Laser">Laser</option>
                  <option value="Cosmetic">Cosmetic</option>
                  <option value="Payments">Payments</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-f-q">Question</label>
              <input 
                type="text" 
                id="admin-f-q"
                className="form-input" 
                placeholder="e.g. Do you have emergency dental slots?"
                value={faqForm.question}
                onChange={(e) => setFaqForm(p => ({ ...p, question: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-f-a">Answer</label>
              <textarea 
                id="admin-f-a"
                className="form-input" 
                style={{ minHeight: '80px' }}
                placeholder="Detailed answer response..."
                value={faqForm.answer}
                onChange={(e) => setFaqForm(p => ({ ...p, answer: e.target.value }))}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              Add FAQ to services.json
            </button>
          </form>
        </section>
      )}

      {/* 4. SCHEMA EXPLORER */}
      {activeSubTab === 'schema' && (
        <section className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <FileCode size={20} style={{ color: 'var(--color-primary)' }} />
            <h2 style={{ fontSize: '1.25rem' }}>Active services.json Database File</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(99, 102, 241, 0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.82rem', alignItems: 'flex-start' }}>
            <Info size={16} style={{ color: 'var(--color-secondary)', marginTop: '0.1rem', flexShrink: 0 }} />
            <span style={{ color: 'var(--color-text-secondary)' }}>
              This schema lists all clinical departments, specialists, treatment profiles, keywords, and FAQ libraries. 
              Submitting new treatments or FAQs in the editors above writes directly to this JSON file. The changes are loaded 
              dynamically by the server and immediately update the patient catalog and chatbot.
            </span>
          </div>

          {jsonConfig ? (
            <pre className="admin-json-preview" id="admin-json-view" style={{ maxHeight: '450px', fontSize: '0.82rem' }}>
              {JSON.stringify(jsonConfig, null, 2)}
            </pre>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
              Loading database schema preview...
            </div>
          )}
        </section>
      )}

    </div>
  );
}
