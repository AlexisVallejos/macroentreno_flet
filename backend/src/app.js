import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { query } from './config/db.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import adminRoutes from './modules/admin/admin.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import diaryRoutes from './modules/diary/diary.routes.js';
import exercisesRoutes from './modules/exercises/exercises.routes.js';
import foodsRoutes from './modules/foods/foods.routes.js';
import progressRoutes from './modules/progress/progress.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import workoutsRoutes from './modules/workouts/workouts.routes.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((o) => o.trim()) }));
  app.use(express.json({ limit: '100kb' }));
  if (env.nodeEnv !== 'test') app.use(morgan('dev'));

  app.get('/api/health', async (_req, res) => {
    await query('SELECT 1');
    res.json({ data: { status: 'ok', database: 'ok', time: new Date().toISOString() } });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/foods', foodsRoutes);
  app.use('/api/diary', diaryRoutes);
  app.use('/api/exercises', exercisesRoutes);
  app.use('/api/workouts', workoutsRoutes);
  app.use('/api/progress', progressRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
