const fs = require('fs');
const puppeteer = require('puppeteer');
const moment = require('moment');
const clipboardy = require('clipboardy');

const { retry, waitRandomTime, clickSelectorAndWait } = require('./helpers');

const vseStoData = JSON.parse(fs.readFileSync('./results/vse-sto-data-result.json', 'utf8'));
const googleMapsData = JSON.parse(fs.readFileSync('./results/google-maps-data-result.json', 'utf8'));
const domainsData = JSON.parse(fs.readFileSync('./get-domains-data.json', 'utf8'));

let coordinatesData;
try {
  coordinatesData = JSON.parse(fs.readFileSync('./results/coordinates-data.json', 'utf8'));
} catch (e) {
  coordinatesData = { data: [] };
}

const getCoordinates = async ({ page, address }) => {
  await retry(() => page.goto(`https://www.google.com/maps/@50.4462503,30.522675,10.95z`));

  try {
    await page.waitForNavigation();
  } catch (e) {}

  await waitRandomTime({ page });

  const input = await page.$('#searchbox');

  await input.click();

  await page.keyboard.type(address, { delay: 100 });

  await waitRandomTime({ page });

  await page.keyboard.press('Enter');

  await waitRandomTime({ page });

  const title = await page.$eval('.section-hero-header-title-title', el => el.textContent).catch(() => {});

  if (!title) return null;

  const url = await page.url();

  const arr = url.split('/');

  const item = arr.find(o => o[0] === '@');

  if (!item) return null;

  const coordinatesArr = item.slice(1).split(',')

  return [coordinatesArr[0], coordinatesArr[1]]
};

const processItem = async ({ page, googleMapsItem, vseStoItem }) => {
  const vseStoAddresses = vseStoItem.data ? vseStoItem.data.addresses : [];
  const googleMapsAddresses = googleMapsItem.points.map(({ address }) => address);

  const googleMapsCoordinates = [];
  const vseStoCoordinates = [];

  for (const address of googleMapsAddresses) {
    const coordinates = await getCoordinates({ page, address });
    if (coordinates) googleMapsCoordinates.push({ address, coordinates });

    await waitRandomTime({ page });
  }
  for (const address of vseStoAddresses) {
    const coordinates = await getCoordinates({ page, address });
    if (coordinates) vseStoCoordinates.push({ address, coordinates });

    await waitRandomTime({ page });
  }

  return { googleMapsCoordinates, vseStoCoordinates }
};


puppeteer.launch({ headless: false }).then(async browser => {
  const page = await browser.newPage();
  // await page.setExtraHTTPHeaders({
  //   'Accept-Language': 'ru_RU',
  // });

  const data = [
    ...coordinatesData.data,
  ];

  for (const item of domainsData) {
    if (
      coordinatesData &&
      coordinatesData.data.find(o => o.website === item.website && moment(o.scrappedDate).add(1, 'week').isAfter(moment()))
    ) continue;

    const googleMapsItem = googleMapsData.data.find(({ website }) => website === item.website);
    const vseStoItem = vseStoData.find(({ website }) => website === item.website);

    const result = await processItem({ page, googleMapsItem, vseStoItem });
    const dataItem = {
      website: item.website,
      points: result,
      scrappedDate: moment().format(),
    };

    data.push(dataItem);

    fs.writeFileSync('results/coordinates-data.json', JSON.stringify({ data, scrappedDate: moment().format() }), 'utf8', () => {});
  }

  await browser.close();
});
