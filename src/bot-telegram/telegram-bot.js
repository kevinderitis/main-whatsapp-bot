import TelegramBot from 'node-telegram-bot-api';
import config from '../config/config.js';
import Bottleneck from 'bottleneck';
import { setTelegramChatId, updateClientPhone, changeOrderState, getClientInfo } from '../services/clientServices.js';
import { updateLeadByChatIdService } from '../services/leadServices.js';

const mainToken = config.API_KEY_TELEGRAM;
const secondaryTokens = [config.API_KEY_TELEGRAM_SENDER_1];

const mainBot = new TelegramBot(mainToken, { polling: false });
const bots = secondaryTokens.map(token => new TelegramBot(token, { polling: false }));

const activeBots = [...bots];
const cooldownBots = [];
const domain = config.APP_DOMAIN;

const limiter = new Bottleneck({
    minTime: 4000,
    maxConcurrent: 1,
});

const welcomeMessage = 'Bienvenidos al bot de Vegas Marketing. Vas a poder recibir los leads y modificar la configuración de tu cuenta por este medio. Necesitas el ID de usuario que te proporcionamos para asociar esta cuenta de telegram a tu cuenta de Vegas Marketing.';

mainBot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    mainBot.sendMessage(chatId, welcomeMessage, {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: 'Comenzar',
                        callback_data: 'aceptar'
                    }
                ]
            ],
        },
    });
});

mainBot.onText(/\/info/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        let info = await getClientInfo(chatId);
        let phoneNumber = info ? info.phoneNumber : 'No configurado';
        let remainingLeads = info ? info.remainingLeads : 'No hay ordenes activas';

        mainBot.sendMessage(chatId, `Numero de telefono configurado: ${phoneNumber}\nCantidad restante de leads: ${remainingLeads}`);
    } catch (error) {
        console.log(error);
        mainBot.sendMessage(chatId, `Error al obtener info`);
    }
});

mainBot.onText(/\/number (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const newNumber = msg.text.split(" ")[1];
    try {
        await updateClientPhone(chatId, newNumber);
        mainBot.sendMessage(chatId, `Se cambio el numero de telefono: ${newNumber}`);
    } catch (error) {
        console.log(error);
        mainBot.sendMessage(chatId, `Error al actualizar el numero`);
    }
});

mainBot.onText(/\/user (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.text.split(" ")[1];
    try {
        await setTelegramChatId(chatId, userId);
        mainBot.sendMessage(chatId, `Configuración para el usuario ID: ${userId}`);
    } catch (error) {
        console.log(error);
        mainBot.sendMessage(chatId, `No se pudo crear la configuración, verifica tu ID de usuario.`);
    }
});

mainBot.onText(/\/lead (start|stop)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const command = msg.text.split(" ")[1];
    console.log(command);
    try {
        let message;

        if (command === "start") {
            await changeOrderState(chatId, command);
            message = "Se inició el envío de leads.";
        } else if (command === "stop") {
            await changeOrderState(chatId, command);
            message = "Se detuvo el envío de leads.";
        } else {
            message = "El comando es desconocido, intenta con /lead stop o /lead start";
        }

        mainBot.sendMessage(chatId, message);
    } catch (error) {
        console.log(error);
        mainBot.sendMessage(chatId, `Hubo un error al ejecutar el comando.`);
    }
});

mainBot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const action = callbackQuery.data;
    if (action === 'aceptar') {
        mainBot.sendMessage(chatId, 'Escribe /user seguido de tu ID para poder continuar con la configuración.\nPor ejemplo: /user 60d5f1234a4f123b5c6d7e8f');
    }
});

mainBot.setWebHook(`${domain}/telegram/webhook/${mainToken}`);

const getAvailableBot = () => {
    if (activeBots.length > 0) {
        return activeBots.shift();
    }
    return null;
};

const addBotToCooldown = (bot, cooldownTime) => {
    cooldownBots.push(bot);
    setTimeout(() => {
        activeBots.push(bot);
        cooldownBots.splice(cooldownBots.indexOf(bot), 1);
    }, cooldownTime);
};

export const sendContactTelegram = async (phoneNumber, chatId) => {
    const firstName = "Contacto";

    const sendContact = async (bot) => {
        try {
            await bot.sendContact(chatId, phoneNumber, firstName, {
                vcard: `BEGIN:VCARD
                        VERSION:3.0
                        FN:${firstName}
                        TEL;TYPE=CELL:${phoneNumber}
                        END:VCARD`
            });
            console.log(`Contact sent to telegram: ${chatId}`);
        } catch (error) {
            console.log(error);
            throw error;
        }
    };

    const sendMessage = async (bot) => {
        try {
            const whatsappLink = `https://api.whatsapp.com/send/?phone=${phoneNumber}`;
            const messageText = `Hablar por whatsapp ${phoneNumber}: [Contactar](${whatsappLink})`;
            await new Promise(resolve => setTimeout(resolve, 2000));
            await bot.sendMessage(chatId, messageText, { parse_mode: 'Markdown' });
            await updateLeadByChatIdService(phoneNumber, 'sent');
            console.log(`Message sent to telegram: ${chatId}`);
        } catch (error) {
            console.log(error);
            throw error;
        }
    };

    try {
        const bot = getAvailableBot();
        console.log(bot);
        if (!bot) {
            console.log('No bots available, all are on cooldown.');
            return;
        }

        // await limiter.schedule(() => sendContact(bot));
        await limiter.schedule(() => sendMessage(bot));
    } catch (error) {
        if (error.response && error.response.statusCode === 429) {
            const retryAfter = parseInt(error.response.body.parameters.retry_after, 10) || 1;
            console.log(`Retrying after ${retryAfter} seconds`);
            addBotToCooldown(bot, retryAfter * 1000);
            setTimeout(() => sendContactTelegram(phoneNumber, chatId), retryAfter * 1000);
        }
    }
};

export { mainBot, bots };