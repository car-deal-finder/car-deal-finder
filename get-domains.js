const Crawler = require("crawler");
const fs = require('fs');
const { getUrls, extractHostname } = require('helpers');

function writeDomains({ domains }) {
  fs.writeFile('results/get-domains-data.json', JSON.stringify(domains), 'utf8', () => {});
}

const domains = [];

const c = new Crawler({
  maxConnections : 10,
  callback : function (error, res, done) {
    if (error) {
      console.log(error);
    } else {
      const $ = res.$;
      $('body').find('.BNeawe.UPmit.AP7Wnd').each((i, o) => {
        const text = $(o).text();
        const parsed = extractHostname(text.split(' ')[0]);
        domains.push({ website: parsed });
      });
      if (domains.length >= 99) writeDomains({ domains });
      console.log(domains.length);
    }

    done();
  }
});

c.queue(getUrls({ amount: 10, search: '%D1%80%D0%B5%D0%BC%D0%BE%D0%BD%D1%82+%D0%B0%D0%BA%D0%BF%D0%BF+%D0%BA%D0%B8%D0%B5%D0%B2' }));
