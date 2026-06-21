import { Router, Request, Response } from 'express';
import { chatController } from '../controllers/chatController';
import { appointmentController } from '../controllers/appointmentController';
import { validateAppointment } from '../middleware/validation.middleware';
import { clinicService } from '../services/clinicService';
import { appointmentService } from '../services/appointmentService';

const router = Router();

// Chat session endpoints
router.post('/chat', chatController.sendMessage);
router.get('/chat/history/:sessionId', chatController.getSessionHistory);
router.delete('/chat/session/:sessionId', chatController.clearSession);

// Appointment endpoints
router.post('/appointments', validateAppointment, appointmentController.createAppointment);
router.get('/appointments', appointmentController.getAppointments);
router.patch('/appointments/:id/status', appointmentController.updateStatus);

// Catalog / Directory endpoints
router.get('/services', (req: Request, res: Response) => {
  try {
    const config = clinicService.getConfig();
    return res.status(200).json({
      clinic: config.clinic,
      departments: config.departments,
      treatments: config.treatments
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch services config.' });
  }
});

router.get('/faqs', (req: Request, res: Response) => {
  try {
    const faqs = clinicService.getFAQs();
    return res.status(200).json(faqs);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch FAQs.' });
  }
});

// Admin configuration endpoints (to modify services.json on the fly)
router.post('/admin/treatments', (req: Request, res: Response) => {
  try {
    const { name, departmentId, description, duration, recoveryTime, cost, safetyInfo, keywords } = req.body;
    
    if (!name || !departmentId || !description || !cost) {
      return res.status(400).json({ error: 'Name, departmentId, description, and cost are required.' });
    }

    const added = clinicService.addTreatment({
      name,
      departmentId,
      description,
      duration: duration || '30 mins',
      recoveryTime: recoveryTime || 'Immediate',
      cost: Number(cost),
      safetyInfo: safetyInfo || 'Safe for most skin/body types.',
      keywords: keywords || [name.toLowerCase()]
    });

    if (!added) {
      return res.status(409).json({ error: 'Treatment already exists or failed to save.' });
    }

    return res.status(201).json({ message: 'Treatment added successfully!', treatment: added });
  } catch (error) {
    console.error('Error adding treatment:', error);
    return res.status(500).json({ error: 'Internal server error adding treatment.' });
  }
});

router.post('/admin/faqs', (req: Request, res: Response) => {
  try {
    const { category, question, answer } = req.body;

    if (!category || !question || !answer) {
      return res.status(400).json({ error: 'Category, question, and answer are required.' });
    }

    const added = clinicService.addFAQ({ category, question, answer });
    if (!added) {
      return res.status(409).json({ error: 'FAQ already exists or failed to save.' });
    }

    return res.status(201).json({ message: 'FAQ added successfully!', faq: added });
  } catch (error) {
    console.error('Error adding FAQ:', error);
    return res.status(500).json({ error: 'Internal server error adding FAQ.' });
  }
});

/**
 * GET /admin/stats
 * Returns aggregated dashboard statistics: appointment counts (total & by status/department),
 * total treatments, and total FAQs.
 */
router.get('/admin/stats', (req: Request, res: Response) => {
  try {
    const appointments = appointmentService.getAll();
    const config = clinicService.getConfig();

    // Count appointments by status
    const byStatus: Record<string, number> = { pending: 0, confirmed: 0, cancelled: 0 };
    const byDepartment: Record<string, number> = {};

    for (const apt of appointments) {
      byStatus[apt.status] = (byStatus[apt.status] || 0) + 1;
      if (apt.departmentId) {
        byDepartment[apt.departmentId] = (byDepartment[apt.departmentId] || 0) + 1;
      }
    }

    return res.status(200).json({
      totalAppointments: appointments.length,
      byStatus,
      byDepartment,
      totalTreatments: config.treatments.length,
      totalFaqs: config.faqs.length
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return res.status(500).json({ error: 'Failed to fetch admin statistics.' });
  }
});

/**
 * GET /treatments/:id
 * Returns a single treatment by its ID, enriched with its parent department info.
 */
router.get('/treatments/:id', (req: Request, res: Response) => {
  try {
    const treatment = clinicService.getTreatmentById(req.params.id);
    if (!treatment) {
      return res.status(404).json({ error: 'Treatment not found.' });
    }

    const department = clinicService.getDepartmentById(treatment.departmentId);

    return res.status(200).json({
      ...treatment,
      department: department || null
    });
  } catch (error) {
    console.error('Error fetching treatment detail:', error);
    return res.status(500).json({ error: 'Failed to fetch treatment details.' });
  }
});

export default router;
