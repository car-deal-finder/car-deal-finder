const fs = require('fs');

const customerFeedback = JSON.parse(fs.readFileSync('./results/customer-feedback-data.json', 'utf8'));

const result = customerFeedback.map((service) => {
  const {
    googleMapsPoints,
    vseStoPoint,
    website,
    solveCustomerClaimsPercentage,
    cheatingDetected,
    specialized,
    name,
    sideForumsMentions,
    specialties,
  } = service;

  const {
    points: pointsFromGoogleMaps,
    sideServicesRank
  } = googleMapsPoints.reduce((prev, { phone, address, coordinates, workingHours, link, rank, title, reviews }) => {
    const points = [...prev.points];

    if (!prev.points.find(prevPoint => prevPoint.address === address)) {
      points.push({
        address,
        coordinates,
        phones: [phone],
        workingHours,
        title: title ? title : undefined,
      });
    }

    return {
      points,
      sideServicesRank: [
        ...prev.sideServicesRank,
        {
          name: 'Google Maps',
          link,
          rank: rank ? rank.toString() : undefined,
          reviewsAmount: reviews.length,
        },
      ],
    };
  }, {
    points: [],
    sideServicesRank: []
  });

  if (vseStoPoint) {
    sideServicesRank.push({
      name: 'Vse STO',
      link: vseStoPoint.link,
      rank: vseStoPoint.rank ? vseStoPoint.rank.toString() : undefined,
      reviewsAmount: vseStoPoint.reviews.length,
    });
  }

  let pointsFromVseSto = [];

  if (!pointsFromGoogleMaps.length && vseStoPoint) {
    pointsFromVseSto = vseStoPoint.points.map((point) => {
      return ({
        ...point,
        phones: vseStoPoint.phones,
        title: undefined,
        workingHours: [],
      })
    }, pointsFromVseSto)
  }

  let feedbackWithClientsDirection;
  if (solveCustomerClaimsPercentage === null) feedbackWithClientsDirection = -1;
  if (solveCustomerClaimsPercentage === 0) feedbackWithClientsDirection = 0;
  if (solveCustomerClaimsPercentage > 0) feedbackWithClientsDirection = 2;

  return {
    name,
    pagePath: `/${website}-service`,
    website,
    points: pointsFromGoogleMaps.length ? pointsFromGoogleMaps : pointsFromVseSto,
    sideServicesRank,
    feedbackWithClientsDirection,
    solveCustomerClaimsPercentage: solveCustomerClaimsPercentage !== null ? solveCustomerClaimsPercentage : -1,
    fakeReviews: cheatingDetected,
    forumReviewsDirection: 0,
    specialized,
    specialties: specialties || [],
    description: '',
    sideForumsMentions,
  }
});

fs.writeFileSync('results/result.json', JSON.stringify({ list: result }), 'utf8', () => {});
