import { type Request, type Response } from 'express';

/**
 * GET /
 * Home page.
 */
export const index = async (req: Request, res: Response): Promise<void> => {
  res.render('index', { title: 'Express' });
};
