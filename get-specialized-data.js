const fs = require('fs');
const puppeteer = require('puppeteer');
const moment = require('moment');

const { retry, waitRandomTime, getSiteKeywords } = require('./helpers');

const content = fs.readFileSync('get-domains-data.json');

let existData;
try {
  const existDataJSON = fs.readFileSync('results/specialized-data-result.json');
  existData = JSON.parse(existDataJSON);
} catch (e) {}
const jsonContent = JSON.parse(content);

const KEYWORDS_DICTS = {
  AUTOMATIC_TRANSMISSION_REPAIR: [
    'акпп',
    'автоматической коробки',
    'автоматических коробок',
    'коробок автомат',
    'коробки автомат',
    'автомат коробок',
    'автомат коробки',
    'dsg',
    'dsg7',
    'dsg8',
    'dsg6',
  ],
};

console.log(jsonContent);

const processLink = async ({ page, website }) => {
  const existDataItem = existData && existData.find(o => o.website === website && moment(o.scrappedDate));

  let siteKeywords;

  if (!existDataItem || !existDataItem.data) {
    try {
      await page.goto(`http://${website}`);
      await waitRandomTime({ page });
    } catch (e) {
      console.log(e);
      return { specialized: [], keywords: [] };
    }

    siteKeywords = getSiteKeywords({ page })
  } else {
    siteKeywords = existDataItem.data.keywords;
  }

  const siteKeywordsString = siteKeywords.join(' ').toLowerCase();

  const specialized = Object.keys(KEYWORDS_DICTS).filter(specialized => {
    const dict = KEYWORDS_DICTS[specialized];

    const relevant = !!dict.find(keyword => siteKeywordsString.includes(keyword));

    return relevant;
  });

  return { specialized, keywords: siteKeywords };
};

puppeteer.launch({ headless: false, args: ['--lang=ru-RU'] }).then(async browser => {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000 * 2);
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ru_RU',
  });

  const data = [];

  for (const item of jsonContent) {
    const result = await processLink({ page, website: item.website });
    const resultItem = {
      website: item.website,
      data: result,
      scrappedDate: moment().format(),
    };

    console.log(resultItem);

    data.push(resultItem);

    fs.writeFileSync('results/specialized-data-result.json', JSON.stringify(data), 'utf8', () => {});
  }

  await browser.close();
});
