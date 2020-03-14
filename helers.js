export const waitRandomTime = ({ page }) => {
  return page.waitFor(_.round(3000, 6000));
};

export const clickSelectorAndWait = async ({ page, selector }) => {
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
