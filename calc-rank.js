const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./results/client-format.json', 'utf8'));

const MAX_RANK = 5;
const MIN_RANK = 1;
const MIN_REVIEWS_AMOUNT = 15;
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
  return requiredSideServicesRank.filter(o => !sideServicesRank.map(o => o.name).includes(o));
}

const isReviewsAmountTooLow = ({ sideServicesRank }) => {
  return !!sideServicesRank.find(({ reviewsAmount }) => reviewsAmount < MIN_REVIEWS_AMOUNT);
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

  if (requiredSideServicesRankNotFound) {
    incomopleteCoefficient -= 0.1 * requiredSideServicesRankNotFound.length
  }

  if (feedbackWithClientsDirection === -1) {
    incomopleteCoefficient -= 0.1;
  }

  const reviewsAmountTooLow = isReviewsAmountTooLow({ sideServicesRank });

  if (reviewsAmountTooLow) {
    incomopleteCoefficient -= 0.2;
  }

  if (!sideServicesRank.length) {
    incomopleteCoefficient -= 1;
  }

  // if (forumReviewsDirection === -1) {
  //   incomopleteCoefficient -= 0.1;
  // }

  return incomopleteCoefficient
};


const calcRank = ({ fakeReviews, feedbackWithClientsDirection, forumReviewsDirection, solveCustomerClaimsPercentage, sideServicesRank }) => {
  let sideServicesRankFiltered = sideServicesRank.filter(o => o.rank != null);
  let parameterCount = sideServicesRankFiltered.length;

  let rank = sideServicesRankFiltered.map(o => parseInt(o.rank)).reduce((prev, next) => prev + next, 0);

  if (solveCustomerClaimsPercentage !== -1) {
    let percentage = calcSolveCustomerClaimsPercentage({ percentage: solveCustomerClaimsPercentage });

    rank += MAX_RANK * ((percentage || 1) / 100);
    parameterCount++;
  }

  // if (forumReviewsDirection !== -1) {
  //   rank += directionToRankMap[forumReviewsDirection.toString()];
  //   parameterCount++
  // }

  const requiredSideServicesRankNotFound = getRequiredSideServicesRankNotFound({ sideServicesRank: sideServicesRankFiltered });
  if (requiredSideServicesRankNotFound.length < requiredSideServicesRank.length) {
    rank += booleanToRankMap[(!fakeReviews).toString()];
  } else {
    rank += directionToRankMap['-1'];
  }
  parameterCount++;

  return (rank / parameterCount).toFixed(1);
};

const result = data.map((service) => {
  const {
    fakeReviews,
    feedbackWithClientsDirection,
    forumReviewsDirection,
    solveCustomerClaimsPercentage,
    sideServicesRank
  } = service;

  const rank = calcRank({
    fakeReviews,
    feedbackWithClientsDirection,
    solveCustomerClaimsPercentage,
    forumReviewsDirection,
    sideServicesRank,
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
