'use strict'
const JsonResponse = require('../jsonresponse')
const crypto = require('crypto')

class ApiKeyController {
    constructor(store) {
        this.auth = this.auth.bind(this)
        this.store = store
    }

    async list(req, res) {
        JsonResponse.ok(res, await this.store.list())
    }

    async create(req, res) {
        if (req.body.name === undefined || req.body.name.length < 5) {
            JsonResponse.error(res, `parameter name missing or less than 5 chars.`)
            return;
        }
        const apiKey = crypto.randomUUID().replaceAll('-', '')
        const entry = { apiKey: apiKey, name: req.body.name, validUntil: new Date('9999-12-31T23:59:59Z') }
        JsonResponse.ok(res, await this.store.insert(entry))
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
        return (await this.store.get(apiKey)).length > 0
    }
}

module.exports = ApiKeyController