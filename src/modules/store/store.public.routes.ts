import { Router } from 'express';
import { getPublicStore } from './store.public.controller';

const router = Router();

router.get('/', getPublicStore);

export default router;
