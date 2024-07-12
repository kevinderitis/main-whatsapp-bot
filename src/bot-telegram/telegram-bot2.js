import TelegramBot from 'node-telegram-bot-api';
import config from '../config/config.js';
import Bottleneck from 'bottleneck';
import { setTelegramChatId, updateClientPhone, changeOrderState, getClientInfo } from '../services/clientServices.js';
import { updateLeadByChatIdService } from '../services/leadServices.js';

const token = config.API_KEY_TELEGRAM;

const domain = config.APP_DOMAIN;

const bot = new TelegramBot(token, { polling: false });

const limiter = new Bottleneck({
    minTime: 4000,
    maxConcurrent: 1,
});

const welcomeMessage = 'Bienvenidos al bot de Vegas Marketing. Vas a poder recibir los leads y modificar la configuración de tu cuenta por este medio. Necesitas el ID de usuario que te proporcionamos para asociar esta cuenta de telegram a tu cuenta de Vegas Marketing.';

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, welcomeMessage, {
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

bot.onText(/\/info/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        let info = await getClientInfo(chatId);
        let phoneNumber = info ? info.phoneNumber : 'No configurado';
        let remainingLeads = info ? info.remainingLeads : 'No hay ordenes activas';

        bot.sendMessage(chatId, `Numero de telefono configurado: ${phoneNumber}\nCantidad restante de leads: ${remainingLeads}`);
    } catch (error) {
        console.log(error);
        bot.sendMessage(chatId, `Error al obtener info`);
    }
});

bot.onText(/\/number (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const newNumber = msg.text.split(" ")[1];
    try {
        await updateClientPhone(chatId, newNumber);
        bot.sendMessage(chatId, `Se cambio el numero de telefono: ${newNumber}`);
    } catch (error) {
        console.log(error);
        bot.sendMessage(chatId, `Error al actualizar el numero`);
    }
});

bot.onText(/\/user (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.text.split(" ")[1];
    try {
        await setTelegramChatId(chatId, userId);
        bot.sendMessage(chatId, `Configuración para el usuario ID: ${userId}`);
    } catch (error) {
        console.log(error);
        bot.sendMessage(chatId, `No se pudo crear la configuración, verifica tu ID de usuario.`);
    }
});

bot.onText(/\/lead (start|stop)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const command = msg.text.split(" ")[1];
    console.log(command)
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

        bot.sendMessage(chatId, message);
    } catch (error) {
        console.log(error);
        bot.sendMessage(chatId, `Hubo un error al ejecutar el comando.`);
    }
});

// bot.on('message', (msg) => {
//     const chatId = msg.chat.id;
//     const messageText = msg.text;
//     if (!messageText.startsWith('/')) {
//         bot.sendMessage(chatId, "No reconozco ese comando. Usa /start, /number, /user <id>, /config, /stop <number>");
//     }
// });

bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const action = callbackQuery.data;
    if (action === 'aceptar') {
        bot.sendMessage(chatId, 'Escribe /user seguido de tu ID para poder continuar con la configuración.\nPor ejemplo: /user 60d5f1234a4f123b5c6d7e8f');
    }
});

bot.setWebHook(`${domain}/telegram/webhook/${token}`);

let last429Time = 0;

export const sendContactTelegram = async (phoneNumber, chatId) => {
    const firstName = "Contacto";

    const sendContact = async () => {
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

    const sendMessage = async () => {
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
        const now = Date.now();
        if (now < last429Time) {
            let waitingTime = last429Time - now;
            console.log(`Esperando el levantamiento del tiempo de espera por 429: waiting time ${waitingTime}`);
            return;
        }

        // await limiter.schedule(sendContact);
        await limiter.schedule(sendMessage);
    } catch (error) {
        const now = Date.now();
        console.error('Error al enviar el contacto o el enlace de WhatsApp:', error.statusCode);
        console.error('Error al enviar el contacto o el enlace de WhatsApp:', error.statusMessage);
        if (error.response && error.response.statusCode === 429) {
            const retryAfter = parseInt(error.response.body.parameters.retry_after, 10) || 1;
            console.log(`Retrying after ${retryAfter} seconds`);
            setTimeout(() => sendContactTelegram(phoneNumber, chatId), retryAfter * 1000);
            last429Time = now + (retryAfter * 1000);
        }
    }
};

// export const sendContactTelegram = (phoneNumber, chatId) => {
//     const firstName = "Contacto";

//     bot.sendContact(chatId, phoneNumber, firstName, {
//         vcard: `BEGIN:VCARD
//                 VERSION:3.0
//                 FN:${firstName}
//                 TEL;TYPE=CELL:${phoneNumber}
//                 END:VCARD`
//     });

//     setTimeout(() => {
//         const whatsappLink = `https://api.whatsapp.com/send/?phone=${phoneNumber}`;
//         const messageText = `Hablar por whatsapp: [Contactar](${whatsappLink})`;

//         bot.sendMessage(chatId, messageText, { parse_mode: 'Markdown' }).catch((error) => {
//             console.error('Error al enviar el enlace de WhatsApp:', error);
//         });
//     }, 2000); 
// };


export { bot };