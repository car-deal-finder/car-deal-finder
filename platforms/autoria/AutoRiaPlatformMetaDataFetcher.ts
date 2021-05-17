import { Page } from "puppeteer";
import { PlatformMetaDataFetcher } from "../../parser/types";

export default class AutoRiaPlatformDataFetcher extends PlatformMetaDataFetcher {
    async getAllBrands() {
        try {
            await this.goToUrl('https://auto.ria.com/');
            
            return await this.page.$$eval('#brandTooltipBrandAutocomplete-brand ul li', (nodes) => nodes.map(o => o.textContent.trim()));
        } catch(e) {
            throw new Error('Failed to get all brands');
        }
    }

    async getAllModels(brand: string) {
        try {
            await this.goToUrl('https://auto.ria.com/');

            const block = await this.page.$('#brandTooltipBrandAutocomplete-brand');

            await block.click();

            await this.page.waitForTimeout(5000);

            await block.type(brand, { delay: 100 });

            const nodes = await this.page.$$('#brandTooltipBrandAutocomplete-brand ul li');

            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                const elemBrand = await node.evaluate((elem) => elem.textContent.trim());
                
                if (elemBrand === brand) {
                    await node.click();

                    await this.page.waitForSelector('#brandTooltipBrandAutocomplete-model ul li a')
                    
                    break;
                }
            }

            const result = await this.page.$$eval(
                '#brandTooltipBrandAutocomplete-model ul li',
                (nodes) => nodes.map(o => o.textContent.trim())
            )

            await this.page.click('#brandTooltipBrandAutocomplete-brand .ac-clean');
            await this.page.waitForSelector('#brandTooltipBrandAutocomplete-model ul li a', { hidden: true });
            return result;
        } catch(e) {
            throw new Error('Failed to get all models');
        }
    }
}