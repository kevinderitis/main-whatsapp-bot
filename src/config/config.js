import dotenv from 'dotenv';
dotenv.config();

const config = {
    APP_DOMAIN: process.env.APP_DOMAIN,
    PORT: process.env.PORT,
    MONGO_URL: process.env.MONGO_URL,
    SLACK_CHANNEL: process.env.SLACK_CHANNEL,
    FB_PIXEL_ID: process.env.FB_PIXEL_ID,
    FB_ACCESS_TOKEN: process.env.FB_ACCESS_TOKEN,
    API_KEY_TELEGRAM: process.env.API_KEY_TELEGRAM,
    DELIVERY_LEADS_URL: process.env.DELIVERY_LEADS_URL,
    WHATSAPP_API_URL: process.env.WHATSAPP_API_URL,
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
    API_KEY_TELEGRAM_SENDER_1: process.env.API_KEY_TELEGRAM_SENDER_1,
    API_KEY_TELEGRAM_SENDER_2: process.env.API_KEY_TELEGRAM_SENDER_2

};

export default config;
