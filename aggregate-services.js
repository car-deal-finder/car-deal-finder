const fs = require('fs');
const _ = require('lodash');

const servicesList = JSON.parse(fs.readFileSync('./results/services-list.json'));

const result = servicesList.reduce((prev, next) => {

  Object.keys(next).forEach(key => {
    if (!prev[key]) prev[key] = [];

    prev[key].push(next[key]);
  });


  return prev;
}, {});

fs.writeFileSync('results/services-map.json', JSON.stringify(result), 'utf8', () => {});
