import { Router } from 'express';
import { verifyWebhook, processMessage, processPendingMessages } from '../controllers/whatsappController.js';

const whatsappRouter = Router();

whatsappRouter.get('/webhook', verifyWebhook);

whatsappRouter.post('/webhook',processMessage);

whatsappRouter.post('/pending',processPendingMessages);

export default whatsappRouter;