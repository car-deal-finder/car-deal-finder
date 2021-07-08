import { Page } from "puppeteer";
import { CarData, PageManipulator, PriceStatisticFetcher } from "../../parser/types";
import { AUTORIA_FUEL_TYPE, AUTORIA_TRANSMISSION_TYPE } from "./constants";
import { PriceStatistic } from "./types";

const ticketSelector = '#searchResults .ticket-item:not(.hide)';

export default class AutoRiaPriceStatisticFetcher extends PriceStatisticFetcher {
    constructor() {
        super();
    }

    isFuelImportant(brand: string, model: string) {
        const formattedBrand = brand.toLocaleLowerCase().split('_')[0];
        const formattedModel = model.toLocaleLowerCase().split('_')[0];
        return formattedBrand === 'bmw' ||
        formattedBrand.includes('audi') ||
        formattedBrand.includes('mercedes') ||
        formattedBrand.includes('rover') ||
        formattedBrand.includes('lexus')
    }
    isCapacityImportant(brand: string, model: string) {
        const formattedBrand = brand.toLocaleLowerCase().split('_')[0];
        const formattedModel = model.toLocaleLowerCase().split('_')[0];
        return (formattedBrand === 'bmw' && formattedModel[0] === 'x') ||
        formattedBrand === 'dodge' ||
        formattedBrand === 'mini' ||
        formattedModel.includes('cherokee') ||
        formattedModel.includes('mustang') ||
        formattedModel.includes('camaro')
    }

    async selectCheckbox(page: Page, value: string, namesMap: object, blockSelector: string) {
        const autoriaName = namesMap[value];

        await page.waitForSelector(`${blockSelector} .item-checkbox label`);
        const labels = await page.$$(`${blockSelector} .item-checkbox label`);

        const result = [];

        for (let i = 0; i < labels.length; i++) {
            const elem = labels[i];
            const text = await elem.evaluate(node => node.textContent.trim());
            if (text.includes(autoriaName)) {
                try {
                    const parent = (await elem.$x('..'))[0];

                    const string = await parent.$eval('input', (elem) => `${elem.getAttribute('name')}=${elem.getAttribute('value')}`);
                    console.log('string', string)
                    result.push(string);
                } catch(e) {
                    throw new Error(`Failed to select checkbox. blockSelector: ${blockSelector}, autoriaName: ${autoriaName} page: ${page.url()}`)
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

    async selectYear(range: number[], year: number) {
        let from, to;
        if (range[1] - range[0] < 3) from = range[0], to = range[0]
        else {
            from = range[0] + 1;

            if (year <= from) to = from;
            else if (year === range[1]) to = range[1] - 1;
            else to = year;
        }

        return `year[0].gte=${from}&year[0].lte=${to}`
    }

    async selectTransmission(page: Page, transmissionType: string) {
        try {
            return this.selectCheckbox(page, transmissionType, AUTORIA_TRANSMISSION_TYPE, '#gearboxBlock');
        } catch (e) {
            throw new Error(`Failed set transmission "${transmissionType}" for page ${page.url}`)
        }
    }

    setEngineCapacity(capacity: number) {
        return `engine.gte=${capacity}&engine.lte=${capacity}`;
    }

    setMileage(mileage: number) {
        let percentage = 15;

        const valToAdd = mileage * (percentage / 100);

        let fromVal = mileage - valToAdd;
        let toVal = mileage + valToAdd;

        if (mileage > 200000) {
            fromVal = 180000;
            toVal = 500000;
        }

        return `mileage.lte=${toVal / 1000}`;
    }

    selectFuelType(page: Page, fuelType: string) {
        try {
            return this.selectCheckbox(page, fuelType, AUTORIA_FUEL_TYPE, '#fuelBlock');
        } catch (e) {
            throw new Error(`Failed set fuel type "${fuelType}" for page ${page.url}`)
        }
    }

    async getPrices(page: Page, carLink: string) {
        let tickets = []

        tickets = await page.$$(ticketSelector);

        const result: number[] = [];

        for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i];
            let url;
            try {
                url = await ticket.$eval('.address', node => node.getAttribute('href'));
            } catch (e) {
                throw new Error(`Failed get link for item with index "${i}" on page ${page.url}`)
            }

            if (url === carLink) continue;
            let price 
            try {
                price = await ticket.$eval('.price-ticket > span:not(.hide) .green[data-currency]', node => parseFloat(node.textContent.trim().replace(/\s/g, '')));
            } catch (e) {
                console.log(`Failed get price for item with index "${i}" on page ${page.url()}`);
                continue;
            }
            
            if (isNaN(price)) continue;

            result.push(price);
        }

        return result;
    }

    async setCriterias(page: Page, carData: CarData, criteriasToAvoid?: (keyof CarData)[]) {
        const arr = [];

        await page.goto('https://auto.ria.com/uk/search/?', { waitUntil: 'domcontentloaded' });

        let modelYears: number[];

        if (carData.modelYears.length) {
            modelYears = [carData.modelYears[0][0], carData.modelYears[0][1]]
        } else {
            modelYears = [carData.year, new Date().getFullYear()]
        }

        const [yearFrom, yearTo] = (await this.selectYear(modelYears, carData.year)).split('&');

        arr.push(this.selectBrand(carData.brand));
        arr.push(this.selectModel(carData.model));
        arr.push(yearFrom);
        if (carData.transmissionType && !criteriasToAvoid?.includes('transmissionType')) {
            const transmission = await this.selectTransmission(page, carData.transmissionType);
            arr.push(transmission);
        }
        if (
            carData.capacity &&
            !criteriasToAvoid?.includes('capacity') &&
            this.isCapacityImportant(carData.brand, carData.model)
        ) {
            arr.push(this.setEngineCapacity(carData.capacity));
        }
        if (carData.mileage && !criteriasToAvoid?.includes('mileage')) {
            arr.push(this.setMileage(carData.mileage));
        }
        if (
            carData.fuelType &&
            !criteriasToAvoid?.includes('fuelType') &&
            this.isFuelImportant(carData.brand, carData.model)
        ) {
            const fuelType = await this.selectFuelType(page, carData.fuelType);
            console.log('fuelType', fuelType)
            arr.push(fuelType);
        }

        const params = arr.join('&') + '&indexName=auto,order_auto,newauto_search&categories.main.id=1&country.import.usa.not=-1&price.currency=1&sort[0].order=price.asc&abroad.not=0&custom.not=1&page=0&size=100';

        const url = 'https://auto.ria.com/uk/search/?' + params;
        await page.goto(url + '&' + yearTo, { waitUntil: 'domcontentloaded' });

        try {
            const pricesWithYearLimit = await this.getPrices(page, carData.link);

            if (!pricesWithYearLimit.length) throw new Error('No prices with year limit');

            const maxPrice = pricesWithYearLimit[pricesWithYearLimit.length - 1];
    
            await page.goto(url);
    
            const prices = await this.getPrices(page, carData.link);

            if (!prices.length) throw new Error('No prices');
    
            return prices.filter(price => price <= maxPrice);
        } catch (e) {
            console.log(e)
            console.log(`Failed to get results on page ${page.url()} for car ${JSON.stringify(carData)}`);

            return [];
        }
    }

    getPriceType(price: number, prices: number[]) : PriceStatistic['priceType'] {
        if (prices.length === 0) return 'lowest';

        if (price < prices[0]) return 'lowest';

        const itemsInSegment = prices.length === 1 ? 0 : Math.ceil(prices.length / 5);

        const topOfFirstSegment = prices[itemsInSegment];

        if (prices.length > 3) {
            const indexToStartSlice = prices.findIndex((priceItem, index) => {
               const arrToCompare = prices.slice(index, Math.min(index + 3, prices.length));

               const filteredArrToCompare = arrToCompare.filter((currVal, i) => {
                    const nextVal = arrToCompare[i + 1];

                    if (!nextVal) return true;

                    return nextVal - currVal <= currVal * 0.1;
               });

               return arrToCompare.length === filteredArrToCompare.length;
            });
            
            const slicedPrices = prices.slice(indexToStartSlice);

            if (!slicedPrices.length) price < topOfFirstSegment ? 'low' : 'high';

            const limitPrice = slicedPrices[Math.min(2, slicedPrices.length - 1)];

            return price <= limitPrice ? 'low' : 'high';
        }
        return price < topOfFirstSegment ? 'low' : 'high';;
    }

    async process(carData: CarData) {
        const { page, browser } = await PageManipulator.createPage();

        try {
            let prices = await this.setCriterias(page, carData);
            if (prices.length < 5) prices = (await this.setCriterias(page, carData, ['mileage']));
            if (prices.length < 5) prices = await this.setCriterias(page, carData, ['capacity']);
            if (prices.length < 5) prices = await this.setCriterias(page, carData, ['fuelType']);
            if (prices.length < 5) prices = await this.setCriterias(page, carData, ['mileage', 'capacity']);
            if (prices.length < 5) prices = await this.setCriterias(page, carData, ['mileage', 'fuelType']);
            if (prices.length < 5) prices = await this.setCriterias(page, carData, ['mileage', 'fuelType', 'fuelType']);
            if (prices.length < 5) prices = await this.setCriterias(page, carData, ['mileage', 'fuelType', 'fuelType', 'capacity']);
            if (prices.length < 5) prices = await this.setCriterias(page, carData, ['mileage', 'fuelType', 'fuelType', 'transmissionType', 'capacity']);
            if (prices.length < 5) prices = await this.setCriterias(page, carData, ['mileage', 'fuelType', 'fuelType', 'transmissionType', 'capacity', 'year']);

            const priceType = this.getPriceType(carData.price, prices);

            return {
                pageLink: page.url(),
                prices,
                priceType,
                carData: {
                    ...carData,
                    brand: `${carData.brand.split('_')[0]}`,
                    model: `${carData.model.split('_')[0]}`
                },
            };
        } finally {
            await page.waitForTimeout(5000);
            await browser.close();
        }
    }
}