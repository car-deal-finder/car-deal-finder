const fs = require('fs');
const puppeteer = require('puppeteer');
const _ = require('lodash');

const { clickSelectorAndWait, waitRandomTime, logError } = require('./helers');

const COORDINATES = '@50.4620394,30.5421353,11z';

const content = fs.readFileSync('result.json');
const jsonContent = JSON.parse(content);

console.log(jsonContent);

const getWorkingHours = async ({ page }) => {
  const days = [];

  let wrappers = await page.$$('.widget-pane-info-open-hours-row-table-hoverable tr');

  for (const wrapper of wrappers) {
    const day = await wrapper.$eval('.widget-pane-info-open-hours-row-header div', el => el.textContent).catch(logError);
    const times = await wrapper.$$eval('.widget-pane-info-open-hours-row-data li', elems => elems.map((el) => el.textContent)).catch(logError);

    days.push({ day, times });
  }

  return days;
};

const getTextByLabel = async ({ page, label }) => {
  let icon = await page.$(`.section-info.section-info-hoverable span[aria-label="${label}"]`);
  if (!icon) icon = await page.$(`.section-info.section-info-hoverable div[data-tooltip="${label}"]`);

  if (!icon) return null;

  const wrapper = (await icon.$x('..'))[0];
  const textWrapper = await wrapper.$('span.widget-pane-link').catch(logError);

  if (!textWrapper) return null;

  return textWrapper.evaluate(el => el.textContent).catch(logError)
};

const getCoordinates = async ({ page }) => {
  const url = await page.url();

  const arr = url.split('/');

  const item = arr.find(o => o[0] === '@');

  if (!item) return null;

  const coordinatesArr = item.slice(1).split(',')

  return [coordinatesArr[0], coordinatesArr[1]]
};

const getPointLink = async ({ page }) => {
  const shareBtn = await page.$('button[aria-label="Поделиться');
  await shareBtn.click({
    delay: _.round(0, 1000),
  });

  await waitRandomTime({ page });

  const link = await page.$eval('input.section-copy-link-input', el => el.value).catch(logError);

  await page.click('button[aria-label="Закрыть"]', {
    delay: _.round(0, 1000),
  });

  return link;
};

const isReviewTooOld = async ({ reviewWrapper }) => {
  const date = await reviewWrapper.$eval('.section-review-publish-date', el => el.textContent).catch(logError);

  return date && date.search(/год|лет?/gi) !== -1;
};

const scrollToLastComment = async ({ page, prevTitle }) => {
  let reviewsWrappers = await page.$$('.section-review.ripple-container');

  if (!reviewsWrappers.length) return reviewsWrappers;

  let lastReviewsWrapper = reviewsWrappers[reviewsWrappers.length - 1];

  let lastReviewsWrapperBtn = await lastReviewsWrapper.$('.section-review-interaction-icon');
  let lastReviewsWrapperMetadata = await lastReviewsWrapper.$('.section-review-metadata');

  if (!lastReviewsWrapperBtn && !lastReviewsWrapperMetadata) return reviewsWrappers;

  await (lastReviewsWrapperBtn || lastReviewsWrapperMetadata).hover();
  await waitRandomTime({ page });

  reviewsWrappers = await page.$$('.section-review.ripple-container');

  if (!reviewsWrappers.length) return reviewsWrappers;

  lastReviewsWrapper = reviewsWrappers[reviewsWrappers.length - 1];

  const title = await page.evaluate(el => el.getAttribute('aria-label'), lastReviewsWrapper).catch(logError);

  const reviewTooOld = await isReviewTooOld({ reviewWrapper: lastReviewsWrapper });

  if (prevTitle !== title && !reviewTooOld) return scrollToLastComment({ page, prevTitle: title });

  return reviewsWrappers;
};

const getReviewsData = async ({ reviewWrappers }) => {
  const reviews = [];

  for (const reviewWrapper of reviewWrappers) {
    const review = await getReviewData({ reviewWrapper });

    if (review) {
      reviews.push(review);
    } else break;
  }

  return reviews;
};

const getReviewData = async ({ reviewWrapper }) => {
  const reviewTooOld = await isReviewTooOld({ reviewWrapper });

  if (reviewTooOld) return null;

  const metadataItems = await reviewWrapper.$$('.section-review-metadata span');

  let titleLink = await reviewWrapper.$eval('.section-review-titles a', el => el.getAttribute('href')).catch(logError);
  let title = await reviewWrapper.$eval('.section-review-titles .section-review-title span', el => el.textContent).catch(logError);
  let rank = await metadataItems[1].evaluate(el => el.getAttribute('aria-label')).catch(logError);
  let date = await reviewWrapper.$eval('.section-review-publish-date', el => el.textContent).catch(logError);
  let comment = await reviewWrapper.$eval('.section-review-review-content .section-review-text', el => el ? el.textContent : null).catch(() => {});
  let response = await reviewWrapper.$eval('.section-review-owner-response .section-review-text', el => el ? el.textContent : null).catch(() => {});
  let photo = await reviewWrapper.$('.section-review-photos').catch(() => {});

  return {
    rank,
    date,
    titleLink,
    title,
    comment: comment || null,
    response: response || null,
    photoAttached: !!photo
  };
};

const getReviews = async ({ page }) => {
  const reviews = [];

  const reviewsBtn = await clickSelectorAndWait({ selector: 'button[aria-label="Все отзывы"]', page });
  if (!reviewsBtn) return reviews;

  await clickSelectorAndWait({ selector: 'div[aria-label="Самые релевантные"]', page });

  await page.$$eval('div.action-menu-entry', elems => elems[1].click()).catch(logError);
  await waitRandomTime({ page });

  const reviewWrappers = await scrollToLastComment({ page });

  for (const reviewWrapper of reviewWrappers) {
    const review = await getReviewData({ reviewWrapper });

    if (review) {
      reviews.push(review);
    } else break;
  }

  return reviews;
};

const getAuthorData = async ({ page, link }) => {
  let reviews = [];
  let level;
  let profileClosed = false;

  await page.bringToFront();
  await page.goto(link);
  await waitRandomTime({ page });

  await clickSelectorAndWait({ page, selector: 'button[aria-label="Отзывы"]'});

  const emptyTitleTag = await page.$('.section-empty-tab');
  level = await page.$eval('span.section-profile-header-subtext', el => el ? el.textContent : null).catch(logError);

  if (!emptyTitleTag) {
    const reviewWrappers = await scrollToLastComment({ page });

    reviews = await getReviewsData({ reviewWrappers });
  } else {
    profileClosed = true;
  }

  return {
    profileClosed,
    level,
    reviews,
  };
};

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
