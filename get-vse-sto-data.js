const fs = require('fs');
const puppeteer = require('puppeteer');
const moment = require('moment');

const { clickSelectorAndWait, waitRandomTime, logError, retry } = require('./helpers');

const content = fs.readFileSync('get-domains-data.json');

let existData;
try {
  const existDataJSON = fs.readFileSync('results/vse-sto-data-result.json');
  existData = JSON.parse(existDataJSON);
} catch (e) {

}

const jsonContent = JSON.parse(content);


console.log(jsonContent);

const scrollToLastComment = async ({ page }) => {
  const loadMoreBtn = await clickSelectorAndWait({ page, selector: '.inner_content form .button', waitForNavigation: true });

  if (!loadMoreBtn) {
    return page.$$('.reviews li');
  }

  return scrollToLastComment({ page });
};


const getReview = async ({ reviewWrapper }) => {
  const comment = await reviewWrapper.$$eval('p', elems => elems[1].textContent).catch(() => {});
  const response = await reviewWrapper.$$eval('.reply p', elems => elems[1].textContent).catch(() => {});
  const date = await reviewWrapper.$eval('.review-date', elem => elem.textContent).catch(() => {});
  const rateText = await reviewWrapper.$eval('.review-meta .stars', elem => elem.getAttribute('title')).catch(() => {});
  const rate = rateText ? rateText.split(' ')[0] : null;

  return { rate, comment, date, response };
};

const getReviews = async ({ page }) => {
  const reviewWrappers = await scrollToLastComment({ page });
  const reviews = [];

  for (let i = 0; i < reviewWrappers.length; i++) {
    const review = await getReview({ reviewWrapper: reviewWrappers[i] });

    reviews.push(review);
  }

  return reviews;
};

const getData = async ({ page, link: websiteLink }) => {
  // await page.bringToFront();

  let website = await page.$eval('.service-info .url', el => el.getAttribute('href')).catch(() => {});

  if (!website || !website.includes(websiteLink)) return null;

  let title = await page.$eval('h1', element => element.textContent.replace('СТО ', '').trim()).catch(() => {});
  let rate = await page.$eval('.rating', element => element.textContent).catch(() => {});
  let addressString = await page.$eval('.street-address', element => element.textContent).catch(() => '');
  let phones = await page.$$eval('.tel', elements => elements.map(el => el.textContent)).catch(() => {});
  let link = await page.url();
  let reviews = await getReviews({ page });

  const addresses = addressString.split(';');

  return { rate, link, reviews, title, addresses, phones };
};

const getSuggestionsLinks = async ({ page }) => {
  const links = await page.$$eval('.gsc-resultsRoot .gsc-webResult a.gs-title', elems => elems.map(elem => elem.getAttribute('href')))
    .catch(logError);

  if (!links) return [];

  return links;
};

const processSuggestion = async ({ page, suggestion, link }) => {
  await retry(() => page.goto(suggestion));
  await waitRandomTime({ page });

  return getData({ page, link });
};

const processLink = async ({ page, link }) => {
  const url = `https://vse-sto.com.ua/search/results/?q=${link}`;

  // await page.bringToFront();
  await retry(() => page.goto(url));
  await waitRandomTime({ page });

  const suggestions = await getSuggestionsLinks({ page });
  let data = null;

  for (let i = 0; i < suggestions.length; i++) {
    const result = await processSuggestion({ page, suggestion: suggestions[i], link });

    if (result) {
      data = result;

      break;
    }

    if (suggestions.length > 5 & i > 4 && !data) break;
  }

  await waitRandomTime({ page });

  return data;
}

puppeteer.launch({ headless: false, args: ['--lang=ru-RU'] }).then(async browser => {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000 * 2);
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ru_RU',
  });

  const data = [
    ...(existData || [])
  ];

  for (const item of jsonContent) {
    if (
      existData &&
      existData.find(o => o.website === item.website && moment(o.scrappedDate).add(1, 'week').isAfter(moment()))
    ) continue;

    const result = await processLink({ page, link: item.website });

    const resultItem = {
      website: item.website,
      data: result,
      scrappedDate: moment().format(),
    };

    console.log(resultItem);

    data.push(resultItem);

    fs.writeFileSync('results/vse-sto-data-result.json', JSON.stringify(data), 'utf8', () => {});
  }

  await browser.close();
});
