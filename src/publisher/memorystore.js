'use strict'

class MemoryStore {
    constructor() {
        this.rates = new Map()
        this.lastPublished = null
    }

    publishAll(rates) {
        for (const fxRate of rates) {
            this.publish(fxRate)
        }
    }
    publish(rate) {
        if (!this.exists(rate.baseCcy)) {
            this.rates.set(rate.baseCcy, [])
        }
        this.rates.get(rate.baseCcy).push(rate)
        this.lastPublished = new Date()
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

    getName() {
        return "MemoryStore"
    }

    getLastPublished() {
        return this.lastPublished
    }

    async getStatus() {
        return { lastPublished: this.getLastPublished(), size: this.size() }
    }
}

module.exports = MemoryStore