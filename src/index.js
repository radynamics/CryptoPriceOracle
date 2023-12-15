'use strict'
const express = require('express')
const bodyParser = require('body-parser')
require('dotenv').config()

const SourceDefinitions = require('./provider/sourcedefinitions')
const StoreFactory = require('./store/storefactory')
const MemoryRateStore = require('./store/memory/ratestore')
const RateStorePublisher = require('./publisher/ratestorepublisher')
const XrplTrustlinePublisher = require('./publisher/xrpltrustlinepublisher')

const RateController = require('./controller/ratecontroller');
const ApiKeyController = require('./controller/apikeycontroller');
const HealthController = require('./controller/healthcontroller')
const StatusController = require('./controller/statuscontroller')

const app = express()
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

const port = process.env.PORT || 3000
const interval = process.env.PUBLISH_INTERVAL || 60000
const adminPwr = process.env.ADMINPWR
if (adminPwr == null) throw new Error('env.ADMINPWR must be defined')

if (process.env.LOG_INFO !== 'true') {
    console.info = function () { };
}

const sourceDefinitions = new SourceDefinitions(process.env.FETCH_CURRENCIES === undefined ? [] : process.env.FETCH_CURRENCIES.split(','))
let publishers = []

const xrplTrustlinePublishConfig = process.env.XRPL_TRUSTLINE_PUBLISH_CONFIG === undefined ? [] : JSON.parse(process.env.XRPL_TRUSTLINE_PUBLISH_CONFIG)
for (const c of xrplTrustlinePublishConfig) {
    const p = new XrplTrustlinePublisher(c.endpoint, c.accountPublicKey, c.accountSecret, c.issuerPublicKey)
    p.setMaxFee(c.maxFeeDrops === undefined ? XrplTrustlinePublisher.DefaultMaxFee : parseInt(c.maxFeeDrops))
    p.setPublishCurrencies(new Set(c.publishCurrencies === undefined ? [] : c.publishCurrencies))
    p.setFeeProviderId(c.feeProvider)
    publishers.push(p)
}

const dbInfo = process.env.DB_PROVIDER === undefined || process.env.DB_HOST === undefined || process.env.DB_NAME === undefined
    ? undefined
    : { host: process.env.DB_HOST, dbName: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD }
const store = new StoreFactory(dbInfo).create(process.env.DB_PROVIDER)
const p = new RateStorePublisher(store)
let rateStoreMaxAge = dbInfo === undefined ? MemoryRateStore.DefaultMaxAgeSeconds : RateStorePublisher.DefaultMaxAgeSeconds
if (process.env.RATESTORE_MAXAGE_SECONDS !== undefined) {
    rateStoreMaxAge = parseInt(process.env.RATESTORE_MAXAGE_SECONDS)
}
p.setMaxAgeSeconds(rateStoreMaxAge)
publishers.push(p)

const apiKeyController = new ApiKeyController(store.getApiKeyStore(), adminPwr)
apiKeyController.setAdditionalKeys(process.env.APIKEYS === undefined ? [] : process.env.APIKEYS.split(','))
const rateController = new RateController(store.getRateStore())
const healthController = new HealthController(publishers, process.env.UNHEALTHY_AFTER === undefined ? 900000 : parseInt(process.env.UNHEALTHY_AFTER))
const statusController = new StatusController(publishers, new Date())

const router = express.Router();
app.get('/rate/:id', apiKeyController.auth, (req, res) => { rateController.getRate(req, res) });
app.get('/apikey', apiKeyController.authAdminPwr, (req, res) => { apiKeyController.list(req, res) });
app.post('/apikey', apiKeyController.authAdminPwr, (req, res) => { apiKeyController.create(req, res) });
app.get('/health', (req, res) => { healthController.get(req, res) })
app.get('/status', apiKeyController.authAdminPwr, (req, res) => { statusController.get(req, res) })
app.use('/', router)
app.get('/', (req, res) => { res.send('Service up and running ☕') })

async function doWork() {
    let result = []
    try {
        result = await sourceDefinitions.fetchAll()
    } catch (e) {
        console.error(e)
    }

    if (result.length === 0) {
        return
    }

    for (const publisher of publishers) {
        try {
            await publisher.publishAll(result)
        } catch (e) {
            console.error(e)
        }
    }
}

app.listen(port, async () => {
    console.log(`Started, listening on port ${port}`)
    sourceDefinitions.load()
    if (!await store.initialized()) {
        await store.initialize()
    }

    setInterval(function () {
        doWork()
    }, interval)
    doWork()
})