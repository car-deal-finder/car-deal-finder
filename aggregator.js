const fs = require('fs');
const moment = require('moment');
const _ = require('lodash');
const { PUBLICATION_DATE_FRAMES } = require('./helpers');

const DAYS_DICT = {
  'понедельник': 'monday',
  'вторник': 'tuesday',
  'среда': 'wednesday',
  'четверг': 'thursday',
  'пятница': 'friday',
  'суббота': 'saturday',
  'воскресенье': 'sunday'
};

const PUBLICATION_DATE_DICT = {
  'только что': PUBLICATION_DATE_FRAMES[0],
  'минуту': PUBLICATION_DATE_FRAMES[0],
  'минуты': PUBLICATION_DATE_FRAMES[0],
  'минут': PUBLICATION_DATE_FRAMES[0],
  'час': PUBLICATION_DATE_FRAMES[0],
  'часов': PUBLICATION_DATE_FRAMES[0],
  'часа': PUBLICATION_DATE_FRAMES[0],
  'день': PUBLICATION_DATE_FRAMES[0],
  'вчера': PUBLICATION_DATE_FRAMES[0],
  'дня': PUBLICATION_DATE_FRAMES[0],
  'дней': PUBLICATION_DATE_FRAMES[0],
  'неделю': PUBLICATION_DATE_FRAMES[1],
  'недели': PUBLICATION_DATE_FRAMES[1],
  'недель': PUBLICATION_DATE_FRAMES[1],
  'месяц': PUBLICATION_DATE_FRAMES[2],
  'месяца': PUBLICATION_DATE_FRAMES[2],
  'месяцев': PUBLICATION_DATE_FRAMES[2],
};

const PUBLICATION_DATE_WITHOUT_NUMBERS_DICT = {
  'только что': 0,
  'минуту': 0,
  'час': 0,
  'день': 1,
  'вчера': 1,
  'неделю': 1,
  'месяц': 1
};

const googleMapsData = JSON.parse(fs.readFileSync('./results/google-maps-data-result.json', 'utf8'));
const vseStoData = JSON.parse(fs.readFileSync('./results/vse-sto-data-result.json', 'utf8'));
const specializedData = JSON.parse(fs.readFileSync('./results/specialized-data-result.json', 'utf8'));
const namesData = JSON.parse(fs.readFileSync('./results/names-data.json', 'utf8'));
const sideForumsData = JSON.parse(fs.readFileSync('./results/side-forums-data.json', 'utf8'));

const convertGoogleMapsWorkingHours = ({ times, day }) => {
  const timeArr = times.map(time => {
    const timeSplited = time.split('–');

    return ({
      from: timeSplited[0],
      to: timeSplited[1],
    });
  });

  const daysDictKeys = Object.keys(DAYS_DICT);

  const result = {
    day: DAYS_DICT[day],
    time: timeArr.sort((a, b) => {
      let day1 = a.day.toLowerCase();
      let day2 = b.day.toLowerCase();
      return daysDictKeys.indexOf(day1) - daysDictKeys.indexOf(day2);
    })
  };

  return result;
};

const convertGoogleMapsPublicationDate = ({ date, scrappedDate }) => {
  let amount;
  let convertedFrame;
  const dateFrames = {};

  const slicedDate = date.replace(' назад', '');

  const amountWithoutNumbers = PUBLICATION_DATE_WITHOUT_NUMBERS_DICT[slicedDate];

  if (amountWithoutNumbers) {
    amount = amountWithoutNumbers;
    convertedFrame = PUBLICATION_DATE_DICT[slicedDate];
  } else {
    [amount, frame] = slicedDate.split(/\s+/);
    convertedFrame = PUBLICATION_DATE_DICT[frame];
  }

  const approximateDate = moment(scrappedDate).subtract(amount, convertedFrame);

  const frameIndex = PUBLICATION_DATE_FRAMES.indexOf(convertedFrame);
  const maxIteration = PUBLICATION_DATE_FRAMES.length - frameIndex;

  for (let i = 0; i < maxIteration; i++) {
    const index = PUBLICATION_DATE_FRAMES.length - maxIteration + i;
    const frame = PUBLICATION_DATE_FRAMES[index];
    const frameSingular = frame.slice(0, -1);

    dateFrames[frame] = {
      from: moment(approximateDate).startOf(frameSingular).format(),
      to: moment(approximateDate).endOf(frameSingular).format(),
    }
  }

  return {
    date: approximateDate.format(),
    dateFrames,
  };
};

const convertGoogleMapsAuthorReviews = ({ reviews, scrappedDate }) => {
  return reviews.map(review => ({
    rank: parseFloat(review.rank.trim().slice(0, 1)),
    ...convertGoogleMapsPublicationDate({ date: review.date, scrappedDate }),
  }))
}

const convertGoogleMapsAuthorData = ({ authorData, scrappedDate }) => {
  return {
    ...authorData,
    reviews: convertGoogleMapsAuthorReviews({ reviews: authorData.reviews, scrappedDate })
  }
}

const convertGoogleMapsReview = ({ review, scrappedDate }) => {
  const convertedDate = convertGoogleMapsPublicationDate({ date: review.date, scrappedDate });

  return {
    ...review,
    rank: parseFloat(review.rank.trim().slice(0, 1)),
    authorData: review.authorData ? convertGoogleMapsAuthorData({ authorData: review.authorData, scrappedDate }) : null,
    ...convertedDate,
  }
};

const getWorkingHours = ({ workingHours }) => {
  const daysArr = Object.keys(DAYS_DICT);

  const arr = workingHours
    .filter(o => !o.times.includes('Закрыто'))
    .sort((a, b) => daysArr.indexOf(a.day) - daysArr.indexOf(b.day))
    .map(workingHours => convertGoogleMapsWorkingHours(workingHours));

  const groups = _.groupBy(arr, ({ time }) => {
    return JSON.stringify(time);
  });

  return Object.keys(groups).reduce((prev, groupKey) => {
    const group = groups[groupKey];

    const dayFrame = group.length > 1 ? `${group[0].day}To${_.capitalize(group[group.length - 1].day)}` : group[0].day;
    const time = group[0].time;

    return [ ...prev, { day: dayFrame, time }]
  }, []);
};

const getGoogleMapsData = ({ googleMapsItem, scrappedDate }) => {
  const {
    website,
    points,
  } = googleMapsItem;

  const googleMapsPoints = points.map(point => {
    const {
      rate,
      coordinates,
      link,
      phone,
      address,
    } = point;
    return {
      rank: rate ? parseFloat(rate.replace(',', '.')) : null,
      coordinates,
      link,
      phone,
      address,
      workingHours: getWorkingHours({ workingHours: point.workingHours }),
      reviews: point.reviews.map(review => convertGoogleMapsReview({ review, scrappedDate }))
    };
  });

  return {
    googleMapsPoints,
    website,
  };
};

const convertVseStoReview = ({ review }) => {
  const date = moment(review.date, 'DD.MM.YYYY');

  const dateFrames = PUBLICATION_DATE_FRAMES.reduce((prev, frame) => {
    const singularFrame = frame.slice(0, -1);
    return {
      ...prev,
      [frame]: {
        from: moment(date).startOf(singularFrame).format(),
        to: moment(date).endOf(singularFrame).format()
      },
    };
  }, {});

  return {
    comment: review.comment,
    date: date.format(),
    rank: parseFloat(review.rate),
    response: review.response,
    dateFrames,
  };
};

const getVseStoData = ({ vseStoItem }) => {
  return {
    website: vseStoItem.website,
    link: vseStoItem.data.link,
    rank: parseFloat(vseStoItem.data.rate),
    reviews: vseStoItem.data.reviews.map(review => convertVseStoReview({ review })),
    title: vseStoItem.data.title,
  }
};

const result = googleMapsData.data.map(googleMapsItem => {
  const specializedItem = specializedData.find(o => o.website === googleMapsItem.website);
  const vseStoItem = vseStoData.find(o => o.website === googleMapsItem.website);
  const namesItem = namesData.find(o => o.website === googleMapsItem.website);
  const sideForumsItem = sideForumsData.find(o => o.website === googleMapsItem.website);

  const convertedGoogleMapsData = getGoogleMapsData({ googleMapsItem, scrappedDate: googleMapsData.date });

  const convertedVseStoData = (vseStoItem && vseStoItem.data) ? getVseStoData({ vseStoItem }) : null;

  return {
    ...convertedGoogleMapsData,
    ...specializedItem.data,
    vseStoPoint: convertedVseStoData,
    name: namesItem.name,
    sideForumsMentions: sideForumsItem.data,
  }
});

fs.writeFileSync('results/aggregated-data.json', JSON.stringify(result), 'utf8', () => {});
fs.writeFileSync('results/aggregated-data-short.json', JSON.stringify(result.slice(0, 5)), 'utf8', () => {});
