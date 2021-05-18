import { throttle } from "lodash";
import { Page } from "puppeteer";
import Notificator from "../../notificator";
import { TRANSMISSION_TYPE } from "../../parser/constants";
import { CarData, PriceStatisticFetcher } from "../../parser/types";
import { AUTORIA_FUEL_TYPE, AUTORIA_TRANSMISSION_TYPE } from "./constants";
import { PriceStatistic } from "./types";

const ticketSelector = '#searchResults .ticket-item:not(.hide)';

export default class AutoRiaPriceStatisticFetcher extends PriceStatisticFetcher {
    async selectCheckbox(value: string, namesMap: object, blockSelector: string) {
        const autoriaName = namesMap[value];

        const labels = await this.page.$$(`${blockSelector} .item-checkbox label`);

        const result = [];

        for (let i = 0; i < labels.length; i++) {
            const elem = labels[i];
            const text = await elem.evaluate(node => node.textContent.trim());
            if (text.includes(autoriaName)) {
                try {
                    const parent = (await elem.$x('..'))[0];

                    const string = await parent.$eval('input', (elem) => `${elem.getAttribute('name')}=${elem.getAttribute('value')}`);

                    result.push(string);
                } catch(e) {
                    throw new Error(`Failed to select checkbox. blockSelector: ${blockSelector}, autoriaName: ${autoriaName} page: ${this.page.url()}`)
                }
            }
        }

        return result.join('&');
    }

    selectBrand(brand: string) {
        return `brand.id[0]=${brand.split('_')[1]}`;
    }

    selectModel(model: string) {
        return `model.id[0]=${model.split('_')[1]}`;
    }

    selectYear(year: string) {
        return `year[0].gte=${year}&year[0].lte=${year}`
    }

    async selectTransmission(transmissionType: string) {
        try {
            return this.selectCheckbox(transmissionType, AUTORIA_TRANSMISSION_TYPE, '#gearboxBlock');
        } catch (e) {
            throw new Error(`Failed set transmission "${transmissionType}" for page ${this.page.url}`)
        }
    }

    setEngineCapacity(capacity: number) {
        return `engine.gte=${capacity}&engine.lte=${capacity}`;
    }

    setMileage(mileage: number) {
        return `mileage.gte=${mileage}&mileage.lte${mileage}`;
    }

    selectFuelType(fuelType: string) {
        try {
            return this.selectCheckbox(fuelType, AUTORIA_FUEL_TYPE, '#fuelBlock');
        } catch (e) {
            throw new Error(`Failed set fuel type "${fuelType}" for page ${this.page.url}`)
        }
    }

    async setCriterias(carData: CarData, criteriasToAvoid?: (keyof CarData)[]) {
        await this.page.bringToFront();

        const arr = [];

        arr.push(this.selectBrand(carData.brand));
        arr.push(this.selectModel(carData.model));
        arr.push(this.selectYear(carData.year));
        if (carData.transmissionType && !criteriasToAvoid?.includes('transmissionType')) {
            const transmission = await this.selectTransmission(carData.transmissionType);
            arr.push(transmission);
        }
        if (carData.capacity && !criteriasToAvoid?.includes('capacity')) {
            arr.push(this.setEngineCapacity(carData.capacity));
        }
        if (carData.mileage && !criteriasToAvoid?.includes('mileage')) {
            arr.push(this.setMileage(carData.mileage));
        }
        if (carData.fuelType && !criteriasToAvoid?.includes('fuelType')) {
            const fuelType = await this.selectFuelType(carData.fuelType);
            arr.push(fuelType);
        }

        const url = 'https://auto.ria.com/uk/search/?' + arr.join('&') + '&indexName=auto,order_auto,newauto_search&categories.main.id=1&country.import.usa.not=-1&price.currency=1&sort[0].order=price.asc&abroad.not=0&custom.not=1&page=0&size=100';
        await this.page.goto(url);

        return (await this.page.$$(ticketSelector)).length;

    }

    async getPrices(carLink: string) {
        let tickets;
        try {
            await this.page.waitForSelector(ticketSelector);
            tickets = await this.page.$$(ticketSelector);
        } catch(e) {
            throw new Error(`Failed to get results on page ${this.page.url()} for car ${carLink}`)
        }

        const result: number[] = [];

        for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i];
            let url;
            try {
                url = await ticket.$eval('.address', node => node.getAttribute('href'));
            } catch (e) {
                throw new Error(`Failed get link for item with index "${i}" on page ${this.page.url}`)
            }

            if (url === carLink) continue;
            let price 
            try {
                price = await ticket.$eval('.price-ticket > span:not(.hide) .green[data-currency]', node => parseFloat(node.textContent.trim().replace(/\s/g, '')));
            } catch (e) {
                throw new Error(`Failed get price for item with index "${i}" on page ${this.page.url}`)
            }
            if (isNaN(price)) continue;

            result.push(price);
        }

        return result;
    }

    getPriceType(price: number, prices: number[]) : PriceStatistic['priceType'] {
        const itemsInSegment = prices.length === 1 ? 0 : Math.ceil(prices.length / 3);

        const topOfFirstSegment = prices[itemsInSegment];

        if (price < prices[0]) return 'lowest';
        else if (price <= topOfFirstSegment) return 'low'
        return 'high';
    }

    async process(carData: CarData) {        
        let resultAmount = await this.setCriterias(carData);
        if (resultAmount < 5) resultAmount = await this.setCriterias(carData, ['mileage']);
        if (resultAmount < 5) resultAmount = await this.setCriterias(carData, ['capacity']);
        if (resultAmount < 5) resultAmount = await this.setCriterias(carData, ['fuelType']);
        if (resultAmount < 5) resultAmount = await this.setCriterias(carData, ['mileage', 'capacity']);
        if (resultAmount < 5) resultAmount = await this.setCriterias(carData, ['mileage', 'fuelType']);
        if (resultAmount < 5) resultAmount = await this.setCriterias(carData, ['mileage', 'fuelType', 'fuelType']);
        if (resultAmount < 5) resultAmount = await this.setCriterias(carData, ['mileage', 'fuelType', 'fuelType', 'transmissionType']);

        const prices = await this.getPrices(carData.link);
        const priceType = this.getPriceType(carData.price, prices);

        return {
            pageLink: this.page.url(),
            prices,
            priceType,
            carData: {
                ...carData,
                brand: `#${carData.brand.split('_')[0]}`,
                model: `${carData.model.split('_')[0]}`
            },
        };
    }
}