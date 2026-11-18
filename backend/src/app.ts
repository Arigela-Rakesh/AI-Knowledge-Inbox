import express from 'express';
import cors from 'cors';
import { config } from './config';
import routes from './routes';
import { errorMiddleware } from './middleware/errorMiddleware';
import { initDb } from './database';

const app = express();

app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);
app.use(errorMiddleware);

// initDb() must be called before the app handles requests.
// In server.ts we await it. In tests we call it in beforeAll.
export { initDb };
export default app;
