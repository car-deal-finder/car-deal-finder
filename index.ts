import Parser from './parser';
import AutoRiaCarDataFetcher from './platforms/autoria/AutoRiaCarDataFetcher';
import AutoRiaPriceStatisticFetcher from './platforms/autoria/AutoRiaPriceStatisitcFetcher';
import Notificator from './notificator';
import Logger from './logger/logger';
import { ModelsYearsFetcher } from './ModelsYearsFetcher';
import { AutoRiaBrand } from './db';
import './server';

const notificator = new Notificator();

const run = async () => {
  try {
    const brands = await AutoRiaBrand.find();

    const logger = new Logger();
    const modelsYearsFetcher = new ModelsYearsFetcher();
    const autoRiaPriceStatisticFetcher = new AutoRiaPriceStatisticFetcher();
    const autoRiaCarDataFetcher = new AutoRiaCarDataFetcher(modelsYearsFetcher, brands);

    const parser = new Parser(autoRiaCarDataFetcher, autoRiaPriceStatisticFetcher, notificator, logger);

    notificator.onDataRequested(async (chatId: string, pageLinkMsg: string) => {
      try {
        await parser.analyzePageLink(chatId, pageLinkMsg)
      } catch (e) {
        console.log(e);
        notificator.notifyServiceBot(e.toString());
      }
    });

    await notificator.notifyServiceBot('Started!');

    await parser.launch();
  } catch(e) {
    console.log(e);

    notificator.notifyServiceBot(e.toString());

    throw e;
  }
}

(async() => {
  while(true) {
    try {
      await run();
      await new Promise((res) => {
        setTimeout(() => {res(``)}, 15000)
      })
    } catch (e) {
      console.log(e);
    }
  }
})()
