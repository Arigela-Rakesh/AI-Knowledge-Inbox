import { Router } from 'express';
import { handleIngest, handleGetItems, handleGetItem, handleDeleteItem } from '../controllers/itemsController';
import { handleQuery } from '../controllers/queryController';

const router = Router();

router.post('/ingest', handleIngest);
router.get('/items', handleGetItems);
router.get('/items/:id', handleGetItem);
router.delete('/items/:id', handleDeleteItem);
router.post('/query', handleQuery);
router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

export default router;
