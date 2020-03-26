const fs = require('fs');
const moment = require('moment');
const _ = require('lodash');

const { PUBLICATION_DATE_FRAMES } = require('./helpers');

const aggregatedData = JSON.parse(fs.readFileSync('./results/aggregated-data-short.json', 'utf8'));

const MIN_FRAME_CONFIG = {
  [PUBLICATION_DATE_FRAMES[0]]: {
    amount: 24,
    units: 'hours',
  },
  [PUBLICATION_DATE_FRAMES[1]]: {
    amount: 7,
    units: 'days',
  },
  [PUBLICATION_DATE_FRAMES[2]]: {
    amount: 28,
    units: 'days',
  },
}

const detectPeaks = ({ data, windowWidth, threshold }) => {
  const peaks = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - windowWidth);
    const end = Math.min(data.length, i + windowWidth);
    let deltaAcc = 0;
    for (let a = start; a < end; a++) {
      // if (a === start) continue;
      deltaAcc += Math.abs(data[a - 1] - data[a]);
    }
    if (deltaAcc > threshold) {
      peaks.push(i);
    }
  }
  return peaks;
}


const processReviewsByDateFrame = ({ reviews, frame }) => {
  console.log(`++++frame ${frame}`)
  const filteredReviews = reviews.filter(review => review.dateFrames[frame]).reverse();

  const groupedReviews = _.groupBy(filteredReviews, (o) => `${o.dateFrames[frame].from} - ${o.dateFrames[frame].to}`);

  const groupsKeys = Object.keys(groupedReviews);
  const groups = Object.values(groupedReviews);

  const reviewsAmountPeaks = detectPeaks({ data: groups.map(group => group.length), windowWidth: 3, threshold: 15 });

  groupsKeys.map((key, index) => {
    console.log(`${key} - amount ${groupedReviews[key].length}`);

    if ( reviewsAmountPeaks.indexOf(index) !== -1) console.log('^peak!!!!!')
  })
};

const processReviewsByDateFrames = ({ reviews }) => {
  return PUBLICATION_DATE_FRAMES.map(frame => processReviewsByDateFrame({ frame, reviews }));
};



aggregatedData.map((item) => item.googleMapsPoints.map(({ reviews }) => {
  console.log('========')
  processReviewsByDateFrames({ reviews });
}));

aggregatedData.map((item) => console.log('-----------') || processReviewsByDateFrames({ reviews: item.vseStoPoint ? item.vseStoPoint.reviews : [] }));
