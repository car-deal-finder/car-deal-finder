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
  let solveCustomerClaimsPercentage = null;

  const googleMapsPointsResult = service.googleMapsPoints.map((point) => {
    const { reviews } = point;
    const { processedReviews, percentage } = processReviews({ reviews });

    if (percentage !== null) solveCustomerClaimsPercentage = (
      (solveCustomerClaimsPercentage === null ? percentage : solveCustomerClaimsPercentage) + percentage
    ) / 2;

    return { ...point, reviews: processedReviews, solveCustomerClaimsPercentage: percentage };
  });

  return { ...service, googleMapsPoints: googleMapsPointsResult, solveCustomerClaimsPercentage };
});

const shortResult = result.reduce((prev, service) => {
  const { solveCustomerClaimsPercentage, googleMapsPoints } = service;

  if (solveCustomerClaimsPercentage === null) return prev;

  return [
    ...prev,
    {
      ...service,
      googleMapsPoints: googleMapsPoints.map(point => ({
        ...point,
        reviews: point.reviews.filter(review => review.rank <= NEGATIVE_RANK_TRESHOLD && review.comment)
      }))
    },
  ]
}, []);

fs.writeFileSync('results/customer-feedback-data-short.json', JSON.stringify(shortResult), 'utf8', () => {});
fs.writeFileSync('results/customer-feedback-data.json', JSON.stringify(result), 'utf8', () => {});
