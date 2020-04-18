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
    sideForumsMentions
  } = service;

  const {
    points: pointsFromGoogleMaps,
    sideServicesRank
  } = googleMapsPoints.reduce((prev, { phone, address, coordinates, workingHours, link, rank }) => {
    const points = [...prev.points];

    if (!prev.points.find(prevPoint => prevPoint.address === address)) {
      points.push({
        address,
        coordinates,
        phones: [phone],
        workingHours,
      });
    }

    return {
      points,
      sideServicesRank: [
        ...prev.sideServicesRank,
        {
          name: 'Google Maps',
          link,
          rank,
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
      rank: vseStoPoint.rank,
    });
  }

  let pointsFromVseSto = [];

  if (!pointsFromGoogleMaps.length) {
    pointsFromVseSto = vseStoPoint.points.reduce((point) => ({
      ...point,
      phones: point.phones,
      workingHours: [],
    }), pointsFromVseSto)
  }

  let feedbackWithClientsDirection;
  if (solveCustomerClaimsPercentage === null) feedbackWithClientsDirection = 0;
  if (solveCustomerClaimsPercentage === 0) feedbackWithClientsDirection = -1;
  if (solveCustomerClaimsPercentage > 0) feedbackWithClientsDirection = 1;

  return {
    name,
    pagePath: `/${website}-service`,
    website,
    points: pointsFromGoogleMaps.length ? pointsFromGoogleMaps : pointsFromVseSto,
    sideServicesRank,
    feedbackWithClientsDirection,
    fakeReviews: cheatingDetected,
    forumReviewsDirection: 0,
    specialized,
    mainSpecialties: [""],
    otherSpecialties: [""],
    description: '',
    sideForumsMentions,
  }
});

fs.writeFileSync('results/result.json', JSON.stringify(result), 'utf8', () => {});
