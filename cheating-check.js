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

const processReviewsByDateFrame = ({ reviews, frame }) => {
  const filteredReviews = reviews.filter(review => review.dateFrames[frame]);

  const groupedReviews = _.groupBy(filteredReviews, (o) => `${frame} - ${o.dateFrames[frame].from} - ${o.dateFrames[frame].to}`);

  const groups = Object.values(groupedReviews);

  Object.keys(groupedReviews).map(key => {
    console.log(`${key} - amount ${groupedReviews[key].length}`);
    console.log(groupedReviews[key].reduce((prev, next) => prev + next.rank, 0) / groupedReviews[key].length)
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
