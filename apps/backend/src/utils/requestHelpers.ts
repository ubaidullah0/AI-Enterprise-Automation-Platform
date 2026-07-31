import { Request } from 'express';

/**
 * Safely extract a single string value from a request header.
 * Headers can be string | string[] | undefined — this normalises to string | undefined.
 */
export const getHeader = (req: Request, name: string): string | undefined => {
  const val = req.headers[name.toLowerCase()];
  if (Array.isArray(val)) return val[0];
  return val;
};

/**
 * Extract and validate the Organization ID from request headers.
 * Returns the orgId string, or throws a typed error object to send to the client.
 */
export const requireOrgHeader = (req: Request): string => {
  const orgId = getHeader(req, 'x-organization-id');
  if (!orgId) {
    throw { status: 400, message: 'X-Organization-ID header is required' };
  }
  return orgId;
};

/**
 * Safely extract a single string value from req.params.
 * This avoids the string | string[] typing issue.
 */
export const getParam = (req: Request, name: string): string => {
  const val = (req.params as Record<string, string | string[]>)[name];
  if (Array.isArray(val)) return val[0] ?? '';
  return val ?? '';
};
