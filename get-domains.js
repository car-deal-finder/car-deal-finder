const Crawler = require("crawler");
const fs = require('fs');

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

function getUrls({ amount }) {
  return new Array(amount).fill(1).map((o, index) => `https://www.google.com/search?q=%D1%80%D0%B5%D0%BC%D0%BE%D0%BD%D1%82+%D0%B0%D0%BA%D0%BF%D0%BF+%D0%BA%D0%B8%D0%B5%D0%B2&start=${10 * index}`)
}
function writeDomains({ domains }) {
  fs.writeFile('result.json', JSON.stringify(domains), 'utf8', () => {});
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

c.queue(getUrls({ amount: 10 }));
