const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./results/client-format.json', 'utf8'));

const MAX_RANK = 5;
const MIN_RANK = 1;
const MIN_REVIEWS_AMOUNT = 3;
const INCOMPLETED_COEFFICIENT_TRESHOLD = 0.7;

const directionToRankMap = {
  '-1': 3,
  '0': MIN_RANK,
  '1': Math.round((MAX_RANK + MIN_RANK) / 2),
  '2': MAX_RANK
};
const booleanToRankMap = {
  'true': MAX_RANK,
  'false': MIN_RANK,
};
const requiredSideServicesRank = [
  'Vse STO',
  'Google Maps'
];

const getRequiredSideServicesRankNotFound = ({ sideServicesRank }) => {
  return requiredSideServicesRank.filter(o => !sideServicesRank.filter(o => o.reviewsAmount).map(o => o.name).includes(o));
}

const isReviewsAmountTooLow = ({ sideServicesRank }) => {
  return sideServicesRank.reduce((prev, next) => prev + next.reviewsAmount, 0) < MIN_REVIEWS_AMOUNT;
}

const calcSolveCustomerClaimsPercentage = ({ percentage }) => {
  return percentage;
  let result = percentage / 50 * 100;
  if (result > 100) result = 100;

  return result;
};

const calcIncomopleteCoefficient = ({ feedbackWithClientsDirection, forumReviewsDirection, sideServicesRank }) => {
  let incomopleteCoefficient = 1;
  const requiredSideServicesRankNotFound = getRequiredSideServicesRankNotFound({ sideServicesRank });

  if (requiredSideServicesRankNotFound && sideServicesRank.length === requiredSideServicesRankNotFound.length) {
    incomopleteCoefficient -= 0.1 * requiredSideServicesRankNotFound.length
  }

  const reviewsAmountTooLow = isReviewsAmountTooLow({ sideServicesRank });

  if (reviewsAmountTooLow) {
    incomopleteCoefficient -= 1;
  }

  if (feedbackWithClientsDirection === -1) {
    incomopleteCoefficient -= 0.1;
  }

  // if (forumReviewsDirection === -1) {
  //   incomopleteCoefficient -= 0.1;
  // }

  return incomopleteCoefficient
};


const calcRank = ({ fakeReviews, feedbackWithClientsDirection, forumReviewsDirection, solveCustomerClaimsPercentage, sideServicesRank, website }) => {
  let sideServicesRankFiltered = sideServicesRank.filter(o => o.rank != null);
  let parameterCount = sideServicesRankFiltered.length;

  let rank = sideServicesRankFiltered.map(o => parseFloat(o.rank)).reduce((prev, next) => prev + next, 0);

  if (solveCustomerClaimsPercentage !== -1 && sideServicesRank.find(o => o.rank < 4)) {
    let percentage = calcSolveCustomerClaimsPercentage({ percentage: solveCustomerClaimsPercentage });

    rank += MAX_RANK * ((percentage || 1) / 100);
    parameterCount++;
  }

  // if (forumReviewsDirection !== -1) {
  //   rank += directionToRankMap[forumReviewsDirection.toString()];
  //   parameterCount++
  // }

  if (fakeReviews) {
    rank += booleanToRankMap[(!fakeReviews).toString()];
    parameterCount++;
  }

  return (rank / parameterCount).toFixed(1);
};

const result = data.map((service) => {
  const {
    fakeReviews,
    feedbackWithClientsDirection,
    forumReviewsDirection,
    solveCustomerClaimsPercentage,
    sideServicesRank,
    website
  } = service;

  const rank = calcRank({
    fakeReviews,
    feedbackWithClientsDirection,
    solveCustomerClaimsPercentage,
    forumReviewsDirection,
    sideServicesRank,
    website
  });
  const incomopleteCoefficient = calcIncomopleteCoefficient({ feedbackWithClientsDirection, forumReviewsDirection, sideServicesRank });
  const incomplete = incomopleteCoefficient <= INCOMPLETED_COEFFICIENT_TRESHOLD;

  return {
    ...service,
    incomplete,
    rank,
  }
});

const completedServices = result
  .filter(o => !o.incomplete)
  .sort((a, b) => {
    return b.rank - a.rank
  });
const incompletedServices = result
  .filter(o => o.incomplete)
  .sort((a, b) => {
    return b.rank - a.rank
  });

fs.writeFileSync('results/rank-result.json', JSON.stringify([...completedServices, ...incompletedServices]), 'utf8', () => {});
