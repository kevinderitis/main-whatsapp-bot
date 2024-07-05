import { sendContactCard, sendWhatsappMessage } from '../services/whatsappServices.js';
import { getNextClient } from '../services/clientServices.js';
import { getLeadByChatIdService, createLeadService, updateLeadByChatIdService } from '../services/leadServices.js';

export const verifyWebhook = async (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
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
                        if (message) {
                            console.log('Received message:', message);
                            console.log(`Numero de telefono: ${message.from}`)
                            console.log(`Mensaje: ${message.text.body}`)

                            if (message.from) {
                                let chatId = message.from;
                                let lead = await getLeadByChatIdService(chatId)
                                if (!lead) {
                                    let newLead = await createLeadService(chatId);
                                    let clientData = await getNextClient();
                                    let welcomeMessage = clientData.welcomeMessage;
                                    await sendWhatsappMessage(chatId, welcomeMessage);
                                    await sendContactCard(chatId, clientData.phoneNumber);
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