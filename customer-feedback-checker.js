const fs = require('fs');

const NEGATIVE_RANK_TRESHOLD = 3;

const data = JSON.parse(fs.readFileSync('./results/cheating-detected-data.json', 'utf8'));

const POSITIVE_FEEDBACK_DICT = [
  'извинения',
  'прощения',
  'уладить',
  'загладить',
  'перезвоните',
  'позвоните',
  'свяжитесь',
  'свяжемся',
  'перезвоним',
  'позвоним',
  'свяжется',
  'перезвонит',
  'позвонит',
];

const processReviews = ({ reviews }) => {
  let negativeReviewsCounter = 0;
  let negativeReviewsSolveCustomerClaimCounter = 0;

  const processedReviews = reviews.reduce((prev, review) => {
    const { rank, response, comment } = review;
    const reviewIsNegative = comment && rank <= NEGATIVE_RANK_TRESHOLD;
    const solveCustomerClaim = reviewIsNegative && response && !!POSITIVE_FEEDBACK_DICT.find(keyword => response.toLowerCase().includes(keyword));

    if (reviewIsNegative) negativeReviewsCounter += 1;
    if (solveCustomerClaim) negativeReviewsSolveCustomerClaimCounter += 1;

    return [
      ...prev,
      {
        ...review,
        solveCustomerClaim,
      }
    ];
  }, []);

  const percentage = negativeReviewsCounter === 0 && negativeReviewsSolveCustomerClaimCounter === 0 ? null : (
    negativeReviewsSolveCustomerClaimCounter / negativeReviewsCounter * 100
  );

  return {
    processedReviews,
    percentage,
  }
};

const result = data.map((service) => {
  let solveCustomerClaimsPercentage = 0;
  let pointsCounter = 0;

  const googleMapsPointsResult = service.googleMapsPoints.map((point) => {
    const { reviews } = point;
    const { processedReviews, percentage } = processReviews({ reviews });


    if (percentage !== null) {
      solveCustomerClaimsPercentage += percentage;
      pointsCounter += 1;
    }

    return { ...point, reviews: processedReviews, solveCustomerClaimsPercentage: Math.round(percentage) };
  });

  let vseStoProcessedReviews;
  let vseStoPercentage;

  if (service.vseStoPoint) {
    const { reviews } = service.vseStoPoint;
    const { processedReviews, percentage } = processReviews({ reviews });

    vseStoPercentage = percentage;
    vseStoProcessedReviews = processedReviews;

    if (percentage !== null) {
      solveCustomerClaimsPercentage += percentage;
      pointsCounter += 1;
    }
  }

  return {
    ...service,
    googleMapsPoints: googleMapsPointsResult,
    vseStoPoint: service.vseStoPoint ? ({
      ...service.vseStoPoint,
      reviews: vseStoProcessedReviews,
      solveCustomerClaimsPercentage: vseStoPercentage !== null ? Math.round(vseStoPercentage) : null,
    }) : null,
    solveCustomerClaimsPercentage: pointsCounter === 0 ? null : Math.round(solveCustomerClaimsPercentage / pointsCounter),
  }
});



fs.writeFileSync('results/customer-feedback-data.json', JSON.stringify(result), 'utf8', () => {});
