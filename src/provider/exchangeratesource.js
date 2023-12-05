'use strict'
const axios = require('axios')
axios.defaults.timeout = process.env.TIMEOUT_SECONDS === undefined ? 15000 : process.env.TIMEOUT_SECONDS * 1000
require('dotenv')

class ExchangeRateSource {
    constructor(ccyPair, source) {
        this.ccyPair = ccyPair
        this.source = source
    }

    async get() {
        const ccyPairText = `${this.ccyPair.base}/${this.ccyPair.quote}`
        const outputText = `Fetching ${ccyPairText} ${this.source.name}...`
        const { data } = await axios.get(this.source.url)
        var quote = this.parseQuote(data, this.source.selector, this.source.invert)
        if (quote === undefined) {
            console.warn(`${outputText} parsing FAILED`)
        } else {
            console.info(`${outputText} got ${quote}`)
        }
        return quote
    }

    parseQuote(data, selector, invert) {
        const element = this.parse(data, selector)
        if (element === undefined) return undefined
        return invert ? 1 / element : element
    }
    parse(data, selector) {
        if (selector == null) return undefined
        if (data == null) return undefined
        let value = eval(selector)
        return Number(value) || undefined
    }
}

module.exports = ExchangeRateSource