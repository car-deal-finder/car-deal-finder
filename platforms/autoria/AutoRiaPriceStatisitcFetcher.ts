import { Page } from "puppeteer";
import Notificator from "../../notificator";
import { TRANSMISSION_TYPE } from "../../parser/constants";
import { CarData, PriceStatisticFetcher } from "../../parser/types";
import { AUTORIA_FUEL_TYPE, AUTORIA_TRANSMISSION_TYPE } from "./constants";

const ticketSelector = '#searchResults .ticket-item:not(.hide)';

export default class AutoRiaPriceStatisticFetcher extends PriceStatisticFetcher {
    async selectCheckbox(value: string, namesMap: object, blockSelector: string) {
        await this.page.click(`${blockSelector} .el-selected.open`);

        const autoriaTransmissionName = namesMap[value];

        const labels = await this.page.$$(`${blockSelector} .item-checkbox label`);

        for (let i = 0; i < labels.length; i++) {
            const elem = labels[i];

            const text = await elem.evaluate(node => node.textContent.trim());
            if (text.includes(autoriaTransmissionName)) {
                await elem.click();
            }
        }
    }

    async selectBrand(brand: string) {
        const block = await this.page.$('#brandTooltipBrandAutocomplete-0');

        if (!block) throw new Error(`Block not found on page`)

        await block.click();
        await block.type(brand, { delay: 100 });
        await this.page.waitForTimeout(2000);
        const element = await block.$(`ul li[data-text="${brand}"]`);

        if (!element) throw new Error(`Brand ${brand} not found on page`)
        
        await element.click();
    }

    async selectModel(model: string) {
        const block = await this.page.$('#brandTooltipModelAutocomplete-0');

        if (!block) throw new Error(`Block not found on page`)

        await block.click();
        await this.page.waitForTimeout(2000);
        await block.type(model, { delay: 100 });
        await this.page.waitForTimeout(2000);

        const element = await block.$(`ul li[data-text="${model}"]`);

        if (!element) throw new Error(`Model ${model} not found on page`)

        await element.click();
    }

    async selectYear(year: string) {
        await this.page.select('#brandTooltipYearGte_0', year);
        await this.page.select('#brandTooltipYearLte_0', year);
    }

    async selectTransmission(transmissionType: string) {
        try {
            return this.selectCheckbox(transmissionType, AUTORIA_TRANSMISSION_TYPE, '#gearboxBlock');
        } catch (e) {
            throw new Error(`Failed set transmission "${transmissionType}" for page ${this.page.url}`)
        }
    }

    async setEngineCapacity(capacity: number) {
        const inputFrom = await this.page.$('[name="engine.gte"]');
        const inputTo = await this.page.$('[name="engine.lte"]');

        if (!inputFrom || !inputTo) throw new Error('Engine capacity inputs not found')

        await inputFrom.type(capacity.toString(), { delay: 100 });
        await inputTo.type(capacity.toString(), { delay: 100 });
        await inputTo.press('Enter', { delay: 100 });
    }

    async setMileage(mileage: number) {
        const inputFrom = await this.page.$('[name="mileage.gte"]');
        const inputTo = await this.page.$('[name="mileage.lte"]');

        if (!inputFrom || !inputTo) throw new Error('Mileage inputs not found')

        let percentage = 15;

        const valToAdd = mileage * (percentage / 100);

        let fromVal = mileage - valToAdd;
        let toVal = mileage + valToAdd;

        if (mileage > 200000) {
            fromVal = 180000;
            toVal = 500000;
        }

        await inputFrom.type((fromVal / 1000).toString(), { delay: 100 });
        await inputTo.type((toVal / 1000).toString(), { delay: 100 });
        await inputTo.press('Enter', { delay: 100 });
    }

    async selectFuelType(fuelType: string) {
        try {
            return this.selectCheckbox(fuelType, AUTORIA_FUEL_TYPE, '#fuelBlock');
        } catch (e) {
            throw new Error(`Failed set fuel type "${fuelType}" for page ${this.page.url}`)
        }
    }

    async setCriterias(carData: CarData, criteriasToAvoid?: (keyof CarData)[]) {
        await this.page.goto('https://auto.ria.com/uk/search/?indexName=auto,order_auto,newauto_search&categories.main.id=1&country.import.usa.not=-1&price.currency=1&sort[0].order=price.asc&abroad.not=0&custom.not=1&page=0&size=100');
        await this.page.bringToFront();

        const block = await this.page.click('#brandTooltipBrandAutocomplete-0');
        await this.page.waitForTimeout(5000);


        await this.selectBrand(carData.brand);
        await this.selectModel(carData.model);
        await this.selectYear(carData.year);
        if (carData.transmissionType && !criteriasToAvoid?.includes('transmissionType')) await this.selectTransmission(carData.transmissionType);
        if (carData.capacity && !criteriasToAvoid?.includes('capacity')) await this.setEngineCapacity(carData.capacity);
        if (carData.mileage && !criteriasToAvoid?.includes('mileage')) await this.setMileage(carData.mileage);
        if (carData.fuelType && !criteriasToAvoid?.includes('fuelType')) await this.selectFuelType(carData.fuelType);

        await this.page.waitForTimeout(2000);

        this.page.click('#floatingSearchButton');

        await this.page.reload();

        return (await this.page.$$(ticketSelector)).length;

    }

    async getPrices(carLink: string) {
        await this.page.waitForSelector(ticketSelector);
        const tickets = await this.page.$$(ticketSelector);

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

    isPriceLow(price: number, prices: number[]) {
        const itemsInSegment = prices.length === 1 ? 0 : Math.ceil(prices.length / 3);

        const topOfFirstSegment = prices[itemsInSegment];

        return price <= topOfFirstSegment;
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
        const isPriceLow = this.isPriceLow(carData.price, prices);

        return {
            pageLink: this.page.url(),
            prices,
            isPriceLow,
            carData,
        };
    }
}