'use strict'

class FxRate {
    constructor(baseCcy, quoteCcy, rate, exchangeName) {
        this.baseCcy = baseCcy
        this.quoteCcy = quoteCcy
        this.rate = rate
        this.exchangeName = exchangeName
        this.at = new Date()
    }
}

module.exports = FxRate