// import { bot } from '../bot-telegram/telegram-bot.js';
import { mainBot } from '../bot-telegram/telegram-bot.js';

export const tgWebhook = (req, res) => {
    let body = req.body;
    mainBot.processUpdate(body);
    res.sendStatus(200);
}