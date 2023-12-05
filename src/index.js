'use strict'
const express = require('express')
const bodyParser = require('body-parser')
require('dotenv').config()

const JsonResponse = require('./jsonresponse');

const SourceDefinitions = require('./provider/sourcedefinitions')
const StoreFactory = require('./store/storefactory')
const RateStorePublisher = require('./publisher/ratestorepublisher')
const XrplTrustlinePublisher = require('./publisher/xrpltrustlinepublisher')

const RateController = require('./controller/ratecontroller');
const ApiKeyController = require('./controller/apikeycontroller');

const app = express()
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

const port = process.env.PORT || 3000
const interval = process.env.PUBLISH_INTERVAL || 60000
const unhealthyAfter = process.env.UNHEALTHY_AFTER === undefined ? 900000 : parseInt(process.env.UNHEALTHY_AFTER);
const adminPwr = process.env.ADMINPWR
if (adminPwr == null) throw new Error('env.ADMINPWR must be defined')

if (process.env.LOG_INFO !== 'true') {
    console.info = function () { };
}

const started = new Date()

const sourceDefinitions = new SourceDefinitions(process.env.FETCH_CURRENCIES === undefined ? [] : process.env.FETCH_CURRENCIES.split(','))
let publishers = []

const xrplTrustlinePublishConfig = process.env.XRPL_TRUSTLINE_PUBLISH_CONFIG === undefined ? [] : JSON.parse(process.env.XRPL_TRUSTLINE_PUBLISH_CONFIG)
for (const c of xrplTrustlinePublishConfig) {
    const p = new XrplTrustlinePublisher(c.endpoint, c.accountPublicKey, c.accountSecret, c.issuerPublicKey)
    p.setMaxFee(c.maxFeeDrops === undefined ? XrplTrustlinePublisher.DefaultMaxFee : parseInt(c.maxFeeDrops))
    p.setPublishCurrencies(new Set(c.publishCurrencies === undefined ? [] : c.publishCurrencies))
    publishers.push(p)
}

const dbInfo = process.env.DB_HOST === undefined || process.env.DB_NAME === undefined
    ? undefined
    : { host: process.env.DB_HOST, dbName: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD }
const store = new StoreFactory(dbInfo).create(process.env.DB_PROVIDER)
const p = new RateStorePublisher(store)
p.setMaxAgeSeconds(process.env.RATESTORE_MAXAGE_SECONDS === undefined ? RateStorePublisher.DefaultMaxAgeSeconds : parseInt(process.env.RATESTORE_MAXAGE_SECONDS))
publishers.push(p)

app.get('/', (req, res) => {
    res.send('Service up and running ☕')
})

const apiKeyController = new ApiKeyController(store.getApiKeyStore())
const rateController = new RateController(store.getRateStore())
const router = express.Router();
app.get('/rate/:id', apiKeyController.auth, (req, res) => { rateController.getRate(req, res) });
app.get('/apikey', (req, res) => { verifyPwr(req, res) ? apiKeyController.list(req, res) : {} });
app.post('/apikey', (req, res) => { verifyPwr(req, res) ? apiKeyController.create(req, res) : {} });
app.get('/health', getHealth)
app.get('/status', (req, res) => { verifyPwr(req, res) ? getStatus(req, res) : {} })
app.use('/', router)

async function initStore() {
    if (dbInfo === undefined) {
        return
    }
    const store = new StoreFactory(dbInfo).create(process.env.DB_PROVIDER)
    if (!await store.initialized()) {
        await store.initialize()
    }
}

async function doWork() {
    const result = await sourceDefinitions.fetchAll()
    if (result.length === 0) {
        return
    }
    for (const publisher of publishers) {
        await publisher.publishAll(result)
    }
}

async function getHealth(req, res) {
    var stats = []
    for (const publisher of publishers) {
        const lastPublished = publisher.getLastPublished()
        const healthy = lastPublished == null || lastPublished.getTime() + unhealthyAfter > new Date().getTime()
        const lastPublishedText = lastPublished == null ? null : lastPublished.toISOString()
        stats.push({ name: publisher.getName(), healthy: healthy, lastPublished: lastPublishedText })
    }

    if (stats.filter(e => !e.healthy).length > 0) {
        res.status(500).send(stats)
    } else {
        res.status(200).send(null)
    }
}
async function getStatus(req, res) {
    var stats = []
    for (const publisher of publishers) {
        stats.push({ name: publisher.getName(), lastPublished: publisher.getLastPublished(), store: await publisher.getStatus() })
    }

    JsonResponse.ok(res, { started: started.toISOString(), publisher: stats })
}
function verifyPwr(req, res) {
    if (req.query.pwr !== adminPwr) {
        JsonResponse.error(res, 'invalid password')
        return false
    }
    return true
}

app.listen(port, async () => {
    console.log(`Started, listening on port ${port}`)
    sourceDefinitions.load()
    await initStore()

    setInterval(function () {
        doWork()
    }, interval)
    doWork()
})