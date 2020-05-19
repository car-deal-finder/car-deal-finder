const _ = require('lodash');

const PUBLICATION_DATE_FRAMES = [
  'days',
  'weeks',
  'months',
];

const retry = (fn, ms = 3000) => new Promise(resolve => {
  fn()
    .then(resolve)
    .catch((err) => {
      setTimeout(() => {
        console.log(err);
        console.log('retrying...');
        retry(fn, ms).then(resolve);
      }, ms);
    })
});

const waitRandomTime = ({ page }) => {
  return page.waitFor(_.round(3000, 10000));
};

const clickSelectorAndWait = async ({ page, selector, elem, waitForNavigation }) => {
  const selectorElem = await (elem || page).$(selector);

  if (!selectorElem) return null;

  await selectorElem.click({
    delay: _.round(0, 1000),
  })
    .catch(() => logError);

  if (waitForNavigation) await retry(() => page.waitForNavigation());

  await waitRandomTime({ page });

  return selectorElem;
};

function getUrls({ amount, search }) {
  return new Array(amount).fill(1).map((o, index) => `https://www.google.com/search?q=${search}&start=${10 * index}`)
}

function extractHostname(url) {
  var hostname;
  //find & remove protocol (http, ftp, etc.) and get hostname

  if (url.indexOf("//") > -1) {
    hostname = url.split('/')[2];
  }
  else {
    hostname = url.split('/')[0];
  }

  //find & remove port number
  hostname = hostname.split(':')[0];
  //find & remove "?"
  hostname = hostname.split('?')[0];

  if (hostname.indexOf('www.') === 0) hostname = hostname.replace('www.', '');

  return hostname;
}

const logError = (err) => console.error(err);

const transliterate = (
  function() {
    var
      rus = "щ   ш  ч  ц  ю  я  ё  ж  ъ  ы  э  а б в г д е з и й к л м н о п р с т у ф х ь".split(/ +/g),
      eng = "shh sh ch cz yu ya yo zh `` y' e` a b v g d e z i j k l m n o p r s t u f x `".split(/ +/g)
    ;
    return function(text, engToRus) {
      var x;
      for(x = 0; x < rus.length; x++) {
        text = text.split(engToRus ? eng[x] : rus[x]).join(engToRus ? rus[x] : eng[x]);
        text = text.split(engToRus ? eng[x].toUpperCase() : rus[x].toUpperCase()).join(engToRus ? rus[x].toUpperCase() : eng[x].toUpperCase());
      }
      return text;
    }
  }
)();

const isNotLatin = (string) => {
  var rforeign = /[^\u0000-\u007f]/;

  return rforeign.test(string);
};

const getSiteKeywords = async ({ page }) => {
  const siteKeywords = await Promise.all([
    await page.$eval('head title', el => el.textContent).catch(() => {}),
    await page.$eval('head meta[name="description"]', el => el.getAttribute('content')).catch(() => {}),
    await page.$eval('head meta[name="keywords"]', el => el.getAttribute('content')).catch(() => {}),
    ...(await page.$$eval('h1', elems => elems.map(el => el.textContent)).catch(() => [])),
  ]);
  return siteKeywords.filter(o => o);
};

function countWords(str) {
  return str.trim().split(/\s+/).length;
}

const xPathToLowerCase = (content) => `translate(${content}, 'ABCDEFGHIJKLMNOPQRSTUVWXYZАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzабвгдеёжзийклмнопрстуфхцчшщъыьэюя')`;


module.exports = {
  waitRandomTime,
  clickSelectorAndWait,
  logError,
  PUBLICATION_DATE_FRAMES,
  retry,
  getUrls,
  extractHostname,
  transliterate,
  isNotLatin,
  getSiteKeywords,
  countWords,
  xPathToLowerCase,
};

