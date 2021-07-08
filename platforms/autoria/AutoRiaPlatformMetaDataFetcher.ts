import { PageManipulator, PlatformMetaDataFetcher } from "../../parser/types";

export default class AutoRiaPlatformDataFetcher extends PlatformMetaDataFetcher {
    async getAllBrands() {
        const { page, browser } = await PageManipulator.createPage();

        try {
            await page.goto('https://auto.ria.com/', { waitUntil: 'domcontentloaded', timeout: 0 });
            return await page.$$eval(
                '#brandTooltipBrandAutocomplete-brand ul li[data-value]',
                (nodes) => nodes.map(o => `${o.textContent.trim()}_${o.getAttribute('data-value')}`)
            );
        } catch(e) {
            console.log(e);
            throw new Error('Failed to get all brands');
        } finally {
            await browser.close();
        }
    }

    async getAllModels(brand: string) {
        const { page, browser } = await PageManipulator.createPage();

        try {
            await page.goto('https://auto.ria.com/', { waitUntil: 'domcontentloaded', timeout: 0 });

            const block = await page.$('#brandTooltipBrandAutocomplete-brand');

            await block.click();

            await page.waitForTimeout(5000);

            await block.type(brand, { delay: 100 });

            const nodes = await page.$$('#brandTooltipBrandAutocomplete-brand ul li[data-value]');

            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                const elemBrand = await node.evaluate((elem) => elem.textContent.trim());
                
                if (elemBrand === brand) {
                    await node.click();

                    await page.waitForSelector('#brandTooltipBrandAutocomplete-model ul li[data-value] a', { timeout: 30000 })
                    
                    break;
                }
            }

            const result = await page.$$eval(
                '#brandTooltipBrandAutocomplete-model ul li[data-value] a',
                (nodes) => nodes.map(o => `${o.textContent.trim()}_${o.getAttribute('data-value')}`)
            )

            return result;
        } catch(e) {
            console.log(e);
            throw new Error(`Failed to get all models for brand ${brand}`);
        } finally {
            await browser.close();
        }
    }
}