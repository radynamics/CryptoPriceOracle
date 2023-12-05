'use strict'
const moment = require('moment')
const ExchangeIdHelper = require('../model/exchangeidhelper');

class DbPublisher {
    static DefaultMaxAgeSeconds = 60 * 60 * 24 * 60
    constructor(dbHandler) {
        this.lastPublished = null
        this.maxAgeSeconds = DbPublisher.DefaultMaxAgeSeconds
        this.dbHandler = dbHandler
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
        await this.dbHandler.insert(rate, exchangeId)
        this.lastPublished = new Date()
    }

    async removeOutdated() {
        var before = moment().subtract(this.maxAgeSeconds, 'seconds').toDate()
        await this.dbHandler.deleteBefore(before)
    }

    async list(baseCcy, quoteCcy, start, end) {
        return await this.dbHandler.list(baseCcy, quoteCcy, start, end)
    }

    async size() {
        return await this.dbHandler.size()
    }

    setMaxAgeSeconds(value) {
        this.maxAgeSeconds = value
    }

    getName() {
        return "DbPublisher"
    }

    getLastPublished() {
        return this.lastPublished
    }

    async getStatus() {
        return { lastPublished: this.getLastPublished(), size: new String(await this.size()) }
    }

    async anyTablePresent() {
        return await this.dbHandler.anyTablePresent()
    }
    async initDb() {
        return await this.dbHandler.initDb()
    }
}

module.exports = DbPublisher