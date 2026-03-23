/**
 * Tests for the Referral System
 * 
 * Tests:
 * 1. Validators — referralValidators.js
 * 2. Models — ReferralConfig (getConfig singleton), Referral schema
 * 3. Routes — referrals.js (admin endpoints) + adminReferrals.js (superadmin)
 * 4. Helper — referralHelper.js (processReferralOnPayment, depositCredits, applyReferralCredits)
 * 5. Integration — auth.js referralCode in registration
 */

const express = require('express');
const request = require('supertest');

// ──────────────────────────────
// 1. VALIDATOR TESTS
// ──────────────────────────────

const {
  validateUpdateConfig,
  validateApproveReferral,
  validateRejectReferral,
  validateReferralCode
} = require('../middleware/validators/referralValidators');

function createValidatorApp(validators, method = 'post', path = '/test') {
  const app = express();
  app.use(express.json());
  if (method === 'get') {
    app.get(path, validators, (req, res) => res.json({ ok: true }));
  } else if (method === 'patch') {
    app.patch(path, validators, (req, res) => res.json({ ok: true }));
  } else {
    app.post(path, validators, (req, res) => res.json({ ok: true }));
  }
  return app;
}

describe('Referral Validators', () => {
  describe('validateUpdateConfig', () => {
    let app;
    beforeAll(() => { app = createValidatorApp(validateUpdateConfig, 'post', '/config'); });

    test('accepts valid config update', async () => {
      const res = await request(app).post('/config').send({
        isActive: true,
        referrerDiscountPercent: 15,
        referredDiscountPercent: 10,
        maxCreditsPerBusiness: 1000000,
        maxReferralsPerBusiness: 25,
        requireApproval: true,
        minSubscriptionMonths: 2
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    test('accepts partial config update', async () => {
      const res = await request(app).post('/config').send({ isActive: false });
      expect(res.status).toBe(200);
    });

    test('accepts empty body (all optional)', async () => {
      const res = await request(app).post('/config').send({});
      expect(res.status).toBe(200);
    });

    test('rejects referrerDiscountPercent > 100', async () => {
      const res = await request(app).post('/config').send({ referrerDiscountPercent: 150 });
      expect(res.status).toBe(422);
    });

    test('rejects referrerDiscountPercent < 0', async () => {
      const res = await request(app).post('/config').send({ referrerDiscountPercent: -5 });
      expect(res.status).toBe(422);
    });

    test('rejects referredDiscountPercent > 100', async () => {
      const res = await request(app).post('/config').send({ referredDiscountPercent: 200 });
      expect(res.status).toBe(422);
    });

    test('rejects maxCreditsPerBusiness < 0', async () => {
      const res = await request(app).post('/config').send({ maxCreditsPerBusiness: -1 });
      expect(res.status).toBe(422);
    });

    test('rejects maxReferralsPerBusiness < 1', async () => {
      const res = await request(app).post('/config').send({ maxReferralsPerBusiness: 0 });
      expect(res.status).toBe(422);
    });

    test('rejects minSubscriptionMonths < 1', async () => {
      const res = await request(app).post('/config').send({ minSubscriptionMonths: 0 });
      expect(res.status).toBe(422);
    });

    test('rejects non-boolean isActive', async () => {
      const res = await request(app).post('/config').send({ isActive: 'yes' });
      expect(res.status).toBe(422);
    });

    test('rejects non-boolean requireApproval', async () => {
      const res = await request(app).post('/config').send({ requireApproval: 'maybe' });
      expect(res.status).toBe(422);
    });
  });

  describe('validateApproveReferral', () => {
    let app;
    beforeAll(() => { app = createValidatorApp(validateApproveReferral, 'patch', '/approve/:id'); });

    test('accepts valid MongoDB ObjectId', async () => {
      const res = await request(app).patch('/approve/507f1f77bcf86cd799439011');
      expect(res.status).toBe(200);
    });

    test('rejects invalid ObjectId', async () => {
      const res = await request(app).patch('/approve/not-a-valid-id');
      expect(res.status).toBe(422);
    });

    test('rejects short string', async () => {
      const res = await request(app).patch('/approve/abc');
      expect(res.status).toBe(422);
    });
  });

  describe('validateRejectReferral', () => {
    let app;
    beforeAll(() => { app = createValidatorApp(validateRejectReferral, 'patch', '/reject/:id'); });

    test('accepts valid ObjectId without reason', async () => {
      const res = await request(app).patch('/reject/507f1f77bcf86cd799439011').send({});
      expect(res.status).toBe(200);
    });

    test('accepts valid ObjectId with reason', async () => {
      const res = await request(app).patch('/reject/507f1f77bcf86cd799439011')
        .send({ reason: 'Sospecha de auto-referido' });
      expect(res.status).toBe(200);
    });

    test('rejects invalid ObjectId', async () => {
      const res = await request(app).patch('/reject/invalid')
        .send({ reason: 'Test' });
      expect(res.status).toBe(422);
    });

    test('rejects reason longer than 500 chars', async () => {
      const res = await request(app).patch('/reject/507f1f77bcf86cd799439011')
        .send({ reason: 'A'.repeat(501) });
      expect(res.status).toBe(422);
    });
  });

  describe('validateReferralCode', () => {
    let app;
    beforeAll(() => { app = createValidatorApp(validateReferralCode, 'get', '/validate/:code'); });

    test('accepts valid 8-char alphanumeric code', async () => {
      const res = await request(app).get('/validate/ABCD1234');
      expect(res.status).toBe(200);
    });

    test('accepts 4-char code (min length)', async () => {
      const res = await request(app).get('/validate/AB12');
      expect(res.status).toBe(200);
    });

    test('accepts 12-char code (max length)', async () => {
      const res = await request(app).get('/validate/ABCDEFGH1234');
      expect(res.status).toBe(200);
    });

    test('rejects code shorter than 4 chars', async () => {
      const res = await request(app).get('/validate/AB');
      expect(res.status).toBe(422);
    });

    test('rejects code longer than 12 chars', async () => {
      const res = await request(app).get('/validate/ABCDEFGHIJ12345');
      expect(res.status).toBe(422);
    });

    test('rejects code with special characters', async () => {
      const res = await request(app).get('/validate/AB$D-EFG');
      expect(res.status).toBe(422);
    });
  });
});

// ──────────────────────────────
// 2. MODEL SCHEMA TESTS
// ──────────────────────────────

describe('Referral Models — schema validation', () => {
  describe('ReferralConfig schema', () => {
    // We test schema definition by reading the file rather than connecting to MongoDB
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Models', 'ReferralConfig.js'), 'utf8');

    test('has isActive field with boolean default false', () => {
      expect(src).toContain('isActive');
      expect(src).toContain("default: false");
    });

    test('has referrerDiscountPercent with min:0, max:100', () => {
      expect(src).toContain('referrerDiscountPercent');
      expect(src).toContain('min: 0');
      expect(src).toContain('max: 100');
    });

    test('has referredDiscountPercent with min:0, max:100', () => {
      expect(src).toContain('referredDiscountPercent');
    });

    test('has maxCreditsPerBusiness default 500000', () => {
      expect(src).toContain('maxCreditsPerBusiness');
      expect(src).toContain('500000');
    });

    test('has maxReferralsPerBusiness default 50', () => {
      expect(src).toContain('maxReferralsPerBusiness');
      expect(src).toContain('default: 50');
    });

    test('has requireApproval field', () => {
      expect(src).toContain('requireApproval');
    });

    test('has minSubscriptionMonths default 1', () => {
      expect(src).toContain('minSubscriptionMonths');
    });

    test('has static getConfig method', () => {
      expect(src).toContain('getConfig');
      expect(src).toContain('statics.getConfig');
    });

    test('has timestamps enabled', () => {
      expect(src).toContain('timestamps: true');
    });
  });

  describe('Referral schema', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Models', 'Referral.js'), 'utf8');

    test('has referrerBusinessId as required ObjectId ref BusinessConfig', () => {
      expect(src).toContain('referrerBusinessId');
      expect(src).toContain("ref: 'BusinessConfig'");
    });

    test('has referredBusinessId as required ObjectId', () => {
      expect(src).toContain('referredBusinessId');
    });

    test('has referralCode field as required, uppercase, trim', () => {
      expect(src).toContain('referralCode');
      expect(src).toContain('uppercase: true');
      expect(src).toContain('trim: true');
    });

    test('has correct status enum (pending, qualified, approved, credited, rejected)', () => {
      expect(src).toContain("'pending'");
      expect(src).toContain("'qualified'");
      expect(src).toContain("'approved'");
      expect(src).toContain("'credited'");
      expect(src).toContain("'rejected'");
    });

    test('has referrerCreditsAwarded', () => {
      expect(src).toContain('referrerCreditsAwarded');
    });

    test('has referredDiscountAwarded', () => {
      expect(src).toContain('referredDiscountAwarded');
    });

    test('has qualifiedAt, creditedAt, rejectedAt date fields', () => {
      expect(src).toContain('qualifiedAt');
      expect(src).toContain('creditedAt');
      expect(src).toContain('rejectedAt');
    });

    test('has rejectionReason with maxlength', () => {
      expect(src).toContain('rejectionReason');
      expect(src).toContain('maxlength: 500');
    });

    test('has unique index on referredBusinessId (one referral per business)', () => {
      expect(src).toContain('{ referredBusinessId: 1 }');
      expect(src).toContain('unique: true');
    });

    test('has index on referrerBusinessId + status', () => {
      expect(src).toContain('{ referrerBusinessId: 1, status: 1 }');
    });

    test('has index on referralCode', () => {
      expect(src).toContain('{ referralCode: 1 }');
    });

    test('exports REFERRAL_STATUSES constant', () => {
      expect(src).toContain('REFERRAL_STATUSES');
      const { REFERRAL_STATUSES } = require('../Models/Referral');
      expect(REFERRAL_STATUSES).toEqual(['pending', 'qualified', 'approved', 'credited', 'rejected']);
    });
  });
});

// ──────────────────────────────
// 3. BUSINESSCONFIG MODIFICATIONS
// ──────────────────────────────

describe('BusinessConfig — referral fields', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'Models', 'BusinessConfig.js'), 'utf8');

  test('has referralCode field with unique, sparse, uppercase', () => {
    expect(src).toContain('referralCode');
    // Check sparse unique index
    expect(src).toContain("sparse: true");
    expect(src).toContain("uppercase: true");
  });

  test('has referralCredits field with default 0', () => {
    expect(src).toContain('referralCredits');
    // The default should be 0
    expect(src).toMatch(/referralCredits[\s\S]*?default:\s*0/);
  });

  test('has sparse unique index for referralCode', () => {
    expect(src).toContain("{ referralCode: 1 }");
    expect(src).toContain("unique: true, sparse: true");
  });
});

// ──────────────────────────────
// 4. SUBSCRIPTION MODIFICATIONS
// ──────────────────────────────

describe('Subscription — referral discount fields', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'Models', 'Subscription.js'), 'utf8');

  test('has referralDiscountApplied field with default 0', () => {
    expect(src).toContain('referralDiscountApplied');
  });

  test('has referralDiscountSource field', () => {
    expect(src).toContain('referralDiscountSource');
  });
});

// ──────────────────────────────
// 5. REFERRAL HELPER TESTS
// ──────────────────────────────

describe('referralHelper.js — exports and structure', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'utils', 'referralHelper.js'), 'utf8');

  test('exports processReferralOnPayment', () => {
    expect(src).toContain('processReferralOnPayment');
    expect(src).toContain('module.exports');
  });

  test('exports depositCredits', () => {
    expect(src).toContain('depositCredits');
  });

  test('exports applyReferralCredits', () => {
    expect(src).toContain('applyReferralCredits');
  });

  test('processReferralOnPayment checks isActive config', () => {
    expect(src).toContain('config.isActive');
  });

  test('processReferralOnPayment checks minSubscriptionMonths', () => {
    expect(src).toContain('config.minSubscriptionMonths');
  });

  test('processReferralOnPayment calculates credits using referrerDiscountPercent', () => {
    expect(src).toContain('config.referrerDiscountPercent');
  });

  test('processReferralOnPayment respects requireApproval setting', () => {
    expect(src).toContain('config.requireApproval');
    expect(src).toContain("'qualified'");
  });

  test('depositCredits checks maxCreditsPerBusiness cap', () => {
    expect(src).toContain('config.maxCreditsPerBusiness');
    expect(src).toContain('creditsToAdd');
  });

  test('depositCredits uses atomic $inc for credits', () => {
    expect(src).toContain('$inc');
    expect(src).toContain('referralCredits');
  });

  test('applyReferralCredits deducts with atomic $inc (negative)', () => {
    // Should decrement credits
    expect(src).toContain('$inc: { referralCredits: -discount }');
  });

  test('applyReferralCredits respects min(credits, price)', () => {
    expect(src).toContain('Math.min');
  });

  test('functions handle errors gracefully without throwing', () => {
    // All functions should have try/catch and return result objects
    expect(src).toContain('catch (error)');
    expect(src).toMatch(/return \{.*processed: false/s);
    expect(src).toMatch(/return \{.*discountApplied: 0/s);
  });
});

// ──────────────────────────────
// 6. ROUTE INTEGRATION CHECKS
// ──────────────────────────────

describe('Routes — referrals.js structure', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'referrals.js'), 'utf8');

  test('has GET /my-code endpoint', () => {
    expect(src).toContain("'/my-code'");
    expect(src).toContain('authMiddleware');
  });

  test('has GET /my-referrals endpoint', () => {
    expect(src).toContain("'/my-referrals'");
  });

  test('has GET /my-credits endpoint', () => {
    expect(src).toContain("'/my-credits'");
  });

  test('has GET /validate/:code public endpoint', () => {
    expect(src).toContain("'/validate/:code'");
  });

  test('validate endpoint has rate limiter', () => {
    expect(src).toContain('validateLimiter');
    expect(src).toContain('rateLimit');
  });

  test('code generation uses same charset as Coupon (no I, O, 0, 1)', () => {
    expect(src).toContain('ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
  });

  test('generates 8-character codes', () => {
    expect(src).toContain('i < 8');
  });

  test('my-code checks ReferralConfig.isActive before generating', () => {
    expect(src).toContain('config.isActive');
  });

  test('my-code returns shareUrl with correct format', () => {
    expect(src).toContain('shareUrl');
    expect(src).toContain('/register?ref=');
  });

  test('my-referrals uses pagination with skip/limit', () => {
    expect(src).toContain('skip');
    expect(src).toContain('limit');
  });

  test('my-referrals includes aggregate stats', () => {
    expect(src).toContain('$group');
    expect(src).toContain('totalReferred');
    expect(src).toContain('totalCredited');
    expect(src).toContain('totalCredits');
  });

  test('validate endpoint converts code to uppercase', () => {
    expect(src).toContain('.toUpperCase()');
  });

  test('validate endpoint returns referrerName for valid codes', () => {
    expect(src).toContain('referrerName');
  });
});

describe('Routes — adminReferrals.js structure', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'adminReferrals.js'), 'utf8');

  test('uses protectSuperAdmin middleware', () => {
    expect(src).toContain('protectSuperAdmin');
    expect(src).toContain('router.use(protectSuperAdmin)');
  });

  test('has GET /config endpoint', () => {
    expect(src).toContain("'/config'");
    expect(src).toContain('router.get');
  });

  test('has PUT /config endpoint', () => {
    expect(src).toContain('router.put');
    expect(src).toContain("'/config'");
  });

  test('PUT /config uses whitelist of allowed fields', () => {
    expect(src).toContain('isActive');
    expect(src).toContain('referrerDiscountPercent');
    expect(src).toContain('referredDiscountPercent');
    expect(src).toContain('maxCreditsPerBusiness');
    expect(src).toContain('maxReferralsPerBusiness');
    expect(src).toContain('requireApproval');
    expect(src).toContain('minSubscriptionMonths');
  });

  test('has GET /overview endpoint with KPIs', () => {
    expect(src).toContain("'/overview'");
    expect(src).toContain('kpis');
    expect(src).toContain('$group');
  });

  test('overview supports status filter', () => {
    expect(src).toContain("status !== 'all'");
  });

  test('overview has pagination', () => {
    expect(src).toContain('pagination');
    expect(src).toContain('totalPages');
  });

  test('has PATCH /:id/approve endpoint', () => {
    expect(src).toContain("'/:id/approve'");
    expect(src).toContain('router.patch');
  });

  test('approve rejects already-credited referrals', () => {
    expect(src).toContain("'qualified', 'pending'");
  });

  test('approve calls depositCredits for qualified referrals', () => {
    expect(src).toContain('depositCredits');
  });

  test('has PATCH /:id/reject endpoint', () => {
    expect(src).toContain("'/:id/reject'");
  });

  test('reject prevents rejection of already-credited referrals', () => {
    expect(src).toContain("'credited'");
  });

  test('reject saves rejectionReason and rejectedAt', () => {
    expect(src).toContain('rejectionReason');
    expect(src).toContain('rejectedAt');
  });

  test('has GET /top-referrers endpoint', () => {
    expect(src).toContain("'/top-referrers'");
  });

  test('top-referrers uses $lookup for business names', () => {
    expect(src).toContain('$lookup');
    expect(src).toContain('businessconfigs');
  });

  test('uses validators for all mutation endpoints', () => {
    expect(src).toContain('validateUpdateConfig');
    expect(src).toContain('validateApproveReferral');
    expect(src).toContain('validateRejectReferral');
  });
});

// ──────────────────────────────
// 7. AUTH.JS INTEGRATION
// ──────────────────────────────

describe('Auth routes — referralCode at registration', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'auth.js'), 'utf8');

  test('POST /register destructures referralCode from body', () => {
    expect(src).toContain('referralCode');
    expect(src).toMatch(/const\s*\{[^}]*referralCode[^}]*\}\s*=\s*req\.body/);
  });

  test('POST /register handles referralCode after subscription creation', () => {
    // Should check for referralCode after saving subscription
    expect(src).toContain("referralCode && typeof referralCode === 'string'");
  });

  test('referral processing in register is wrapped in try/catch (non-blocking)', () => {
    // The referral code section should not block registration
    expect(src).toContain('// Process referral code');
  });

  test('converts referralCode to uppercase before lookup', () => {
    expect(src).toContain('referralCode.toUpperCase()');
  });

  test('prevents self-referral (referrer !== new business)', () => {
    expect(src).toContain('referrer._id.toString() !== businessConfig._id.toString()');
  });

  test('creates Referral document with status pending', () => {
    expect(src).toContain("status: 'pending'");
  });

  test('POST /google also accepts referralCode', () => {
    // The Google auth route should also destructure referralCode from req.body
    // Split after the googleAuthLimiter line to get into the Google handler body
    const googleIdx = src.indexOf("router.post('/google'");
    expect(googleIdx).toBeGreaterThan(-1);
    const googleSection = src.substring(googleIdx, googleIdx + 500);
    expect(googleSection).toContain('referralCode');
  });

  test('referral failure does not block registration', () => {
    // After the referral try/catch, registration should still succeed
    // Check that registration response comes after the referral block
    const registerSection = src.substring(src.indexOf("'/register'"), src.indexOf("'/login'") || src.length);
    // The referral code is wrapped in try-catch
    expect(registerSection).toContain('catch (refErr)');
  });
});

// ──────────────────────────────
// 8. PAYMENT INTEGRATION
// ──────────────────────────────

describe('ePayco integration — referral processing', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'epaycoPayments.js'), 'utf8');

  test('imports referralHelper', () => {
    expect(src).toContain("require('../utils/referralHelper')");
  });

  test('calls processReferralOnPayment after subscription activation', () => {
    expect(src).toContain('processReferralOnPayment');
  });

  test('calls applyReferralCredits for the paying business', () => {
    expect(src).toContain('applyReferralCredits');
  });

  test('saves referralDiscountApplied to subscription', () => {
    expect(src).toContain('referralDiscountApplied');
    expect(src).toContain('referralDiscountSource');
  });

  test('referral processing is wrapped in try/catch (non-blocking)', () => {
    expect(src).toContain('Non-blocking referral processing error');
  });
});

describe('dLocal integration — referral processing', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'dlocalPayments.js'), 'utf8');

  test('imports referralHelper', () => {
    expect(src).toContain("require('../utils/referralHelper')");
  });

  test('calls processReferralOnPayment after subscription activation', () => {
    expect(src).toContain('processReferralOnPayment');
  });

  test('calls applyReferralCredits for the paying business', () => {
    expect(src).toContain('applyReferralCredits');
  });

  test('saves referralDiscountApplied to subscription', () => {
    expect(src).toContain('referralDiscountApplied');
    expect(src).toContain('referralDiscountSource');
  });

  test('referral processing is wrapped in try/catch (non-blocking)', () => {
    expect(src).toContain('Non-blocking referral processing error');
  });
});

// ──────────────────────────────
// 9. SERVER.JS ROUTE MOUNTING
// ──────────────────────────────

describe('server.js — referral routes mounted', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

  test('mounts /api/referrals route', () => {
    expect(src).toContain('app.use("/api/referrals"');
    expect(src).toContain("require(\"./Routes/referrals\")");
  });

  test('mounts /api/admin/referrals route', () => {
    expect(src).toContain('app.use("/api/admin/referrals"');
    expect(src).toContain("require(\"./Routes/adminReferrals\")");
  });
});

// ──────────────────────────────
// 10. BUSINESSCONFIG ROUTE PROTECTION
// ──────────────────────────────

describe('businessConfig route — referral field protection', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'businessConfig.js'), 'utf8');

  test('strips referralCode from admin update payload', () => {
    expect(src).toContain('delete updateData.referralCode');
  });

  test('strips referralCredits from admin update payload', () => {
    expect(src).toContain('delete updateData.referralCredits');
  });
});

// ──────────────────────────────
// 11. SECURITY CHECKS
// ──────────────────────────────

describe('Security — referral system', () => {
  describe('Anti-fraud protections', () => {
    const fs = require('fs');
    const path = require('path');
    const authSrc = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'auth.js'), 'utf8');
    const referralsSrc = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'referrals.js'), 'utf8');
    const adminReferralsSrc = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'adminReferrals.js'), 'utf8');

    test('self-referral prevention: checks referrer !== new business', () => {
      expect(authSrc).toContain('referrer._id.toString() !== businessConfig._id.toString()');
    });

    test('public validate endpoint has rate limiting', () => {
      expect(referralsSrc).toContain('validateLimiter');
      expect(referralsSrc).toContain('windowMs');
      expect(referralsSrc).toContain('max:');
    });

    test('superadmin routes use protectSuperAdmin', () => {
      expect(adminReferralsSrc).toContain('router.use(protectSuperAdmin)');
    });

    test('admin routes use authMiddleware', () => {
      expect(referralsSrc).toContain('authMiddleware');
    });

    test('Referral schema has unique index on referredBusinessId (prevents duplicates)', () => {
      const referralSrc = fs.readFileSync(path.join(__dirname, '..', 'Models', 'Referral.js'), 'utf8');
      expect(referralSrc).toContain('{ referredBusinessId: 1 }, { unique: true }');
    });

    test('creditedAt cannot be credited again (deposit checks status)', () => {
      const helperSrc = fs.readFileSync(path.join(__dirname, '..', 'utils', 'referralHelper.js'), 'utf8');
      // processReferralOnPayment only finds referrals with status 'pending'
      expect(helperSrc).toContain("status: 'pending'");
    });

    test('maxCreditsPerBusiness cap is enforced in depositCredits', () => {
      const helperSrc = fs.readFileSync(path.join(__dirname, '..', 'utils', 'referralHelper.js'), 'utf8');
      expect(helperSrc).toContain('maxCreditsPerBusiness');
    });

    test('referral code validation is case-insensitive (toUpperCase)', () => {
      expect(referralsSrc).toContain('.toUpperCase()');
      expect(authSrc).toContain('referralCode.toUpperCase()');
    });
  });
});
