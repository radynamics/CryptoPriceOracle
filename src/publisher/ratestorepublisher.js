'use strict'
const moment = require('moment')

class RateStorePublisher {
    static DefaultMaxAgeSeconds = 60 * 60 * 24 * 60
    constructor(store) {
        this.store = store
        this.lastPublished = null
        this.maxAgeSeconds = RateStorePublisher.DefaultMaxAgeSeconds
        this.rateStore = this.store.getRateStore()
        this.exchangeStore = this.store.getExchangeStore()
    }

    async publishAll(rates) {
        for (const rate of rates) {
            await this.insert(rate)
        }
        this.removeOutdated()
    }
    async insert(rate) {
        let exchange = await this.exchangeStore.get(rate.exchangeName)
        if (exchange === undefined) {
            exchange = await this.exchangeStore.insert(rate.exchangeName)
        }
        await this.rateStore.insert(rate, exchange.id)
        this.lastPublished = new Date()
    }

    async removeOutdated() {
        var before = moment().subtract(this.maxAgeSeconds, 'seconds').toDate()
        await this.rateStore.deleteBefore(before)
    }

    async list(baseCcy, quoteCcy, start, end) {
        return await this.rateStore.list(baseCcy, quoteCcy, start, end)
    }

    setMaxAgeSeconds(value) {
        this.maxAgeSeconds = value
    }

    getName() {
        return "RateStorePublisher"
    }

    getLastPublished() {
        return this.lastPublished
    }

    async getStatus() {
        return { name: this.store.getName(), rateCount: new String(await this.rateStore.count()) }
    }
}

module.exports = RateStorePublisher