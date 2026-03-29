import { ApiError, errorHandler, notFoundHandler } from '../../src/api/middleware/errorHandler';

type MockResponse = {
  statusCode: number;
  body: unknown;
  status: jest.Mock;
  json: jest.Mock;
};

function createResponse(): MockResponse {
  const response: MockResponse = {
    statusCode: 200,
    body: undefined,
    status: jest.fn(),
    json: jest.fn()
  };

  response.status.mockImplementation((code: number) => {
    response.statusCode = code;
    return response;
  });

  response.json.mockImplementation((body: unknown) => {
    response.body = body;
    return response;
  });

  return response;
}

describe('error middleware', () => {
  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  it('serializes ApiError instances with their status code', () => {
    const response = createResponse();
    const error = new ApiError('Invalid request', 422);

    errorHandler(error, { method: 'POST', path: '/api/evidence' } as any, response as any, jest.fn());

    expect(response.statusCode).toBe(422);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: 'Invalid request',
        statusCode: 422
      }
    });
  });

  it('maps multer file-size errors to a bad request response', () => {
    const response = createResponse();
    const error = Object.assign(new Error('File too large'), { name: 'MulterError' });

    errorHandler(error, { method: 'POST', path: '/api/evidence' } as any, response as any, jest.fn());

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: 'File too large. Maximum size is 100MB',
        statusCode: 400
      }
    });
  });

  it('hides generic error details in production', () => {
    process.env.NODE_ENV = 'production';
    const response = createResponse();

    errorHandler(new Error('database offline'), { method: 'GET', path: '/api/evidence' } as any, response as any, jest.fn());

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: 'Internal server error',
        statusCode: 500
      }
    });
  });

  it('returns unmatched routes as 404 responses', () => {
    const response = createResponse();

    notFoundHandler({ method: 'GET', path: '/missing' } as any, response as any);

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: 'Route not found',
        statusCode: 404
      }
    });
  });
});
