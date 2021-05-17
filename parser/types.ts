import { ElementHandle, Page } from 'puppeteer';
import Notificator from '../notificator';
import { PriceStatistic } from '../platforms/autoria/types';

export interface CarData {
  brand: string;
  model: string;
  year: string;
  price: number;
  fuelType: string;
  capacity: number;
  transmissionType: string;
  mileage: number;
  link: string;
}


export abstract class PageManipulator {
  constructor(
    public page: Page,
  ) {}

  async goToUrl(url: string) {
      const currentUrl = this.page.url();

      if (!currentUrl.includes(url)) {
          await this.page.goto(url);
      } 

      await this.page.bringToFront();
  }
}

export abstract class CarDataFetcher extends PageManipulator {
  
  abstract process(elem: ElementHandle<Element>): Promise<CarData>;
}

export abstract class PriceStatisticFetcher extends PageManipulator {
  abstract process(carData: CarData): Promise<PriceStatistic>;
}

export abstract class PlatformMetaDataFetcher extends PageManipulator {
  abstract getAllBrands(): Promise<string[]>;
  abstract getAllModels(brand: string): Promise<string[]>;
}

export type FuelTypeA  = 'a' | 'b';

export interface FuelType {
  petrol: string;
  diesel: string;
  electro: string;
  hybrid: string;
  gas: string;
}