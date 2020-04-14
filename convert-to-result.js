const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./results/customer-feedback-data.json', 'utf8'));

const result = data.map((service) => {
  const { googleMapsPoints, vseStoPoint, website, solveCustomerClaimsPercentage, cheatingDetected, specialized, name } = service;

  const {
    points,
    sideServicesRank
  } = googleMapsPoints.reduce((prev, { phone, address, coordinates, workingHours, link, rank }) => {
    const points = [...prev.points];

    if (!prev.points.find(prevPoint => prevPoint.address === address)) {
      points.push({
        address,
        coordinates,
        phone,
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
    phones: [],
    points: [],
    coordinates: [],
    sideServicesRank: []
  });

  if (vseStoPoint) {
    sideServicesRank.push({
      name: 'Vse STO',
      link: vseStoPoint.link,
      rank: vseStoPoint.rank,
    });
  }

  let feedbackWithClientsDirection;
  if (solveCustomerClaimsPercentage === null) feedbackWithClientsDirection = 0;
  if (solveCustomerClaimsPercentage === 0) feedbackWithClientsDirection = -1;
  if (solveCustomerClaimsPercentage > 0) feedbackWithClientsDirection = 1;

  return {
    name,
    pagePath: `/${website}-service`,
    website,
    points,
    sideServicesRank,
    feedbackWithClientsDirection,
    fakeReviews: cheatingDetected,
    forumReviewsDirection: 0,
    specialized,
    mainSpecialties: [""],
    otherSpecialties: [""],
    description: '',
  }
});

fs.writeFileSync('results/result.json', JSON.stringify(result), 'utf8', () => {});
