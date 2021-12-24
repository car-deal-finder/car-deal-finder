print('Start #################################################################');

// db = db.getSiblingDB('cars-parser');
db.createUser(
  {
    user: 'user',
    pwd: 'user',
    roles: [{ role: 'readWrite', db: 'cars-parser' }],
  },
);

// db.createCollection('users');


print('END #################################################################');
