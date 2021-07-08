import moment from 'moment';
import { ElementHandle } from 'puppeteer';
import helpers from '../helpers';
import Logger from '../logger/logger';
import Notificator from '../notificator';
import { PriceStatistic } from '../platforms/autoria/types';
import { CarData, CarDataFetcher, PageManipulator, PriceStatisticFetcher } from './types';

export default class Parser {
  constructor(
    private carDataFetcher: CarDataFetcher,
    private priceStatisticFetcher: PriceStatisticFetcher,
    private notificator: Notificator,
    private logger: Logger
  ) {}

  async checkLogs(link, result?: PriceStatistic['priceType']) {
    const log = await this.logger.getLogByLink(link);

    if (!log) return true;

    const timeDeltaH = moment.duration(moment(new Date()).diff(moment(log.processedAt))).asHours();

    if (
      log.success ||
      parseInt(log.retriesAmount) >= 1 ||
      timeDeltaH < 1 ||
      (result && result === log.result)
    ) return false;

    return true;
  }

  async getCarData(elem: ElementHandle<Element>) {
    let link;
    try {
      link = await elem.$eval('.ticket-title a', (node) => node.getAttribute('href'));

      const checkLogsResult = await this.checkLogs(link);

      if (!checkLogsResult) return null;

      const carData = await this.carDataFetcher.getDataFromCardElem(elem);

      return carData || null;
    } catch(e) { 
      if (link) this.logger.logData(link, false);
      throw e;
    }
  }

  async analyzeCarData(carData: CarData) {
    try {
      const data = await this.priceStatisticFetcher.process(carData);

      this.logger.logData(carData.link, true, data.priceType);

      return data;
    } catch(e) {
      if (carData && carData.link) this.logger.logData(carData.link, false);
      throw e;
    }
  }

  async getFullCarData(carLink: string): Promise<CarData> {
    const { page, browser } = await PageManipulator.createPage();
    await page.goto(carLink, { waitUntil: 'domcontentloaded' });

    let carData;
    
    try {
      carData = await this.carDataFetcher.getDataFromCarPage(page);
    } finally {
      await browser.close();
    }

    if (!carData) throw new Error(`Failed to get car data for ${carLink}`)

    return carData;
  }

  async analyzePageLink(chatId: string, pageLink: string) {
    const carData = await this.getFullCarData(pageLink);

    const data = await this.priceStatisticFetcher.process(carData);
    
    this.notificator.notifyBot(chatId, this.createMessage(data));
  }

  translateFuelType(fuelType: string) {
    if (fuelType === 'petrol') return 'бензин'
    if (fuelType === 'diesel') return 'дизель'
    if (fuelType === 'electro') return 'электро'
    if (fuelType === 'hybrid') return 'гибрид'
    return fuelType;
  }
  translateTransmissionType(transmissionType: string) {
    if (transmissionType === 'manual') return 'механика'
    if (transmissionType === 'automatic') return 'автомат'
    return transmissionType;
  }

  createMessage(data: PriceStatistic) {
    return `
${data.priceType === 'lowest' ? '#СамаяНизкаяЦена! ' : ''}${data.priceType === 'low' ? '#НизкаяЦена ' : ''}${data.priceType === 'high' ? '#ВысокаяЦена ' : ''}
#${data.carData.location.join(' #')}
#${data.carData.brand} #${data.carData.model} ${data.carData.year}г. 
${data.carData.mileage ? `Пробег: ${data.carData.mileage} км.` : ''}
Года выпуска: ${data.carData.modelYears.length ? data.carData.modelYears.map(years => years.map(o => `${o}г.`).join(' - ')).join(', ') : '?'}
${data.carData.capacity ? data.carData.capacity.toFixed(1) : ''} ${data.carData.fuelType ? this.translateFuelType(data.carData.fuelType) : ''}
${data.carData.transmissionType ? this.translateTransmissionType(data.carData.transmissionType) : ''}
Цена: ${data.carData.price}$
Другие цены в Украине: ${data.prices.map(o => `${o}$`).join(', ')}
Ссылка на объявление: ${data.carData.link}
Сравнить цены в Украине: ${data.pageLink}
`;
  }

  async launch() {
    const url = `https://auto.ria.com/uk/search/?indexName=auto,order_auto,newauto_search&categories.main.id=1&country.import.usa.not=-1&price.currency=1&sort[0].order=dates.created.desc&top=1&abroad.not=0&custom.not=1&page=0&size=100`;

    const { page, browser } = await PageManipulator.createPage();

    await helpers.retry(() => page.goto(url, { waitUntil: 'domcontentloaded' }));

    try {
      await page.click('.c-notifier-start [for="c-notifier-close"]');
    } catch(e) {}

    const items = await page.$$('.ticket-item:not(.new__ticket)');

    const carsData = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const data = await this.getCarData(items[i]);
        if (data) carsData.push(data);
      } catch(e) {
        console.log(e);
        this.notificator.notifyServiceBot(e.toString());
      }
    }

    await browser.close();

    for (let i = 0; i < carsData.length; i++) {
      const priceStatistic = await this.analyzeCarData(carsData[i]);

      if (!priceStatistic) continue;

      const checkLog = await this.checkLogs(priceStatistic.carData.link, priceStatistic.priceType);

      if (!checkLog) continue;

      if (priceStatistic.priceType === 'low' || priceStatistic.priceType === 'lowest') {
        let fullCarData;

        try {
          fullCarData = await this.getFullCarData(priceStatistic.carData.link);
        } catch(e) {
          console.log(e);
        }

        const data: PriceStatistic = {
          ...priceStatistic,
          carData: {
            ...priceStatistic.carData,
            location: fullCarData.location,
          },
        }

        this.notificator.notifyChannel(this.createMessage(data))
        this.notificator.notifyServiceBot(`Price is ${data.priceType === 'lowest' ? '#lowest ' : ''}#low ${JSON.stringify(data)}`)
        console.log(`Price is ${data.priceType === 'lowest' ? '#lowest ' : ''}#low ${JSON.stringify(data)}`)
      } else {
        this.notificator.notifyServiceBot(`Price is too #high ${JSON.stringify(priceStatistic)}`)
        console.log(`Price is too #high ${JSON.stringify(priceStatistic)}`)
      }
    }
  }
}

