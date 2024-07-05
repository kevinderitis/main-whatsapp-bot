import { Router } from 'express';
import { tgWebhook } from '../controllers/telegramController.js'
import config from '../config/config.js';

const telegramRouter = Router();

const tgToken = config.API_KEY_TELEGRAM;

telegramRouter.post(`/webhook/${tgToken}`, tgWebhook);

export default telegramRouter;