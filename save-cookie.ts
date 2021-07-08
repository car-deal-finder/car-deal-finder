import { PageManipulator } from "./parser/types";
const fs = require('fs').promises;



(async() => {
    const { page, browser } = await PageManipulator.createPage();

    const cookiesString = await fs.readFile('./cookies.json');
    const cookies = JSON.parse(cookiesString);
    await page.setCookie(...cookies);

    await page.goto('https://auto.ria.com/uk/login.html?from_url=/uk/cabinet/');

    await new Promise((res) => {
        setTimeout(async () => {
            const cookies = await page.cookies();
            await fs.writeFile('./cookies.json', JSON.stringify(cookies, null, 2));
            res(1);
        }, 60000)
    })

    browser.close();
})()