import express from 'express';
import { AutoRiaBrand, Log } from './db';

const app = express()
const port = 2000;

app.get('/status', async (req, res) => {
  const brands = await AutoRiaBrand.find();
  const logs = await Log.find();

  const brandsAmount = brands.length;
  let modelsAmount = 0;

  brands.forEach(brand => modelsAmount += brand.models.length);

  res.send({
    brandsAmount,
    modelsAmount,
    itemsParsed: logs.length
  })
})

app.get('/status', (req, res) => {
  res.send('Hello World!')
});


app.listen(port, () => {
  console.log(`status endpoint listening at http://localhost:${port}`)
})
