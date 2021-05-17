import puppeteer, { Page, ElementHandle, Browser } from 'puppeteer';
import Parser from './parser';
import AutoRiaCarDataFetcher from './platforms/autoria/AutoRiaCarDataFetcher';
import AutoRiaPlatformDataFetcher from './platforms/autoria/AutoRiaPlatformMetaDataFetcher';
import AutoRiaPriceStatisticFetcher from './platforms/autoria/AutoRiaPriceStatisitcFetcher';
import Notificator from './notificator';
import Logger from './logger/logger';

const createPage = async (browser: Browser) => {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000 * 2);
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ru_RU',
  });

  return page;
}

const notificator = new Notificator();
const logger = new Logger();

const run = async (browser: Browser) => {
  const page = await createPage(browser);
  const page2 = await createPage(browser);
  const page3 = await createPage(browser);

  const autoRiaPlatformDataFetcher = new AutoRiaPlatformDataFetcher(page2);
  const autoRiaPriceStatisticFetcher = new AutoRiaPriceStatisticFetcher(page3);
  const autoRiaCarDataFetcher = new AutoRiaCarDataFetcher(autoRiaPlatformDataFetcher, page);
  const parser = new Parser(autoRiaCarDataFetcher, autoRiaPriceStatisticFetcher, page, notificator, logger);

  await parser.launch();
  console.log('==================COLSE2!')
  await browser.close();
}

const process = async () => {
  const browser = await puppeteer.launch({ headless: false, args: [
    '--lang=ru-RU',
    '--shm-size=3gb',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-web-security',
  ] });

  try {
    await run(browser);
  } catch (e) {
    console.log(e);
    notificator.notify(e.toString());
    console.log('==================COLSE!')
    await browser.close();
    await process();
  }
};

process();




