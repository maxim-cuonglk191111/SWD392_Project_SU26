import { Request, Response, NextFunction } from 'express';
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('[Error]', err.message || err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
}
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
}
