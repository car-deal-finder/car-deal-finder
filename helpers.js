const _ = require('lodash');

const PUBLICATION_DATE_FRAMES = [
  'days',
  'weeks',
  'months',
];

const waitRandomTime = ({ page }) => {
  return page.waitFor(_.round(3000, 6000));
};

const clickSelectorAndWait = async ({ page, selector }) => {
  const elem = await page.$(selector);

  if (!elem) return null;

  await elem.click({
    delay: _.round(0, 1000),
  })
    .catch(() => logError);

  await waitRandomTime({ page });

  return elem;
};

const logError = (err) => console.error(err);

module.exports = {
  waitRandomTime,
  clickSelectorAndWait,
  logError,
  PUBLICATION_DATE_FRAMES,
};

