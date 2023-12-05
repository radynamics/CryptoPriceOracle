'use strict'
const moment = require('moment')

class RateStorePublisher {
    static DefaultMaxAgeSeconds = 60 * 60 * 24 * 60
    constructor(rateStore, exchangeStore) {
        this.lastPublished = null
        this.maxAgeSeconds = RateStorePublisher.DefaultMaxAgeSeconds
        this.rateStore = rateStore
        this.exchangeStore = exchangeStore
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

    async size() {
        return await this.rateStore.size()
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
        return { name: this.rateStore.constructor.name, size: new String(await this.size()) }
    }
}

module.exports = RateStorePublisher