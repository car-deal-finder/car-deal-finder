import { ElementHandle, Page } from "puppeteer";
import _ from "lodash";
import AutoRiaPlatformDataFetcher from "./AutoRiaPlatformMetaDataFetcher";
import { CarDataFetcher } from "../../parser/types";
import { AUTORIA_FUEL_TYPE, AUTORIA_TRANSMISSION_TYPE } from "./constants";
import { TRANSMISSION_TYPE } from "../../parser/constants";
import AutoRiaPriceStatisticFetcher from "./AutoRiaPriceStatisitcFetcher";

export default class AutoRiaCarDataFetcher extends CarDataFetcher {
    constructor (
        private autoRiaPlatformDataFetcher: AutoRiaPlatformDataFetcher,
        page: Page,
    ) {
        super(page);
    }
    async parseTitle(title: string) {
        const allBrands = await this.autoRiaPlatformDataFetcher.getAllBrands();

        const brand = allBrands.find(o => title.includes(o.split('_')[0]));
        
        const allModels = await this.autoRiaPlatformDataFetcher.getAllModels(brand.split('_')[0]);

        const models = allModels.filter(o => title.includes(o.split('_')[0]));

        const model = _.sortBy(models, 'length')[models.length - 1];

        const year = title.split(' ').reverse()[0];

        return {
            year,
            brand,
            model,
        }
    }

    parseEngine(engine: string) {
        const fuelType = Object.keys(AUTORIA_FUEL_TYPE).find(key => engine.includes(AUTORIA_FUEL_TYPE[key]));

        const splittedString = engine.split(',');
        
        if (splittedString.length < 2) return null;

        const capacity = parseFloat(splittedString[1].trim());

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
  
    async process(elem: ElementHandle<Element>) {
        await this.page.bringToFront();
        
        let title: string, link: string, price: number, engine: string, mileage: number;

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
            price = await elem.$eval('.price-ticket .green', (node) => parseFloat(node.textContent.trim().replace(/\s/g, '')));
        } catch(e) {
            throw new Error('Failed to get price')
        }
        if (isNaN(price)) return null;
        
        try {
            engine = await elem.$eval('[title="Тип палива"]', (node) => node.parentElement.textContent.trim());
        } catch(e) {
            throw new Error('Failed to get engine')
        }
        try {
            const mileage = await elem.$eval('.icon-mileage', (node) => parseFloat(node.parentElement.textContent.trim()) * 1000);
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
        };

        return carData;
    }
  }
  