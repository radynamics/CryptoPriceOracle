'use strict'

class RateStore {
    constructor() {
        this.rates = new Map()
    }

    async insert(rate, exchangeId) {
        if (!this.exists(rate.baseCcy)) {
            this.rates.set(rate.baseCcy, [])
        }
        this.rates.get(rate.baseCcy).push(rate)
    }

    async deleteBefore(before) {
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
}

module.exports = RateStore