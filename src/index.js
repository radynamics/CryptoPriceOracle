'use strict'
const express = require('express')
const fs = require('fs')
const ExchangeRateSource = require('./exchangeratesource')
const FxRate = require('./model/fxrate')
const MemoryStore = require('./publisher/memorystore')
const XrplTrustlineStore = require('./publisher/xrpltrustlinestore')
require('dotenv').config()
const RateController = require('./controller/ratecontroller');
const api = require('./apiauth');
const JsonResponse = require('./jsonresponse');
const MariaDbStore = require('./publisher/mariadbstore')

const app = express()
const port = process.env.PORT || 3000
const interval = process.env.PUBLISH_INTERVAL || 60000
const unhealthyAfter = process.env.UNHEALTHY_AFTER === undefined ? 900000 : parseInt(process.env.UNHEALTHY_AFTER);
const adminPwr = process.env.ADMINPWR
if (adminPwr == null) throw new Error('env.ADMINPWR must be defined')
const started = new Date()
let provider = []
const memoryStore = new MemoryStore()
memoryStore.setMaxAgeSeconds(process.env.MEMORYSTORE_MAXAGE_SECONDS === undefined ? MemoryStore.DefaultMaxAgeSeconds : parseInt(process.env.MEMORYSTORE_MAXAGE_SECONDS))
const xrplTrustlineStore = new XrplTrustlineStore(process.env.ENDPOINT, process.env.XRPL_ACCOUNT_PUBLICKEY, process.env.XRPL_ACCOUNT_SECRET, process.env.XRPL_ISSUER_PUBLICKEY);
xrplTrustlineStore.setMaxFee(process.env.MAX_FEE_DROPS === undefined ? XrplTrustlineStore.DefaultMaxFee : parseInt(process.env.MAX_FEE_DROPS))
let mariaDbStore = new MariaDbStore(process.env.DB_HOST, process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD)
mariaDbStore.setMaxAgeSeconds(process.env.MARIADBSTORE_MAXAGE_SECONDS === undefined ? MariaDbStore.DefaultMaxAgeSeconds : parseInt(process.env.MARIADBSTORE_MAXAGE_SECONDS))
let publishers = [mariaDbStore, xrplTrustlineStore]

app.get('/', (req, res) => {
    res.send('Service up and running ☕')
})

const rateController = new RateController(mariaDbStore)
const router = express.Router();
app.get('/rate/:id', api.auth, (req, res) => { rateController.getRate(req, res) });
app.get('/health', getHealth)
app.get('/status', getStatus)
app.use('/', router)

function loadProvider() {
    let files = getJsonFiles('./provider')
    for (const file of files) {
        const data = fs.readFileSync(file);
        provider.push(JSON.parse(data.toString()))
        console.info(`${file} loaded`)
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
async function initDb() {
    if (!await mariaDbStore.anyTablePresent()) {
        await mariaDbStore.initDb()
    }
}

async function doWork() {
    const result = await fetchSources()
    if (result.length === 0) {
        return
    }
    for (const publisher of publishers) {
        publisher.publishAll(result)
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
    try {
        const rate = await s.get()
        return rate === undefined ? undefined : new FxRate(baseCcy, quoteCcy, rate, source.name)
    } catch (e) {
        console.error(`Failed getting ${source.url}`)
        console.error(e)
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
    if (!verifyPwr(req, res)) return
    var stats = []
    for (const publisher of publishers) {
        stats.push({ name: publisher.getName(), status: await publisher.getStatus() })
    }

    JsonResponse.ok(res, { started: started.toISOString(), provider: stats })
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
    await initDb()

    setInterval(function () {
        doWork()
    }, interval)
    doWork()
})