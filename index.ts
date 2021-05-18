import puppeteer, { Page, ElementHandle, Browser } from 'puppeteer';
import Parser from './parser';
import AutoRiaCarDataFetcher from './platforms/autoria/AutoRiaCarDataFetcher';
import AutoRiaPlatformDataFetcher from './platforms/autoria/AutoRiaPlatformMetaDataFetcher';
import AutoRiaPriceStatisticFetcher from './platforms/autoria/AutoRiaPriceStatisitcFetcher';
import Notificator from './notificator';
import Logger from './logger/logger';

const createPage = async () => {
  const browser = await puppeteer.launch({ headless: false, args: [
    '--lang=ru-RU',
    '--shm-size=3gb',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-web-security',
  ] });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000 * 2);
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ru_RU',
  });

  return { page, browser };
}

const notificator = new Notificator();
const logger = new Logger();

const run = async () => {
  const browsers = [];
  try {
    const { page, browser } = await createPage();
    browsers.push(browser);
    const { page: page2, browser: browser2 } = await createPage();
    browsers.push(browser2);
    const { page: page3, browser: browser3 } = await createPage();
    browsers.push(browser3);

    const autoRiaPlatformDataFetcher = new AutoRiaPlatformDataFetcher(page2);
    const autoRiaPriceStatisticFetcher = new AutoRiaPriceStatisticFetcher(page3);
    const autoRiaCarDataFetcher = new AutoRiaCarDataFetcher(autoRiaPlatformDataFetcher, page);
    const parser = new Parser(autoRiaCarDataFetcher, autoRiaPriceStatisticFetcher, page, notificator, logger);

    await parser.launch();
    browser.process().kill('SIGKILL');
  } catch(e) {
    for (let i = 0; i < browsers.length; i++) {
      await browsers[i].process().kill('SIGKILL');
    }
    throw e;
  }
}

(async() => {
  while(true) {
    try {
      await run();
    } catch (e) {
      console.log(e);
      notificator.notify(e.toString());
    }
  }
})()


