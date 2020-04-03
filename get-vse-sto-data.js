const fs = require('fs');
const puppeteer = require('puppeteer');

const { clickSelectorAndWait, waitRandomTime, logError } = require('./helpers');

const content = fs.readFileSync('results/get-domains-data.json');
const jsonContent = JSON.parse(content);

console.log(jsonContent);

const scrollToLastComment = async ({ page }) => {
  const loadMoreBtn = await clickSelectorAndWait({ page, selector: '.inner_content form .button' });

  if (!loadMoreBtn) {
    return page.$$('.reviews li');
  }

  await scrollToLastComment({ page });
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
  await page.bringToFront();

  let website = await page.$eval('.service-info .url', el => el.getAttribute('href')).catch(() => {});

  if (!website || !website.includes(websiteLink)) return null;

  let rate = await page.$eval('.rating', element => element ? element.textContent : null).catch(() => {});
  let link = await page.url();
  let reviews = await getReviews({ page });

  return { rate, link, reviews };
};

const getSuggestionsLinks = async ({ page }) => {
  const links = await page.$$eval('.gsc-resultsRoot .gsc-webResult a.gs-title', elems => elems.map(elem => elem.getAttribute('href')))
    .catch(logError);

  if (!links) return [];

  return links;
};

const processSuggestion = async ({ page, suggestion, link }) => {
  await page.goto(suggestion).catch(logError);
  await waitRandomTime({ page });

  return getData({ page, link });
};

const processLink = async ({ page, link }) => {
  const url = `https://vse-sto.com.ua/search/results/?q=${link}`;

  await page.bringToFront();
  await page.goto(url);
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

  console.log(data);

  await waitRandomTime({ page });

  return data;
}

puppeteer.launch({ headless: false, args: ['--lang=ru-RU'] }).then(async browser => {
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ru_RU',
  });

  const data = [];

  for (const item of jsonContent) {
    const result = await processLink({ page, link: item.website });

    data.push({
      website: item.website,
      data: result,
    });

    fs.writeFileSync('results/vse-sto-data-result.json', JSON.stringify(data), 'utf8', () => {});
  }

  await browser.close();
});
