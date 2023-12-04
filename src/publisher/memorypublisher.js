'use strict'
const moment = require('moment');

class MemoryPublisher {
    static DefaultMaxAgeSeconds = 3600
    constructor() {
        this.rates = new Map()
        this.lastPublished = null
        this.maxAgeSeconds = MemoryPublisher.DefaultMaxAgeSeconds
    }

    publishAll(rates) {
        for (const fxRate of rates) {
            this.publish(fxRate)
        }
        this.removeOutdated()
    }
    publish(rate) {
        if (!this.exists(rate.baseCcy)) {
            this.rates.set(rate.baseCcy, [])
        }
        this.rates.get(rate.baseCcy).push(rate)
        this.lastPublished = new Date()
    }

    removeOutdated() {
        var before = moment().subtract(this.maxAgeSeconds, 'seconds').toDate()
        for (let [baseCcy, value] of this.rates) {
            this.rates.set(baseCcy, this.rates.get(baseCcy).filter((o) => o.at >= before))
        }
    }

    exists(baseCcy) {
        return this.rates.get(baseCcy) !== undefined
    }

    list(baseCcy, quoteCcy, start, end) {
        if (!this.exists(baseCcy)) {
            return []
        }
        return this.rates.get(baseCcy).filter((o) => o.quoteCcy === quoteCcy && start <= o.at && o.at < end)
    }

    size() {
        var count = 0;
        for (var r of this.rates) {
            count += r[1].length
        }
        return count
    }

    setMaxAgeSeconds(value) {
        this.maxAgeSeconds = value
    }

    getName() {
        return "MemoryPublisher"
    }

    getLastPublished() {
        return this.lastPublished
    }

    async getStatus() {
        return { lastPublished: this.getLastPublished(), size: this.size() }
    }
}

module.exports = MemoryPublisher