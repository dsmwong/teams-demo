import { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../src/middleware/auth';

describe('requireAuth', () => {
  const next = jest.fn() as jest.MockedFunction<NextFunction>;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;

  beforeEach(() => jest.clearAllMocks());

  it('calls next() when demo_auth cookie matches DEMO_PASSWORD', () => {
    const req = { cookies: { demo_auth: 'testpassword123' } } as unknown as Request;
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when cookie is absent', () => {
    const req = { cookies: {} } as unknown as Request;
    requireAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when cookie value is wrong', () => {
    const req = { cookies: { demo_auth: 'wrongpassword' } } as unknown as Request;
    requireAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
