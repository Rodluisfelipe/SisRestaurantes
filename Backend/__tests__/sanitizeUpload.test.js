/**
 * Unit tests for sanitizeUpload middleware
 * 
 * Verifies the image sanitization middleware behaves correctly:
 * - Skips when no file is present
 * - Skips non-image files
 * - Returns a valid middleware function
 */
const sanitizeUpload = require('../middleware/sanitizeUpload');

describe('sanitizeUpload middleware', () => {
  test('exports a function', () => {
    expect(typeof sanitizeUpload).toBe('function');
  });

  test('returns a middleware function when called with options', () => {
    const middleware = sanitizeUpload({ maxWidth: 800, quality: 85 });
    expect(typeof middleware).toBe('function');
  });

  test('returns a middleware function when called without options', () => {
    const middleware = sanitizeUpload();
    expect(typeof middleware).toBe('function');
  });

  test('middleware accepts 3 args (req, res, next)', () => {
    const middleware = sanitizeUpload();
    expect(middleware.length).toBe(3);
  });

  test('calls next() immediately when no file is present', async () => {
    const middleware = sanitizeUpload();
    const req = {};
    const res = {};
    const next = jest.fn();
    
    await middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // called without error
  });

  test('calls next() for non-image file (PDF)', async () => {
    const middleware = sanitizeUpload();
    const req = {
      file: {
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
        path: '/tmp/test.pdf',
      },
    };
    const res = {};
    const next = jest.fn();
    
    await middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('does not throw for image file without actual disk file (graceful)', async () => {
    const middleware = sanitizeUpload();
    const req = {
      file: {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        path: '/tmp/nonexistent-file-for-test.jpg',
        size: 1024,
      },
    };
    const res = {};
    const next = jest.fn();
    
    // Should not throw even if file doesn't exist on disk — it catches the error
    await middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
