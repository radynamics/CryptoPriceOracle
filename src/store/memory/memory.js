'use strict'
const RateStore = require('./ratestore')
const ApiKeyStore = require('./apikeystore')
const ExchangeStore = require('./exchangestore')

class Memory {
    constructor() {
        this.rateStore = new RateStore()
        this.apiKeyStore = new ApiKeyStore()
        this.exchangeStore = new ExchangeStore()
    }

    getRateStore() {
        return this.rateStore
    }
    getApiKeyStore() {
        return this.apiKeyStore
    }
    getExchangeStore() {
        return this.exchangeStore
    }

    getName() {
        return "memory"
    }

    initialized() {
        return true
    }

    initialize() {
    }
}

module.exports = Memory