'use strict'
const express = require('express')
const bodyParser = require('body-parser')
const fs = require('fs')
require('dotenv').config()
const moment = require('moment')

const ExchangeRateSource = require('./exchangeratesource')
const FxRate = require('./model/fxrate')
const JsonResponse = require('./jsonresponse');

const MemoryRateStore = require('./store/memoryratestore')
const MemoryApiKeyStore = require('./store/memoryapikeystore')
const MemoryExchangeStore = require('./store/memoryexchangestore')
const MariaDbRateStore = require('./store/mariadbratestore')
const MariaDbApiKeyStore = require('./store/mariadbapikeystore')
const MariaDbExchangeStore = require('./store/mariadbexchangestore')
const PostgresDbRateStore = require('./store/postgresdbratestore')
const PostgresDbApiKeyStore = require('./store/postgresdbapikeystore')
const PostgresDbExchangeStore = require('./store/postgresdbexchangestore')

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
const fetchCcys = process.env.FETCH_CURRENCIES === undefined ? [] : process.env.FETCH_CURRENCIES.split(',')

if (process.env.LOG_INFO !== 'true') {
    console.info = function () { };
}

const started = new Date()

let provider = []
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
const rateStore = createRateStore(dbInfo)
const p = new RateStorePublisher(rateStore, createExchangeStore(dbInfo))
p.setMaxAgeSeconds(process.env.RATESTORE_MAXAGE_SECONDS === undefined ? RateStorePublisher.DefaultMaxAgeSeconds : parseInt(process.env.RATESTORE_MAXAGE_SECONDS))
publishers.push(p)
const apiKeyStore = createKeyStoreDbProvider(dbInfo)

let sourceError = new Map()

app.get('/', (req, res) => {
    res.send('Service up and running ☕')
})

const apiKeyController = new ApiKeyController(apiKeyStore)
const rateController = new RateController(rateStore)
const router = express.Router();
app.get('/rate/:id', apiKeyController.auth, (req, res) => { rateController.getRate(req, res) });
app.get('/apikey', (req, res) => { verifyPwr(req, res) ? apiKeyController.list(req, res) : {} });
app.post('/apikey', (req, res) => { verifyPwr(req, res) ? apiKeyController.create(req, res) : {} });
app.get('/health', getHealth)
app.get('/status', (req, res) => { verifyPwr(req, res) ? getStatus(req, res) : {} })
app.use('/', router)

function createRateStore(dbInfo) {
    if (dbInfo === undefined) {
        return new MemoryRateStore()
    }
    switch (process.env.DB_PROVIDER) {
        case 'mariadb': return new MariaDbRateStore(dbInfo)
        case 'postgres': return new PostgresDbRateStore(dbInfo)
        default: throw new Error(`env.DB_PROVIDER ${env.DB_PROVIDER} is unknown.`)
    }
}
function createExchangeStore(dbInfo) {
    if (dbInfo === undefined) {
        return new MemoryExchangeStore()
    }
    switch (process.env.DB_PROVIDER) {
        case 'mariadb': return new MariaDbExchangeStore(dbInfo)
        case 'postgres': return new PostgresDbExchangeStore(dbInfo)
        default: throw new Error(`env.DB_PROVIDER ${env.DB_PROVIDER} is unknown.`)
    }
}
function createKeyStoreDbProvider(dbInfo) {
    if (dbInfo === undefined) {
        return new MemoryApiKeyStore()
    }
    switch (process.env.DB_PROVIDER) {
        case 'mariadb': return new MariaDbApiKeyStore(dbInfo)
        case 'postgres': return new PostgresDbApiKeyStore(dbInfo)
        default: throw new Error(`env.DB_PROVIDER ${env.DB_PROVIDER} is unknown.`)
    }
}
function loadProvider() {
    let files = getJsonFiles('./provider')
    for (const file of files) {
        const data = fs.readFileSync(file)
        const content = JSON.parse(data.toString())
        if (fetchCcys.length === 0 || fetchCcys.includes(content.symbol)) {
            provider.push(content)
            console.info(`${file} loaded`)
        }
    }
}
function getJsonFiles(dir, files = []) {
    const fileList = fs.readdirSync(dir).filter(file => file.endsWith('.json'))
    for (const file of fileList) {
        const name = `${dir}/${file}`
        if (fs.statSync(name).isDirectory()) {
            getFiles(name, files)
        } else {
            files.push(name)
        }
    }
    return files
}
async function initStore() {
    if (dbInfo === undefined) {
        return
    }
    const store = createRateStore(dbInfo)
    if (!await store.initialized()) {
        await store.initialize()
    }
}

async function doWork() {
    const result = await fetchSources()
    if (result.length === 0) {
        return
    }
    for (const publisher of publishers) {
        await publisher.publishAll(result)
    }
}

async function fetchSources() {
    var promises = []
    for (const p of provider) {
        const baseCcy = p.symbol
        for (const q of p.quotes) {
            const quoteCcy = q.symbol
            for (const s of q.sources) {
                promises.push(fetchSource(baseCcy, quoteCcy, s))
            }
        }
    }

    var result = []
    for (const r of await Promise.allSettled(promises)) {
        if (r.status === 'fulfilled') {
            if (r.value !== undefined) {
                result.push(r.value)
            }
        }
    }
    return result
}
async function fetchSource(baseCcy, quoteCcy, source) {
    const s = new ExchangeRateSource({ base: baseCcy, quote: quoteCcy }, source)
    const key = source.url
    try {
        // Skip if source is paused.
        if (sourceError.get(key) !== undefined && sourceError.get(key).pausedUntil > new Date()) {
            return
        }

        const rate = await s.get()
        sourceError.delete(key)
        return rate === undefined ? undefined : new FxRate(baseCcy, quoteCcy, rate, source.name)
    } catch (e) {
        try {
            // Some sources return errors on api tresholds or are temporary not available.
            pauseSource(e, source, key)
        } catch (ef) {
            console.error(ef)
        }
    }
}
function pauseSource(e, source, key) {
    const PAUSE_MINUTES = 5
    const paused = moment().add(PAUSE_MINUTES, 'minutes').toDate()
    const running = moment().subtract(1, 'seconds').toDate()
    if (sourceError.get(key) === undefined) {
        sourceError.set(key, { errorCount: 0, pausedUntil: running })
    }

    const se = sourceError.get(key)
    se.errorCount += 1
    const THRESHOLD = 3
    if (se.errorCount > THRESHOLD) {
        se.pausedUntil = paused
        console.error(`Failed getting ${source.url}. Source paused for ${PAUSE_MINUTES} min after ${THRESHOLD} errors in a row.`)
        console.error(e)
    }
    console.info(`Failed getting ${source.url} for ${se.errorCount} times.`)
    console.info(e)
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
    loadProvider()
    await initStore()

    setInterval(function () {
        doWork()
    }, interval)
    doWork()
})