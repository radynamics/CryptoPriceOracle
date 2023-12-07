'use strict'
const JsonResponse = require('../jsonresponse')
const crypto = require('crypto')

class ApiKeyController {
    constructor(store, adminPwr) {
        this.store = store
        this.adminPwr = adminPwr
        this.auth = this.auth.bind(this)
        this.authAdminPwr = this.authAdminPwr.bind(this)
        this.additionalKeys = []
    }

    async list(req, res) {
        let list = await this.store.list()
        for (var apiKey of this.additionalKeys) {
            list.push(this.createEntry(apiKey, "predefined"))
        }
        JsonResponse.ok(res, list)
    }

    async create(req, res) {
        if (req.body.name === undefined || req.body.name.length < 5) {
            JsonResponse.error(res, `parameter name missing or less than 5 chars.`)
            return;
        }
        const apiKey = crypto.randomUUID().replaceAll('-', '')
        const entry = this.createEntry(apiKey, req.body.name)
        await this.store.insert(entry)
        JsonResponse.ok(res, entry)
    }

    createEntry(apiKey, name) {
        return { apiKey: apiKey, name: name, validUntil: new Date('9999-12-31T23:59:59Z') }
    }

    async authAdminPwr(req, res, next) {
        if (req.query.pwr !== this.adminPwr) {
            JsonResponse.error(res, 'invalid password')
            return
        }
        next()
    }

    async auth(req, res, next) {
        let apiKey = req.header('x-api-key')
        if (!await this.valid(apiKey)) {
            JsonResponse.error(res.status(403), 'x-api-key missing or invalid')
            return
        }
        next()
    }

    async valid(apiKey) {
        if (apiKey === undefined || apiKey.length === 0) {
            return false
        }
        if (this.additionalKeys.includes(apiKey)) {
            return true
        }
        return (await this.store.get(apiKey)) !== null
    }

    setAdditionalKeys(values) {
        this.additionalKeys = values
    }
}

module.exports = ApiKeyController