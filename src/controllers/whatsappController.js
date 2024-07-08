import { sendContactCard, sendWhatsappMessage, healthCheck } from '../services/whatsappServices.js';
import { getNextClient } from '../services/clientServices.js';
import { getLeadByChatIdService, createLeadService, updateLeadByChatIdService, getLastPendingLeadsService } from '../services/leadServices.js';
import { sendContactTelegram } from '../bot-telegram/telegram-bot.js';

import config from '../config/config.js';

export const verifyWebhook = async (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === config.WHATSAPP_VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
};

export const processMessage = async (req, res) => {
    const body = req.body;
    try {
        if (body.object) {
            body.entry.forEach(entry => {
                entry.changes.forEach(async change => {
                    if (change.field === 'messages') {
                        const message = change.value.messages && change.value.messages[0];
                        const recipientPhoneId = change.value.metadata.phone_number_id;
                        if (message) {
                            console.log(`Numero de telefono: ${message.from}`)
                            console.log(`Mensaje: ${message.text.body}`)

                            await healthCheck(message.text.body);

                            if (message.from) {
                                let chatId = message.from;
                                let lead = await getLeadByChatIdService(chatId)
                                if (!lead) {
                                    let newLead = await createLeadService(chatId);
                                    let clientData = await getNextClient();
                                    let welcomeMessage = clientData.welcomeMessage;
                                    await sendWhatsappMessage(chatId, welcomeMessage, recipientPhoneId);
                                    await sendContactCard(chatId, clientData.phoneNumber, recipientPhoneId);
                                    await updateLeadByChatIdService(chatId, 'sent', clientData.phoneNumber);
                                    if (clientData.telegram) {
                                        await sendContactTelegram(chatId, clientData.telegram);
                                    }
                                    console.log(`Lead ${newLead.chatId} enviado a: ${clientData.phoneNumber}`)
                                }

                            }
                        }
                    }
                });
            });

            res.status(200).send('EVENT_RECEIVED');
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.log(error);
        res.status(500).send(error);
    }

}


export const processPendingMessages = async (req, res) => {
    let phoneId = req.body.phoneId;
    try {

        let lastPendingLeads = await getLastPendingLeadsService();

        for (const lead of lastPendingLeads) {
            let chatId = lead.chatId;
            let clientData = await getNextClient();
            let welcomeMessage = clientData.welcomeMessage;
            await sendWhatsappMessage(chatId, welcomeMessage, phoneId);
            await sendContactCard(chatId, clientData.phoneNumber, phoneId);
            await updateLeadByChatIdService(chatId, 'sent', clientData.phoneNumber);
            if (clientData.telegram) {
                await sendContactTelegram(chatId, clientData.telegram);
            }
            console.log(`Lead ${chatId} enviado a: ${clientData.phoneNumber}`)

        }
        res.status(200).send('EVENTS_SENT');

    } catch (error) {
        console.log(error);
        res.status(500).send(error);
    }

}