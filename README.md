# Logic description

Scaning process starts each N minutes. During this process - all new cars which appears after the previous scaning process - will be processed, prices will be analyzed, and results will be sent to the notificator (Telegram cahannel)

# Modules description

`parser` - main controller, fetch car's data send them to the `analyzer` create object with analyze results and send it to the `notificator`
<br />
<br />
`platform` - implementations of web scrapper for concrete platforms. Instance of each platform-scrapper then injected as a dependency to the `parser`
<br />
<br />
`platform/CarDataFetcher` - fetch car's data from car page
<br />
`platform/PriceStatisticFetcher` - it receive car data (brand, model, year, engine ...) and fetch prices for the similar cars which currently in sale
<br />
`platform/PlatformMetaDataFetcher` - it fetch all car's brands and all brand's models on current platform
<br />
<br />
`notificator` - contains logic of sending notifications (currently Telegram bot) with analyze results
<br />
`logger` - save logs with the status of the processing of each car
<br />
`parse-all-models.ts` - script which should be run once - fetch all yars of production of each car model (used by scrapper to find year of production of certain car)  
<br />
`Exchanger` - In development. Module to automatically create trade suggestions
<br />
<br />
`MongoDB` used as a logs and years of production storage

# How to run

`npm run parse-models` - Run only once or after whipe of DB. Wait untill it will fetch all model's years of production.
<br />
`npm run start` - Start process of scrapping and analyzes
