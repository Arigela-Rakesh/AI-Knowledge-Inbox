import { Request, Response, NextFunction } from 'express';
import { ingestSchema } from '../validators';
import { ingestNote, ingestUrl } from '../services/ingestionService';
import { findAllItems, findItemById, deleteItem } from '../repositories/itemRepository';
import { findChunksByItemId } from '../repositories/chunkRepository';
import { ApiResponse, Item } from '../types';
import { logger } from '../utils/logger';

export async function handleIngest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = ingestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const input = parsed.data;
    let result;

    if (input.type === 'note') {
      result = await ingestNote(input);
    } else {
      result = await ingestUrl(input);
    }

    res.status(201).json({
      success: true,
      data: {
        item: result.item,
        chunksCreated: result.chunksCreated,
        embeddingsCreated: result.embeddingsCreated,
      },
      message: `Successfully ingested ${input.type}`,
    });
  } catch (err) {
    next(err);
  }
}

export function handleGetItems(req: Request, res: Response, next: NextFunction): void {
  try {
    const items = findAllItems();
    const data = items.map(item => ({
      id: item.id,
      title: item.title,
      source_type: item.source_type,
      source_url: item.source_url,
      created_at: item.created_at,
      preview: item.content.slice(0, 200),
    }));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export function handleGetItem(req: Request, res: Response, next: NextFunction): void {
  try {
    const item = findItemById(req.params.id);
    if (!item) {
      res.status(404).json({ success: false, error: 'Item not found' });
      return;
    }
    const chunks = findChunksByItemId(item.id);
    res.json({ success: true, data: { ...item, chunks } });
  } catch (err) {
    next(err);
  }
}

export function handleDeleteItem(req: Request, res: Response, next: NextFunction): void {
  try {
    const deleted = deleteItem(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Item not found' });
      return;
    }
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (err) {
    next(err);
  }
}
