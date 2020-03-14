const fs = require('fs');
const puppeteer = require('puppeteer');
const _ = require('lodash');

const { clickSelectorAndWait, waitRandomTime, logError } = require('./helers');

const COORDINATES = '@50.4620394,30.5421353,11z';

const content = fs.readFileSync('result.json');
const jsonContent = JSON.parse(content);

console.log(jsonContent);

const getData = async ({ page, link: websiteLink, page2 }) => {
  await page.bringToFront();

  let rate = await page.$eval('.section-star-display', element => element ? element.textContent : '').catch(() => {});

  let website = await getTextByLabel({ page, label: 'Сайт' });

  if (!website || website === 'Добавить сайт') website = await getTextByLabel({ page, label: 'Открыть ссылку для бронирования' })

  if (!website || !website.includes(websiteLink)) return null;

  let phone = await getTextByLabel({ page, label: 'Телефон' })
  let address = await getTextByLabel({ page, label: 'Адрес' })
  let workingHours = await getWorkingHours({ page });
  let coordinates = await getCoordinates({ page });

  await waitRandomTime({ page });

  let link = await getPointLink({ page });
  let reviews = await getReviews({ page });


  for (let i = 0; i < (reviews.length < 3 ? reviews.length : 3); i++) {
    const authorData = await getAuthorData({ page: page2, link: reviews[i].titleLink });
    reviews[i].authorData = authorData;
  }


  return { rate, website, address, website, phone, workingHours, coordinates, link, reviews };
};

const getSuggestions = ({ page }) => {
  return page.$$('.section-result');
};

const processSuggestion = async ({ page, suggestion, link, page2 }) => {
  await suggestion.click({
    delay: _.round(0, 1000),
  });

  await waitRandomTime({ page });

  return getData({ page, link, page2 });
};

const processLink = async ({ page, page2, link }) => {
  const url = `https://www.google.com/maps/search/${link}/${COORDINATES}`;

  await page.bringToFront();
  await page.goto(url);
  await waitRandomTime({ page });

  const suggestions = await getSuggestions({ page });
  const data = [];

  if (!suggestions.length) {
    const result = await getData({ page, link, page2 });

    if (result) data.push(result);
  } else {
    for (let i = 0; i < suggestions.length; i++) {
      await page.bringToFront();
      const newSuggestions = await getSuggestions({ page });

      const result = await processSuggestion({ page, page2, suggestion: newSuggestions[i], url, link });
      if (result) data.push(result);

      if (suggestions.length > 5 & i > 4 & data.length < suggestions.length) break;

      await page.goto(url);

      await waitRandomTime({ page });
    }
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
  const page2 = await browser.newPage();
  await page2.setExtraHTTPHeaders({
    'Accept-Language': 'ru_RU',
  });

  const data = [];

  for (const item of jsonContent) {
    const result = await processLink({ page, page2, link: item.website });

    data.push({
      website: item.website,
      points: result.length ? result : [],
    });

    fs.writeFileSync('google-maps-data-result.json', JSON.stringify(data), 'utf8', () => {});
  }

  await browser.close();
});
