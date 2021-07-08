import { ElementHandle, Page } from "puppeteer";
import _ from "lodash";
import { CarDataFetcher, PageManipulator } from "../../parser/types";
import { AUTORIA_FUEL_TYPE, AUTORIA_TRANSMISSION_TYPE } from "./constants";
import { TRANSMISSION_TYPE } from "../../parser/constants";
import { ModelsYearsFetcher } from "../../ModelsYearsFetcher";
import { Brand } from "./types";

export default class AutoRiaCarDataFetcher extends CarDataFetcher {
    constructor (
        private modelsYearsFetcher: ModelsYearsFetcher,
        private allBrands: Brand[],
    ) {
        super();
    }

    async parseTitle(title: string) {
        const year = parseInt(title.split(' ').reverse()[0]);

        const brandAndModel = title.substring(0, title.length - 4);

        const brand = this.allBrands.find(o => brandAndModel.includes(o.name.split('_')[0]));

        if (!brand) throw new Error(`There is no such brand ${title} in db`)

        const models = brand.models.filter(o => brandAndModel.includes(o.name.split('_')[0]));

        if (!models.length) throw new Error(`There is no such model ${title} in db`)

        const model = _.sortBy(models, 'name.length')[models.length - 1];

        return {
            year,
            brand: brand.name,
            model: model.name,
            modelYears: model.years.length ? this.modelsYearsFetcher.getYearRange(year, model.years) : model.years,
        };
    }

    parseEngine(engine: string, parseFromCarPage: boolean = false) {
        const fuelType = Object.keys(AUTORIA_FUEL_TYPE).find(key => engine.includes(AUTORIA_FUEL_TYPE[key]));

        const splittedString = engine.split(parseFromCarPage ? '•' : ',');
        
        if (splittedString.length < 2) return null;

        const capacity = parseFloat(splittedString[parseFromCarPage ? 0 : 1].trim());

        return { fuelType, capacity };
    }

    async getTransmission(elem: ElementHandle<Element>) {
        try {
            const manualTransmission = await elem.$('.icon-transmission');

            if (manualTransmission) return TRANSMISSION_TYPE.manual;

            const transmission = await elem.$eval('.icon-akp', (node) => node.parentElement.textContent.trim());
            
            return transmission.includes(AUTORIA_TRANSMISSION_TYPE.unknown) ? null : TRANSMISSION_TYPE.automatic;
        } catch (e) {
            throw new Error('Failed to get transmission');
        }
    }
  
    async getDataFromCardElem(elem: ElementHandle<Element>) {
        let title: string, link: string, price: number, engine: string, mileage: number;

        try {
            price = await elem.$eval('.price-ticket .green', (node) => parseFloat(node.textContent.trim().replace(/\s/g, '')));
        } catch(e) {
            throw new Error('Failed to get price')
        }
        if (isNaN(price)) return null;
        try {
            title = await elem.$eval('.ticket-title', (node) => node.textContent.trim());
        } catch(e) {
            throw new Error('Failed to get title')
        }
        try {
            link = await elem.$eval('.ticket-title a', (node) => node.getAttribute('href'));
        } catch(e) {
            throw new Error('Failed to get link')
        }
        try {
            engine = await elem.$eval('[title="Тип палива"]', (node) => node.parentElement.textContent.trim());
        } catch(e) {
            throw new Error('Failed to get engine')
        }
        try {
            mileage = await elem.$eval('.icon-mileage', (node) => parseFloat(node.parentElement.textContent.trim()) * 1000);
        } catch(e) {
            throw new Error('Failed to get mileage')
        }
        const titleData = await this.parseTitle(title);
        const transmissionType = await this.getTransmission(elem);
        const engineData = this.parseEngine(engine);

        const carData = {
            ...titleData,
            ...engineData,
            transmissionType,
            price,
            mileage,
            link,
            location: [],
        };

        if (titleData.modelYears.length > 1) {
            console.log(`Border range for ${JSON.stringify(carData)}`);
        }

        return carData;
    }

    async getDataFromCarPage(page: Page) {
        let title: string, link: string, price: number, engine: string, mileage: number, transmissionType: string | null, location: string[];

        try {
            title = await page.$eval('h1.head', (node) => node.textContent.trim());
        } catch(e) {
            console.log(e);
            throw new Error('Failed to get title')
        }
        try {
            let priceText = await page.$eval('.price_value', (node) => node.textContent.trim());
            
            if (!priceText.includes('$')) 
                priceText = await page.$eval('section.price span[data-currency="USD"]', (node) => node.textContent.trim());
            
            price = parseFloat(priceText.replace(/\s/g, ''))
        } catch(e) {
            console.log(e);
            throw new Error('Failed to get price')
        }
        try {
            const [elem] = await page.$x(`//dd[contains(., 'Двигун')]/span[contains(@class, 'argument')]`);

            engine = elem ? await elem.evaluate(node => node.textContent.trim()) : null;
        } catch(e) {
            console.log(e);
            throw new Error('Failed to get engine')
        }
        try {
            const [elem] = await page.$x(`//dd[contains(., 'Пробіг')]/span[contains(@class, 'argument')]`);

            mileage = elem ? await elem.evaluate(node => parseFloat(node.textContent.trim()) * 1000) : null;
        } catch(e) {
            console.log(e);
            throw new Error('Failed to get mileage')
        }
        try {
            const [elem] = await page.$x(`//dd[contains(., 'Коробка передач')]/span[contains(@class, 'argument')]`);

            if (elem) {
                const transmission = await elem.evaluate(node => node.textContent.trim());

                if (transmission.includes(AUTORIA_TRANSMISSION_TYPE.unknown)) transmissionType = null;
                else if (transmission.includes(AUTORIA_TRANSMISSION_TYPE.manual)) transmissionType = TRANSMISSION_TYPE.manual;
                else transmissionType = TRANSMISSION_TYPE.automatic;
            } else transmissionType = null;
        } catch(e) {
            console.log(e);
            throw new Error('Failed to get transmission')
        }
        try {
            const locationString = await page.$eval('#userInfoBlock ul li', (node) => node.textContent.trim());
            location = locationString.split('•').map(o => o.trim());
        } catch(e) {
            console.log(e);
            throw new Error('Failed to get location')
        }

        const titleData = await this.parseTitle(title);
        const engineData = this.parseEngine(engine, true);

        const carData = {
            ...titleData,
            ...engineData,
            transmissionType,
            price,
            mileage,
            link: page.url(),
            location,
        };

        if (titleData.modelYears.length > 1) {
            console.log(`Border range for ${JSON.stringify(carData)}`);
        }

        return carData;
    }
  }
  