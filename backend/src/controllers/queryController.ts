import { Request, Response, NextFunction } from 'express';
import { querySchema } from '../validators';
import { queryKnowledge } from '../services/ragService';

export async function handleQuery(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = querySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const result = await queryKnowledge(parsed.data.question);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
