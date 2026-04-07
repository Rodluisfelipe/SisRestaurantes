const express = require('express');
const router = express.Router();
const AuditLog = require('../Models/AuditLog');
const Product = require('../Models/Product');
const Category = require('../Models/Category');
const ToppingGroup = require('../Models/ToppingGroup');
const BusinessConfig = require('../Models/BusinessConfig');
const { protectSuperAdmin } = require('../middleware/authSuperAdmin');
const logger = require('../utils/logger');

// All routes require superadmin auth
router.use(protectSuperAdmin);

// GET /api/audit-logs — list audit logs with filters
router.get('/', async (req, res) => {
  try {
    const { businessId, resource, action, page = 1, limit = 50, from, to } = req.query;

    const filter = {};
    if (businessId) filter.businessId = businessId;
    if (resource) filter.resource = resource;
    if (action) filter.action = action;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = toDate;
      }
    }

    const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      AuditLog.countDocuments(filter)
    ]);

    res.json({
      logs,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    logger.error('Error fetching audit logs', error);
    res.status(500).json({ message: 'Error fetching audit logs' });
  }
});

// GET /api/audit-logs/businesses — list businesses that have audit logs (for filter dropdown)
router.get('/businesses', async (req, res) => {
  try {
    const businesses = await AuditLog.aggregate([
      { $group: { _id: '$businessId', businessName: { $first: '$businessName' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    res.json(businesses.map(b => ({ id: b._id, name: b.businessName || 'Sin nombre', count: b.count })));
  } catch (error) {
    logger.error('Error fetching audit businesses', error);
    res.status(500).json({ message: 'Error' });
  }
});

// GET /api/audit-logs/stats — quick stats
router.get('/stats', async (req, res) => {
  try {
    const { businessId } = req.query;
    const filter = businessId ? { businessId } : {};

    const [total, today, byAction, byResource] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.countDocuments({
        ...filter,
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }),
      AuditLog.aggregate([
        { $match: filter },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      AuditLog.aggregate([
        { $match: filter },
        { $group: { _id: '$resource', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    res.json({ total, today, byAction, byResource });
  } catch (error) {
    logger.error('Error fetching audit stats', error);
    res.status(500).json({ message: 'Error' });
  }
});

// POST /api/audit-logs/:id/revert — revert an action
router.post('/:id/revert', async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id);
    if (!log) return res.status(404).json({ message: 'Log not found' });
    if (log.reverted) return res.status(400).json({ message: 'This action was already reverted' });
    if (!log.before && log.action !== 'create') {
      return res.status(400).json({ message: 'No snapshot available to revert' });
    }

    const ModelMap = {
      product: Product,
      category: Category,
      toppingGroup: ToppingGroup,
      businessConfig: BusinessConfig,
    };

    const Model = ModelMap[log.resource];
    if (!Model) return res.status(400).json({ message: `Cannot revert resource type: ${log.resource}` });

    let result;

    switch (log.action) {
      case 'delete': {
        // Re-create the deleted document from the before snapshot
        if (!log.before) return res.status(400).json({ message: 'No before snapshot for delete revert' });
        const data = { ...log.before };
        delete data.__v;
        // Use the original _id
        const doc = new Model(data);
        doc._id = log.before._id;
        doc.isNew = true;
        await doc.save();
        result = `Restored ${log.resource}: ${log.resourceName}`;
        break;
      }

      case 'update':
      case 'toggle': {
        // Restore the before state
        if (!log.before) return res.status(400).json({ message: 'No before snapshot for update revert' });
        const updateData = { ...log.before };
        delete updateData._id;
        delete updateData.__v;
        delete updateData.createdAt;
        await Model.findByIdAndUpdate(log.resourceId, updateData);
        result = `Reverted ${log.resource} to previous state: ${log.resourceName}`;
        break;
      }

      case 'create': {
        // Delete the created document
        await Model.findByIdAndDelete(log.resourceId);
        result = `Deleted created ${log.resource}: ${log.resourceName}`;
        break;
      }

      default:
        return res.status(400).json({ message: `Cannot revert action: ${log.action}` });
    }

    // Mark as reverted
    log.reverted = true;
    log.revertedAt = new Date();
    log.revertedBy = req.user.email;
    await log.save();

    logger.info(`Audit log reverted: ${log._id} by ${req.user.email}`, { logId: log._id, action: log.action, resource: log.resource });

    res.json({ message: result, revertedLog: log });
  } catch (error) {
    logger.error('Error reverting audit log', error);
    res.status(500).json({ message: 'Error reverting action: ' + error.message });
  }
});

module.exports = router;
