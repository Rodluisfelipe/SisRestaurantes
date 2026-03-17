const asyncHandler = require('../utils/asyncHandler');

describe('asyncHandler', () => {
  test('calls the wrapped function with req, res, next', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const req = {}, res = {}, next = jest.fn();

    await asyncHandler(fn)(req, res, next);
    expect(fn).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next with error when handler rejects', async () => {
    const err = new Error('boom');
    const fn = jest.fn().mockRejectedValue(err);
    const req = {}, res = {}, next = jest.fn();

    await asyncHandler(fn)(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });

  test('calls next with error when handler throws synchronously', async () => {
    const err = new Error('sync boom');
    const fn = jest.fn().mockImplementation(() => { throw err; });
    const req = {}, res = {}, next = jest.fn();

    await asyncHandler(fn)(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
