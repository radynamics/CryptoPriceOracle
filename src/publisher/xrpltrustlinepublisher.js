'use strict'
const xrpl = require("xrpl")
const HooksFee = require('./hooksfee')
const moment = require('moment');
const RateController = require('../controller/ratecontroller');
const Utils = require('../utils')

class XrplTrustlinePublisher {
    static DefaultMaxFee = 1010
    constructor(endpoint, accountPublicKey, accountSecret, issuerPublicKey) {
        this.endpoint = endpoint
        this.accountPublicKey = accountPublicKey
        this.accountSecret = accountSecret
        this.issuerPublicKey = issuerPublicKey
        this.rates = new Map()
        this.maxFee = XrplTrustlinePublisher.DefaultMaxFee
        this.lastPublished = null
        this.lastFee = null
        this.submissionsSinceStart = 0
        this.lastError = null
        this.lastErrorOccured = null
        this.publishCurrencies = new Set()
        this.feeProviderId = undefined
    }

    async publishAll(rates) {
        // Ensure all rates at the same time get processed together.
        const key = this.createKey(new Date())
        for (const rate of rates) {
            if (this.publishCurrencies.has(rate.baseCcy)) {
                this.queue(key, rate)
            }
        }
        await this.processQueue()
        console.info(`Queue size ${this.queueSize()}`)
    }
    queue(key, rate) {
        if (!this.exists(key)) {
            this.rates.set(key, new Map())
        }
        const timeEntry = this.rates.get(key)
        const ccyKey = rate.quoteCcy
        if (timeEntry.get(ccyKey) === undefined) {
            timeEntry.set(ccyKey, [])
        }
        timeEntry.get(ccyKey).push(rate)
        this.removeOutdated()
    }

    async processQueue() {
        var transactions = []
        for (let [key, value] of this.rates) {
            for (let [ccyKey, ccyValue] of value) {
                transactions.push(this.createXrplTransaction(ccyKey, ccyValue))
                value.delete(ccyKey)
            }
            this.rates.delete(key);
        }

        const client = new xrpl.Client(this.endpoint)
        await client.connect()
        for (const tx of transactions) {
            await this.publishToXrpl(client, tx)
        }
        await client.disconnect()
    }

    createXrplTransaction(ccy, rates) {
        const limit = Utils.round(RateController.avgRate(rates), 6)
        var memos = []
        for (const rate of rates) {
            memos.push({
                Memo: {
                    MemoData: Utils.utf8ToHex(Utils.round(rate.rate, 6).toString()),
                    MemoFormat: Utils.utf8ToHex("text/csv"),
                    MemoType: Utils.utf8ToHex(`rates:${rate.exchangeName}:${rate.quoteCcy.toLowerCase()}`)
                }
            })
        }

        return {
            TransactionType: "TrustSet",
            Account: this.accountPublicKey,
            LimitAmount: {
                currency: this.getXrplCurrency(ccy),
                issuer: this.issuerPublicKey,
                value: limit.toString()
            },
            Memos: memos
        }
    }

    async publishToXrpl(client, tx) {
        try {
            const accountWallet = xrpl.Wallet.fromSeed(this.accountSecret)
            const prepared = await client.autofill(tx)
            prepared.Fee = await this.estimateFee(client, prepared)
            this.lastFee = new Number(prepared.Fee)
            if (new Number(prepared.Fee) > this.maxFee) {
                console.warn(`Submitting ${tx.LimitAmount.currency} failed. Fee ${prepared.Fee} is over max ${this.maxFee}.`)
                return
            }
            const signed = accountWallet.sign(prepared)
            client.submit(signed.tx_blob)
                .then((result) => {
                    // terQUEUED: "... did not meet the open ledger requirement, so the transaction has been queued for a future ledger."
                    var successResult = ['tesSUCCESS', 'terQUEUED']
                    if (!successResult.includes(result.result.engine_result)) {
                        this.lastError = result.result.engine_result
                        this.lastErrorOccured = new Date()
                        console.warn(`Submitting ${tx.LimitAmount.currency} failed. ${result.result.engine_result}`)
                        return
                    }
                    console.info(`Published ${tx.LimitAmount.currency} to XRPL`)
                    this.lastPublished = new Date()
                    this.submissionsSinceStart++
                })
                .catch(e => {
                    console.error(tx)
                    this.logError(e)
                })
        } catch (e) {
            console.error(tx)
            this.logError(e)
        }
    }

    async estimateFee(client, tx) {
        if (this.feeProviderId === undefined) {
            return tx.Fee
        }

        let provider
        switch (this.feeProviderId) {
            case 'hooksFee': provider = new HooksFee(client); break
            default: throw new Error(`Unknown feeProviderId ${this.feeProviderId}`)
        }

        return await provider.get(tx)
    }

    getXrplCurrency(ccy) {
        return ccy.length <= 3 ? ccy : this.currencyUTF8ToHex(ccy)
    }
    currencyUTF8ToHex(ccy) {
        if (/^[a-zA-Z0-9\?\!\@\#\$\%\^\&\*\<\>\(\)\{\}\[\]\|\]\{\}]{3}$/.test(code)) {
            return code
        }

        if (/^[A-Z0-9]{40}$/.test(code)) {
            return code
        }

        let hex = ''
        for (let i = 0; i < code.length; i++) {
            hex += code.charCodeAt(i).toString(16)
        }
        return hex.toUpperCase().padEnd(40, '0')
    }

    removeOutdated() {
        var before = moment().subtract(2, 'minutes').toDate()
        for (let [key, value] of this.rates) {
            if (key <= before) {
                this.rates.delete(key)
            }
        }
    }

    createKey(dt) {
        let d = new Date(dt)
        d.setSeconds(0)
        d.setMilliseconds(0)
        return d.getTime()
    }

    exists(key) {
        return this.rates.get(key) !== undefined
    }

    queueSize() {
        let count = 0
        for (let [key, value] of this.rates) {
            count += value.size
        }
        return count
    }

    logError(e) {
        this.lastError = e.message
        this.lastErrorOccured = new Date()
        console.error(e)
    }

    setMaxFee(value) {
        this.maxFee = value
    }
    setPublishCurrencies(value) {
        this.publishCurrencies = value
    }

    getName() {
        return "xrplTrustlinePublisher"
    }

    getLastPublished() {
        return this.lastPublished
    }

    setFeeProviderId(value) {
        this.feeProviderId = value
    }

    async getStatus() {
        return {
            endpoint: this.endpoint,
            queueSize: this.queueSize(),
            maxFee: this.maxFee,
            lastFee: this.lastFee,
            submissionsSinceStart: this.submissionsSinceStart,
            accountBalance: await this.getAccountBalance(),
            lastError: this.lastError,
            lastErrorOccured: this.lastErrorOccured
        }
    }
    async getAccountBalance() {
        try {
            const client = new xrpl.Client(this.endpoint)
            await client.connect()
            const response = await client.request({
                command: 'account_info',
                account: this.accountPublicKey,
                ledger_index: "validated"
            })
            await client.disconnect()
            return response.result.account_data.Balance
        } catch (e) {
            this.logError(e)
            return null
        }
    }
}

module.exports = XrplTrustlinePublisher