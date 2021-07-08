import TelegramBot from 'node-telegram-bot-api';
import { CarData } from '../parser/types';

const serviceBotToken = '1818588017:AAFTvYIPabjaYi14mqgi5F2IS_Zn37kdW0o';
const botToken = '1849117038:AAFiMLzJ91RI38wJlVgK1gLttlVim3gzDOk';
const serviceBotChatId = '416295621';
const channelChatId = '-1001171392842';

export default class Notificator {
    private serviceBot;
    private bot;
    private dataRequested;

    constructor() {
        this.serviceBot = new TelegramBot(serviceBotToken, {polling: true});
        this.bot = new TelegramBot(botToken, {polling: true});
        
        this.serviceBot.on('message', (msg) => {
            console.log('=======ServiceBot=======chatId', msg.chat.id);
            console.log('=======ServiceBot=======msg', msg.text);
        });
        this.bot.on('message', (msg) => {
            console.log('=======Bot=======chatId', msg.chat.id);
            console.log('=======Bot=======msg', msg.text);

            if (this.dataRequested) this.dataRequested(msg.chat.id, msg.text);
        });
    }
    async notifyChannel(data) {
        this.serviceBot.sendMessage(channelChatId, data);
    }
    async notifyServiceBot(data) {
        this.serviceBot.sendMessage(serviceBotChatId, data);
    }
    async notifyBot(chatId, data) {
        this.bot.sendMessage(chatId, data);
    }
    public onDataRequested(cb) {
        this.dataRequested = cb;
    }
}