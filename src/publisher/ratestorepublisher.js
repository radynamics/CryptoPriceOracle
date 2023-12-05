'use strict'
const moment = require('moment')
const ExchangeIdHelper = require('../model/exchangeidhelper');

class RateStorePublisher {
    static DefaultMaxAgeSeconds = 60 * 60 * 24 * 60
    constructor(store) {
        this.lastPublished = null
        this.maxAgeSeconds = RateStorePublisher.DefaultMaxAgeSeconds
        this.store = store
    }

    publishAll(rates) {
        for (const rate of rates) {
            this.insert(rate)
        }
        this.removeOutdated()
    }
    async insert(rate) {
        const exchangeId = ExchangeIdHelper.toId(rate.exchangeName)
        if (exchangeId === ExchangeIdHelper.unknown) {
            console.warn(`Exchange ${rate.exchangeName} is unknown.`)
        }
        await this.store.insert(rate, exchangeId)
        this.lastPublished = new Date()
    }

    async removeOutdated() {
        var before = moment().subtract(this.maxAgeSeconds, 'seconds').toDate()
        await this.store.deleteBefore(before)
    }

    async list(baseCcy, quoteCcy, start, end) {
        return await this.store.list(baseCcy, quoteCcy, start, end)
    }

    async size() {
        return await this.store.size()
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
        return { lastPublished: this.getLastPublished(), size: new String(await this.size()) }
    }

    async anyTablePresent() {
        return await this.store.anyTablePresent()
    }
    async initDb() {
        return await this.store.initDb()
    }
}

module.exports = RateStorePublisher