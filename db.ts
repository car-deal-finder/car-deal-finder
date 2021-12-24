const mongoose = require('mongoose');

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log('db connected!')
});

mongoose.connect('mongodb://user:user@mongo:27017/cars-parser', { useNewUrlParser: true, useUnifiedTopology: true });


export const AutoRiaBrand = mongoose.model('AutoRiaBrand', { name: String, models: [{ name: String, years: [[Number]] }] });
export const Log = mongoose.model('Log', { link: String, processedAt: String, success: Boolean, retriesAmount: Number, result: String });

export default db;
