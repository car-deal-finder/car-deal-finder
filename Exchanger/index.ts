import { Touchscreen } from "puppeteer";
import { AutoRiaBrand } from "../db";
import { ModelsYearsFetcher } from "../ModelsYearsFetcher";
import { CarDataFetcher, PageManipulator } from "../parser/types";
import AutoRiaCarDataFetcher from "../platforms/autoria/AutoRiaCarDataFetcher";

const url = 'https://auto.ria.com/uk/search/?indexName=auto,order_auto,newauto_search&categories.main.id=1&country.import.usa.not=-1&price.currency=1&sort[0].order=dates.created.desc&abroad.not=0&custom.not=1&page=0&size=100';

class Exchanger {
    constructor(
        private carDataFetcher: CarDataFetcher,
    ) {}

    async processItem(link: string) {
        const { page, browser } = await PageManipulator.createPage();
        await page.goto(link);
    
        const data = await this.carDataFetcher.getDataFromCarPage(page);
    }

    async parse() {
        const { page, browser } = await PageManipulator.createPage();
        await page.goto(url);
        const items = await page.$$('.ticket-item:not(.new__ticket)');
        const carsData = [];

        for (let i = 0; i < items.length; i++) {
            try {
                const link = await items[i].$eval('.ticket-title a', (node) => node.getAttribute('href'));
                await this.processItem(link);
            } catch(e) {
              console.log(e);
            }
          }
    }
}

(async () => {
    const brands = await AutoRiaBrand.find();
    const modelsYearsFetcher = new ModelsYearsFetcher();
    const autoRiaCarDataFetcher = new AutoRiaCarDataFetcher(modelsYearsFetcher, brands);
    const exchanger = new Exchanger(autoRiaCarDataFetcher);

    await exchanger.parse();
})()