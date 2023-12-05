'use strict'
const fs = require('fs')
const moment = require('moment')
const ExchangeRateSource = require('./exchangeratesource')
const FxRate = require('../model/fxrate')

class Sources {
    constructor(fetchCcys) {
        this.fetchCcys = fetchCcys
        this.provider = []
        this.sourceError = new Map()
    }

    load() {
        let files = this.getJsonFiles('./provider')
        for (const file of files) {
            const data = fs.readFileSync(file)
            const content = JSON.parse(data.toString())
            if (this.fetchCcys.length === 0 || this.fetchCcys.includes(content.symbol)) {
                this.provider.push(content)
                console.info(`${file} loaded`)
            }
        }
    }

    getJsonFiles(dir, files = []) {
        const fileList = fs.readdirSync(dir).filter(file => file.endsWith('.json'))
        for (const file of fileList) {
            const name = `${dir}/${file}`
            if (fs.statSync(name).isDirectory()) {
                this.getJsonFiles(name, files)
            } else {
                files.push(name)
            }
        }
        return files
    }

    async fetchAll() {
        var promises = []
        for (const p of this.provider) {
            const baseCcy = p.symbol
            for (const q of p.quotes) {
                const quoteCcy = q.symbol
                for (const s of q.sources) {
                    promises.push(this.fetch(baseCcy, quoteCcy, s))
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
    async fetch(baseCcy, quoteCcy, source) {
        const s = new ExchangeRateSource({ base: baseCcy, quote: quoteCcy }, source)
        const key = source.url
        try {
            // Skip if source is paused.
            if (this.sourceError.get(key) !== undefined && this.sourceError.get(key).pausedUntil > new Date()) {
                return
            }

            const rate = await s.get()
            this.sourceError.delete(key)
            return rate === undefined ? undefined : new FxRate(baseCcy, quoteCcy, rate, source.name)
        } catch (e) {
            try {
                // Some sources return errors on api tresholds or are temporary not available.
                this.pause(e, source, key)
            } catch (ef) {
                console.error(ef)
            }
        }
    }
    pause(e, source, key) {
        const PAUSE_MINUTES = 5
        const paused = moment().add(PAUSE_MINUTES, 'minutes').toDate()
        const running = moment().subtract(1, 'seconds').toDate()
        if (this.sourceError.get(key) === undefined) {
            this.sourceError.set(key, { errorCount: 0, pausedUntil: running })
        }

        const se = this.sourceError.get(key)
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
}

module.exports = Sources