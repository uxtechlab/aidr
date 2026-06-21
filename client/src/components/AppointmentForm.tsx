import React, { useState, useEffect } from 'react';
import { X, User, Phone, FileText, Clock, Sparkles, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../config/api';

interface Treatment {
  id: string;
  departmentId: string;
  name: string;
  cost: number;
}

interface AppointmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTreatment: Treatment | null;
  onSuccess: () => void;
}

export default function AppointmentForm({ isOpen, onClose, selectedTreatment, onSuccess }: AppointmentFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    concern: '',
    preferredDate: '',
    preferredTime: '',
    departmentId: '',
    treatmentId: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [treatments, setTreatments] = useState<Treatment[]>([]);

  // Load treatment list for selects
  useEffect(() => {
    async function loadTreatments() {
      try {
        const res = await apiFetch('/api/services');
        if (res.ok) {
          const data = await res.json();
          setTreatments(data.treatments);
        }
      } catch (err) {
        console.error('Failed to load treatments for booking form:', err);
      }
    }
    loadTreatments();
  }, []);

  // Prepopulate if clicked from catalog
  useEffect(() => {
    if (selectedTreatment) {
      setFormData(prev => ({
        ...prev,
        departmentId: selectedTreatment.departmentId,
        treatmentId: selectedTreatment.id,
        concern: `Interested in ${selectedTreatment.name}`
      }));
    } else {
      setFormData({
        name: '',
        phone: '',
        concern: '',
        preferredDate: '',
        preferredTime: '',
        departmentId: '',
        treatmentId: ''
      });
    }
    setErrors({});
    setSubmitSuccess(false);
  }, [selectedTreatment, isOpen]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim() || formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters.';
    }
    
    // Simple phone validator
    const phoneRegex = /^[\d+\-()\s]{7,20}$/;
    if (!formData.phone.trim() || !phoneRegex.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number (at least 7 digits).';
    }

    if (!formData.concern.trim() || formData.concern.length < 5) {
      newErrors.concern = 'Please describe your concern (at least 5 characters).';
    }

    if (!formData.preferredDate) {
      newErrors.preferredDate = 'Date is required.';
    } else {
      const selected = new Date(formData.preferredDate);
      const today = new Date();
      today.setHours(0,0,0,0);
      if (selected < today) {
        newErrors.preferredDate = 'Appointment date cannot be in the past.';
      }
    }

    if (!formData.preferredTime) {
      newErrors.preferredTime = 'Time is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error
    if (errors[name]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const response = await apiFetch('/api/appointments', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok) {
        setSubmitSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2500);
      } else {
        // Map backend validation errors if any
        if (result.errors) {
          const backendErrors: Record<string, string> = {};
          result.errors.forEach((err: any) => {
            if (err.path) backendErrors[err.path] = err.msg;
          });
          setErrors(backendErrors);
        } else {
          setErrors({ form: result.error || 'Failed to schedule appointment.' });
        }
      }
    } catch (err) {
      console.error(err);
      setErrors({ form: 'Server network error. Please try again later.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="glass-panel modal-content" onClick={(e) => e.stopPropagation()} style={{ border: '1px solid rgba(255, 255, 255, 0.15)' }}>
        <button className="close-btn" onClick={onClose} aria-label="Close booking modal">
          <X size={20} />
        </button>

        {submitSuccess ? (
          <div style={{ textAlign: 'center', padding: '2rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <CheckCircle2 size={60} style={{ color: 'var(--color-primary)' }} />
            <h2 id="modal-title" style={{ fontSize: '1.5rem' }}>Appointment Scheduled!</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', maxWidth: '350px' }}>
              Thank you, {formData.name}. We've saved your request for {formData.preferredDate} at {formData.preferredTime}. 
              Our clinic desk will contact you soon.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <div className="brand-icon" style={{ width: '32px', height: '32px' }}>
                <Sparkles size={16} />
              </div>
              <h2 id="modal-title" style={{ fontSize: '1.3rem' }}>
                {selectedTreatment ? `Book ${selectedTreatment.name}` : 'Schedule Consultation'}
              </h2>
            </div>

            {errors.form && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {errors.form}
              </div>
            )}

            {/* Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="booking-name">Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
                <input 
                  type="text" 
                  id="booking-name"
                  name="name"
                  className="form-input" 
                  style={{ paddingLeft: '2.25rem' }}
                  placeholder="e.g. Alice Smith"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              {errors.name && <div className="form-error">{errors.name}</div>}
            </div>

            {/* Phone */}
            <div className="form-group">
              <label className="form-label" htmlFor="booking-phone">Phone Number</label>
              <div style={{ position: 'relative' }}>
                <Phone size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
                <input 
                  type="tel" 
                  id="booking-phone"
                  name="phone"
                  className="form-input" 
                  style={{ paddingLeft: '2.25rem' }}
                  placeholder="e.g. +1 555-0199"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                />
              </div>
              {errors.phone && <div className="form-error">{errors.phone}</div>}
            </div>

            {/* Treatment Selector */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="booking-treatment">Preferred Treatment</label>
                <select
                  id="booking-treatment"
                  name="treatmentId"
                  className="form-input"
                  value={formData.treatmentId}
                  onChange={(e) => {
                    const selected = treatments.find(t => t.id === e.target.value);
                    setFormData(prev => ({
                      ...prev,
                      treatmentId: e.target.value,
                      departmentId: selected ? selected.departmentId : '',
                      concern: selected ? `Interested in ${selected.name}` : prev.concern
                    }));
                  }}
                >
                  <option value="">General Consultation</option>
                  {treatments.map(t => (
                    <option key={t.id} value={t.id}>{t.name} (${t.cost})</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div className="form-group">
                <label className="form-label" htmlFor="booking-date">Preferred Date</label>
                <input 
                  type="date" 
                  id="booking-date"
                  name="preferredDate"
                  className="form-input" 
                  value={formData.preferredDate}
                  onChange={handleInputChange}
                  required
                />
                {errors.preferredDate && <div className="form-error">{errors.preferredDate}</div>}
              </div>
            </div>

            {/* Time */}
            <div className="form-group">
              <label className="form-label" htmlFor="booking-time">Preferred Time</label>
              <div style={{ position: 'relative' }}>
                <Clock size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
                <input 
                  type="text" 
                  id="booking-time"
                  name="preferredTime"
                  className="form-input" 
                  style={{ paddingLeft: '2.25rem' }}
                  placeholder="e.g. 10:00 AM, 3:30 PM"
                  value={formData.preferredTime}
                  onChange={handleInputChange}
                  required
                />
              </div>
              {errors.preferredTime && <div className="form-error">{errors.preferredTime}</div>}
            </div>

            {/* Concern details */}
            <div className="form-group">
              <label className="form-label" htmlFor="booking-concern">Primary Concern / Message</label>
              <div style={{ position: 'relative' }}>
                <FileText size={16} style={{ position: 'absolute', left: '0.75rem', top: '0.75rem', color: 'var(--color-text-secondary)' }} />
                <textarea 
                  id="booking-concern"
                  name="concern"
                  className="form-input" 
                  style={{ paddingLeft: '2.25rem', minHeight: '80px', resize: 'vertical' }}
                  placeholder="Describe details like pain, acne, hair fall, etc."
                  value={formData.concern}
                  onChange={handleInputChange}
                  required
                />
              </div>
              {errors.concern && <div className="form-error">{errors.concern}</div>}
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Processing booking...' : 'Schedule Appointment'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
