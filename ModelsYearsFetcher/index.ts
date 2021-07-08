import _ from "lodash";
import { Page } from "puppeteer";
import { PageManipulator } from "../parser/types";

export class ModelsYearsFetcher {
    async selectText(page: Page, selector: string, text: string) {
        const options = await page.$$eval(`${selector} option`, (options, text: string) => {
            return options
            .map(option => ({
                text: option.textContent.toLowerCase().trim(),
                value: option.getAttribute('value')
                })
            );
        }, text);

        let foundOption;

        foundOption = options.find((option) => {
            return (
                option.text === text.toLowerCase() ||
                option.text === text.toLowerCase().replace(/-/g, ' ') ||
                option.text === text.toLowerCase().replace(/ /g, '-') ||
                option.text === text.toLowerCase().replace(/ /g, '')
            );
        });
        console.log('foundOption', foundOption)
        if (!foundOption) {
            foundOption = options.find((option) => {
                return (
                    option.text.includes(text.toLowerCase()) ||
                    option.text.includes(text.toLowerCase().replace(/-/g, ' ')) ||
                    option.text.includes(text.toLowerCase().replace(/ /g, '-')) ||
                    option.text.includes(text.toLowerCase().replace(/ /g, ''))
                );
            });
        }

        if (!foundOption) {
            const foundOptions = options.filter((option) => {
                return (
                    text.toLowerCase().includes(option.text) ||
                    text.toLowerCase().includes(option.text.replace(/-/g, ' ')) ||
                    text.toLowerCase().includes(option.text.replace(/ /g, '-')) ||
                    text.toLowerCase().includes(option.text.replace(/ /g, ''))
                );
            }).sort((a, b) => b.text.length - a.text.length);

            foundOption = foundOptions[0];
        }

        if (!foundOption) throw new Error(`No such text on UI ${text}`);

        return page.select(selector, foundOption.value);
    }

    getYearRange(year: number, yearsOfModel: number[][]) {
        return yearsOfModel.filter(range => year >= range[0] && year <= range[1]);
    }

    async getYearsOfModel(brand:string, model: string, year?: number) {
        try {
            var { browser, page } = await PageManipulator.createPage();
            
            await page.goto('https://api.car2db.com/autobasebuy/auto/index/?base=car2db_eng', { waitUntil: ['domcontentloaded', 'networkidle2']});

            await page.waitForTimeout(3000);

            await page.select('#carType', '1');

            await page.waitForTimeout(1000);

            await this.selectText(page, '#carMake', brand);

            await page.waitForTimeout(1000);

            await this.selectText(page, '#carModel', model);

            await page.waitForTimeout(3000);

            const ranges = await page.$$eval('#carGeneration option', (options, brand, model, year) => {
                if (options.length <= 1) throw new Error(`No ranges on UI for ${brand}, ${model}, ${year}`);
                return options
                    .filter(option => option.getAttribute('value') !== '0')
                    .map(option => option.textContent.trim());
            }, brand, model, year);

            console.log('model', model)
            console.log('ranges', ranges)

            const formattedRanges = ranges.map(range => {
                return range.replace( /(^.*\[|\].*$)/g, '' ).split(' - ').map(o => parseInt(o))
            })
            .sort((a, b) => a[0] - b[0]);

            const uniqRanges = _.uniqBy(formattedRanges, (item) => JSON.stringify(item[0]));

            const updatedRanges = uniqRanges
                .reduce<number[][]>((prev, range, i) => {
                    if (!range[0]) return prev;
                    const to = uniqRanges[i + 1] ? uniqRanges[i + 1][0] : range[1];

                    return [
                        ...prev,
                        [range[0], to || new Date().getFullYear()],
                    ];
                }, []);
                
            const rangesResult = year ? this.getYearRange(year, updatedRanges) : updatedRanges;

            if (rangesResult.length === 0) throw new Error(`No ranges for ${brand}, ${model}, ${year}. Ranges: ${JSON.stringify(updatedRanges)}`)
        
            return rangesResult;
        } catch(e) {
            throw new Error(`No such brand and model on UI ${brand} ${model} ${year}`);
        } finally {
            await browser.close();
        }
    }
}