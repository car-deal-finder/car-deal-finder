const fs = require('fs');
const moment = require('moment');
const _ = require('lodash');

const { PUBLICATION_DATE_FRAMES } = require('./helpers');

const aggregatedData = JSON.parse(fs.readFileSync('./results/aggregated-data.json', 'utf8'));

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

// const detectPeaks = ({ data, windowWidth, threshold }) => {
//   const peaks = [];
//   for (let i = 0; i < data.length; i++) {
//     const start = Math.max(0, i - windowWidth);
//     const end = Math.min(data.length, i + windowWidth);
//
//     let deltaAcc = 0;
//
//     for (let a = start; a < end; a++) {
//       if (a - 1 < 0 || data[a - 1] > data[a]) continue;
//       deltaAcc += Math.abs(data[a - 1] - data[a]);
//     }
//     if (deltaAcc >= threshold) {
//       peaks.push(i);
//     }
//   }
//   return peaks;
// }

const detectPeaks = ({ data, windowWidth = 3, threshold }) => {
  let peaks = {};

  if (data.length < windowWidth * 2) return peaks;

  dataLoop: for (let i = 0; i < data.length; i++) {
    if (i + windowWidth * 2 - 1 > data.length - 1) break;

    let currentWindowValue = 0;
    let nextWindowValue = 0;

    for (let windowIndex = 0; windowIndex < 2; windowIndex++) {
      const windowStart = i + windowWidth * windowIndex;
      const windowEnd = windowStart + windowWidth - 1;

      if (windowWidth !== 1) {
        const localDataEndIndex = windowIndex === 0 ? windowEnd + 2 : windowEnd + 1;

        const localData = data.slice(windowStart, localDataEndIndex);
        const localPeaks = detectPeaks({ data: localData, windowWidth: 1, threshold });

        const localPeaksMap = Object.keys(localPeaks).reduce((prev, key) => ({ ...prev, [parseInt(key) + windowStart]: localPeaks[key] }), {});

        peaks = { ...peaks, ...localPeaksMap };

        if (windowIndex === 1 && Object.keys(localPeaksMap).length) continue dataLoop;
      }

      for (let unitIndex = windowStart; unitIndex <= windowEnd; unitIndex++) {
        if (windowIndex === 0) currentWindowValue += data[unitIndex];
        if (windowIndex === 1) nextWindowValue += data[unitIndex];
      }
    }

    const nextWindowFirstIndex = i + windowWidth;

    const delta = nextWindowValue - currentWindowValue;

    if (Math.abs(delta) < threshold) continue;

    if (delta > 0) peaks[nextWindowFirstIndex] = parseFloat((nextWindowValue / currentWindowValue).toFixed(2));
    if (delta < 0) peaks[nextWindowFirstIndex] = -parseFloat((currentWindowValue / nextWindowValue).toFixed(2));
  }

  return peaks;
};


const processReviewsByDateFrame = ({ reviews, frame }) => {
  // console.log(`++++frame ${frame}`)
  const filteredReviews = reviews.filter(review => review.dateFrames[frame]).reverse();

  const groupedReviews = _.groupBy(filteredReviews, (o) => `${o.dateFrames[frame].from} - ${o.dateFrames[frame].to}`);

  const groupsKeys = Object.keys(groupedReviews);
  const groups = Object.values(groupedReviews);

  const reviewsAmountPeaks = detectPeaks({ data: groups.map(group => group.length), windowWidth: 1, threshold: 5 });

  // groupsKeys.map((key, index) => {
  //   console.log(`${key} - amount ${groupedReviews[key].length}`);
  //
  //   if (reviewsAmountPeaks[index]) console.log(`^peak!!!!! ${reviewsAmountPeaks[index]}`)
  // })

  return Object.keys(reviewsAmountPeaks).reduce((prev, key) => ({ ...prev, [groupsKeys[key]]: reviewsAmountPeaks[key]}), {});
};

const processReviewsByDateFrames = ({ reviews }) => {
  return PUBLICATION_DATE_FRAMES.reduce((prev, frame) => {
    const result = processReviewsByDateFrame({ frame, reviews });

    if (!Object.keys(result).length) return prev;

    return ({ ...prev, [frame]: result });
  }, {});
};

const result = aggregatedData.map((item) => {
  let cheatingDetected = false;

  const googleMapsPointsResult = item.googleMapsPoints.map((point) => {
    const { reviews } = point;
    const cheating = processReviewsByDateFrames({ reviews });

    if (Object.keys(cheating).length) cheatingDetected = true;

    return { ...point, cheating };
  });

  return { ...item, cheatingDetected, googleMapsPoints: googleMapsPointsResult };
});

console.log(result)
fs.writeFileSync('results/cheating-detected-data.json', JSON.stringify(result), 'utf8', () => {});

// aggregatedData.map((item) => console.log('-----------') || processReviewsByDateFrames({ reviews: item.vseStoPoint ? item.vseStoPoint.reviews : [] }));
