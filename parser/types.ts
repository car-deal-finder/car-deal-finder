import puppeteer, { ElementHandle, Page } from 'puppeteer';
import Notificator from '../notificator';
import { PriceStatistic } from '../platforms/autoria/types';

export interface CarData {
  brand: string;
  model: string;
  modelIndex?: string;
  year: number;
  price: number;
  fuelType: string;
  capacity: number;
  transmissionType: string;
  mileage: number;
  link: string;
  modelYears: number[][];
  location: string[];
  proSeller?: boolean;
}


export abstract class PageManipulator {
  constructor(
    public page: Page,
  ) {}

  static async createPage () {
    const browser = await puppeteer.launch({
      headless: true,
      // executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: [
        '--lang=ru-RU',
        '--shm-size=3gb',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
      ]
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(60000 * 3);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ru_RU',
    });

    return { page, browser };
  }


  async goToUrl(url: string) {
      const currentUrl = this.page.url();

      if (!currentUrl.includes(url)) {
          await this.page.goto(url);
      }

      await this.page.bringToFront();
  }
}

export abstract class CarDataFetcher {
  static getCorrectNameOfModel(brand: string, model: string) {
    const formattedBrand = brand.toLowerCase();

    if (formattedBrand.includes('mercedes')) {
      if (model.includes('Vito'))
        return `Vito`;
      if (model.includes('Sprinter'))
        return `Sprinter`;
    }

    return model
  }
  static getNameOfExceptionModel(brand: string, model: string) {
    const formattedBrand = brand.toLowerCase();
      if (formattedBrand === 'bmw') {
        if (model.includes('Active Hybrid'))
          return `${model.slice(-1)}-series`
        else
          return isNaN(parseInt(model[0])) ? model : `${model[0]}-series`;
      }
      if (formattedBrand.includes('mercedes')) {
        if (model.split(' ')[0] === 'ML')
          return `M-Class`;
        else
          return `${model.split(' ')[0]}-Class`;
      }
  }
  abstract getDataFromCardElem(elem: ElementHandle<Element>): Promise<CarData>;
  abstract getDataFromCarPage(page: Page): Promise<CarData>;
}

export abstract class PriceStatisticFetcher {
  abstract process(carData: CarData): Promise<PriceStatistic>;
}

export abstract class PlatformMetaDataFetcher {
  abstract getAllBrands(): Promise<string[]>;
  abstract getAllModels(brand: string): Promise<string[]>;
}

export interface FuelType {
  petrol: string;
  diesel: string;
  electro: string;
  hybrid: string;
  gas: string;
}
