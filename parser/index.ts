import moment from 'moment';
import { Page, ElementHandle } from 'puppeteer';
import helpers from '../helpers';
import Logger from '../logger/logger';
import Notificator from '../notificator';
import { CarDataFetcher, PriceStatisticFetcher } from './types';

export default class Parser {
  constructor(
    private carDataFetcher: CarDataFetcher,
    private priceStatisticFetcher: PriceStatisticFetcher,
    private page: Page,
    private notificator: Notificator,
    private logger: Logger
  ) {}

  async checkLogs(link) {
    const log = await this.logger.getLogByLink(link);

    if (!log) return true;

    const timeDeltaH = moment.duration(moment(new Date()).diff(moment(log.link))).asHours();

    if (timeDeltaH > 12) return true;

    if (log.success || log.retriesAmount >= 1) return false;

    return true;
  }

  async processItem(elem: ElementHandle<Element>) {
    let link;
    try {
      link = await elem.$eval('.ticket-title a', (node) => node.getAttribute('href'));

      const checkLogsResult = await this.checkLogs(link);

      if (!checkLogsResult) return null;

      const carData = await this.carDataFetcher.process(elem);

      if (!carData) return null;

      const data = await this.priceStatisticFetcher.process(carData);

      if (link) this.logger.logData(link, true);

      return data;
    } catch(e) {
      if (link) this.logger.logData(link, false);

      console.log(e);

      this.notificator.notify(e.toString());

      throw e;
    }
  }

  async launch() {
    const url = `https://auto.ria.com/uk/search/?indexName=auto,order_auto,newauto_search&categories.main.id=1&country.import.usa.not=-1&region.id[0]=10&price.USD.lte=20000&price.currency=1&sort[0].order=dates.created.desc&top=1&abroad.not=0&custom.not=1&page=0&size=100`;

    await this.page.bringToFront();
    await helpers.retry(() => this.page.goto(url));

    try {
      await this.page.click('.c-notifier-start [for="c-notifier-close"]');
    } catch(e) {}

    // await helpers.waitRandomTime({ page });

    const items = await this.page.$$('.ticket-item:not(.paid)');

    for (let i = 0; i < items.length; i++) {
      const data = await this.processItem(items[i]);

      if (!data) continue;

      if (data.isPriceLow) {
        this.notificator.notify(JSON.stringify(data))
        console.log(data)
      };
    }
  }
}

