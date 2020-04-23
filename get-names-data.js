const fs = require('fs');
const _ = require('lodash');

const vseStoDataJson = fs.readFileSync('./results/vse-sto-data-result.json');
const vseStoData = JSON.parse(vseStoDataJson);

const result = vseStoData.map(({ website, data }) => {
  let name;

  const vseStoTitle = data && data.title && data.title.replace('СТО', '').trim();

  if (vseStoTitle) {
    name = vseStoTitle;
  } else {
    name = _.capitalize(website.split('.')[0].replace('-', ' '));
  }

  return {
    website,
    name
  };
});

fs.writeFileSync('results/names-data.json', JSON.stringify(result), 'utf8', () => {});
