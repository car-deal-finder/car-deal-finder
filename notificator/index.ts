import TelegramBot from 'node-telegram-bot-api';

const token = '1818588017:AAE0o3O0Y8jPdCXJifPHZbepyct3WT-Z_Y4';
const chatId = '416295621';

export default class Notificator {
    private bot;

    constructor() {
        this.bot = new TelegramBot(token, {polling: true});
        
        this.bot.on('message', (msg) => {
            console.log('==============chatId', msg.chat.id);
        });
    }
    async notify(data) {
        this.bot.sendMessage(chatId, data);
    }
}