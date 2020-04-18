const fs = require('fs');
const puppeteer = require('puppeteer');
const moment = require('moment');
const _ = require('lodash');
const { getUrls, waitRandomTime, extractHostname, isNotLatin, transliterate, getSiteKeywords, countWords, retry, xPathToLowerCase } = require('./helpers');

const namesData = JSON.parse(fs.readFileSync('./results/names-data.json', 'utf8'))
  // .sort(() => _.random(-1, 1));

let existData;
try {
  existData = JSON.parse(fs.readFileSync('./results/side-forums-data.json', 'utf8'));
} catch (e) {}

const FORUM_KEYWORDS = [
  'club',
  'forum',
  'клуб',
  'forum',
  'сообщество',
];

const USER_MESSAGES_KEYWORDS = [
  'сообщений',
  'сообщения'
];

const MIN_REVIEW_WORDS_AMOUNT = 5;
const MAX_REVIEW_WORDS_AMOUNT = 200;
const GOOGLE_PAGES_AMOUNT = 2;

const MIN_MATCH_WORD_LENGTH = 5;

const isExistDataItemValid = (existDataItem) => {
  return (
    existDataItem &&
    existDataItem.data &&
    existDataItem.data.length &&
    moment(existDataItem.scrappedDate).add(1, 'week').isAfter(moment())
  );
};

const filterText = ({ text, website, names, websiteFirstPartArr, prevItems }) => {
  const existedText = prevItems.find(({ text: prevText }) => text.includes(prevText));

  return !existedText && (text.includes(website) || !![ ...names, ...websiteFirstPartArr ].filter(name => name.length >= MIN_MATCH_WORD_LENGTH).find(name => text.toLowerCase().includes(name.toLowerCase())));
};

const filterSuggestion = async ({ link, website, page }) => {
  const linkDomain = extractHostname(link);

  if (linkDomain === website) return false;

  const siteKeywords = await getSiteKeywords({ page });

  const foundKeyword = FORUM_KEYWORDS.find(forumKeyword => {
    return link.toLowerCase().includes(forumKeyword) || siteKeywords.find(siteKeyword => siteKeyword.toLowerCase().includes(forumKeyword))
  });

  return !!foundKeyword;
};

const getFullTextOfReview = async ({ node }) => {
  const text = await node.evaluate(elem => elem.innerText);
  const wordsAmount = text ? countWords(text) : 0;

  if (wordsAmount >= MIN_REVIEW_WORDS_AMOUNT && wordsAmount <= MAX_REVIEW_WORDS_AMOUNT) return text;
  if (wordsAmount > MAX_REVIEW_WORDS_AMOUNT) return  '';

  const parentNode = (await node.$x('..'))[0];

  if (!parentNode) return '';

  return getFullTextOfReview({ node: parentNode });
};

const getUserMessagesAmount = async ({ node }) => {
  if (!node) return null;

  const nodeText = await node.evaluate(elem => elem.innerText);

  const children = await node.$x('child::*');

  const childrenText = [];

  for (const child of children) {
    const childText = await child.evaluate(el => el.textContent);
    if (childText) childrenText.push(childText);
  }

  let foundPhrase;

  const nodePhrase = (nodeText.toLowerCase().match(new RegExp(`[0-9]+`, 'g')) || [])[0];

  if (nodePhrase) foundPhrase = nodePhrase;

  for (const childText of childrenText) {
    const childPhrase = (childText.toLowerCase().match(new RegExp(`[0-9]+`, 'g')) || [])[0];

    if (childPhrase) foundPhrase = childPhrase;
  }

  if (foundPhrase) return parseInt(foundPhrase);

  const parentNode = (await node.$x('..'))[0];

  return getUserMessagesAmount({ node: parentNode });
};

const getUserMessages = async ({ node }) => {
  if (!node) return null;

  const parentNode = (await node.$x('..'))[0];

  let messagesNode;

  for (const word of USER_MESSAGES_KEYWORDS) {
    const result = (await node.$x(`//*[contains(${xPathToLowerCase('text()')}, '${word}:')]`))[0];

    if (result) {
      messagesNode = result;

      break;
    }
  }

  if (!messagesNode) return getUserMessages({ node: parentNode });

  return getUserMessagesAmount({ node: messagesNode });
};

const processSuggestion = async ({ name, page, link, website, existDataItem }) => {
  let names;
  const isLatin = !isNotLatin(name);
  if (isLatin) {
    names = [name, transliterate(name, true)];
  } else {
    names = [name, name];
  }

  const websiteFirstPart = website.split('.')[0];
  const websiteFirstPartArr = websiteFirstPart.length >= MIN_MATCH_WORD_LENGTH ? [
    websiteFirstPart,
    transliterate(websiteFirstPart, true)
  ]: [];

  // if (!existDataItem || !isExistDataItemValid(existDataItem)) {
    try {
      await page.goto(link);
    } catch (e) {
      return [];
    }

    const suggestionIsRelevant = await filterSuggestion({ page, website, link });

    if (!suggestionIsRelevant) return [];

    const nodesResult = await Promise.all(
      [
        page.$x(`//*[contains(${xPathToLowerCase('text()')}, '${website.toLowerCase()}')]`),
        ...names.map(name => (
          page.$x(`//*[contains(${xPathToLowerCase('text()')}, '${name.toLowerCase()}')]`)
        )),
        ...websiteFirstPartArr.map(websiteFirstPartArrItem => (
          page.$x(`//*[contains(${xPathToLowerCase('text()')}, '${websiteFirstPartArrItem.toLowerCase()}')]`)
        )),
      ]
    ).catch(e => {
      console.log(e);

      return [];
    });

    const nodes = nodesResult.reduce((prev, next) => [ ...prev, ...next ], []);

    const textArrResult = await Promise.all(
      nodes.filter(o => o).map(node => getFullTextOfReview({ node }).then(text => ({ text, node })))
    );

    const textArrResultFiltered = _.uniqBy(
      textArrResult.filter(({ text }, index) => filterText({ text, website, websiteFirstPartArr, names, prevItems: textArrResult.slice(0, index) })),
      'text'
    );

    return await Promise.all(
      textArrResultFiltered.map(({ node, text, }) => getUserMessages({ node }).then(messages => ({ text, messages })))
    );
  // } else {
  //   const textNodes = existDataItem.data.find(suggestionItem => suggestionItem.link === link).textNodes;
  //   return textNodes.filter(({ text }, index) => filterText({ text, website, websiteFirstPartArr, names, prevItems: textNodes.slice(0, index) }));
  // }
};

const processPage = async ({ link, page }) => {
  await retry(() => page.goto(link));

  await waitRandomTime({ page });

  const divs = await page.$$('body #search .g .rc .r h3');

  const links = await Promise.all(divs.map(div => div.evaluate((el) => el.parentElement.getAttribute('href'))));

  const filtered = links.filter(link => {
    const host = extractHostname(link);

    const arr = host.split('.');

    return !arr[arr.length - 1].match(/ru|by/);
  });

  return { links: filtered };
};

const processLink = async ({ page, website, name, existDataItem }) => {
  let links = [];

  if (!existDataItem || !isExistDataItemValid(existDataItem)) {
    const urls = getUrls({ amount: GOOGLE_PAGES_AMOUNT, search: `${website} киев отзывы форум` });

    for (const url of urls) {
      const { links: pageLinks } = await processPage({ link: url, page });

      links = [ ...links, ...pageLinks ];
    }
  } else {
    links = existDataItem.data.map(({ link }) => link);
  }

  const result = [];

  for (const link of links) {
    const textNodes = await processSuggestion({ page, name, link, website, existDataItem });

    result.push({
      link,
      textNodes,
    })
  }

  return result;
};

puppeteer.launch({ headless: false, args: ['--lang=ru-RU'] }).then(async browser => {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ru_RU',
  });

  const data = [
    ...(existData || [])
  ];

  for (const item of namesData) {
    const existDataItem = existData && existData.find(o => o.website === item.website);

    const result = await processLink({ page, website: item.website, name: item.name, existDataItem });

    const resultItem = {
      website: item.website,
      data: result,
      scrappedDate: moment().format(),
    };

    console.log(resultItem);

    if (!existDataItem) {
      data.push(resultItem);
    } else {
      _.assign(existDataItem, resultItem);
    }

    fs.writeFileSync('results/side-forums-data.json', JSON.stringify(data), 'utf8', () => {});
  }

  await browser.close();
});
