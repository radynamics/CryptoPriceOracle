'use strict'
const express = require('express')
const fs = require('fs')
const ExchangeRateSource = require('./exchangeratesource')
const FxRate = require('./model/fxrate')
const MemoryStore = require('./publisher/memorystore')
require('dotenv')
const RateController = require('./controller/ratecontroller');
const api = require('./apiauth');

const app = express()
const port = process.env.PORT || 3000
const interval = process.env.PUBLISH_INTERVAL || 60000
let provider = []
const memoryStore = new MemoryStore()
let publishers = [memoryStore]

app.get('/', (req, res) => {
    res.send('Service up and running ☕')
})

const rateController = new RateController(memoryStore)
const router = express.Router();
app.get('/rate/:id', api.auth, (req, res) => { rateController.getRate(req, res) });
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

async function fetchSources() {
    for (const p of provider) {
        const baseCcy = p.symbol
        for (const q of p.quotes) {
            const quoteCcy = q.symbol
            for (const s of q.sources) {
                fetchSource(baseCcy, quoteCcy, s)
            }
        }
    }
}
async function fetchSource(baseCcy, quoteCcy, source) {
    const s = new ExchangeRateSource({ base: baseCcy, quote: quoteCcy }, source)
    try {
        const rate = await s.get()
        if (rate === undefined) {
            return
        }
        publish(new FxRate(baseCcy, quoteCcy, rate, source.name))
    } catch (e) {
        console.error(`Failed getting ${source.url}`)
        console.error(e)
    }
}
function publish(rxRate) {
    for (const publisher of publishers) {
        publisher.publish(rxRate)
    }
}

app.listen(port, () => {
    console.log(`Started, listening on port ${port}`)
    loadProvider()

    setInterval(function () {
        fetchSources()
    }, interval)
    fetchSources()
})