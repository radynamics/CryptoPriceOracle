'use strict'
const mariadb = require('mariadb')
const JsonResponse = require('../jsonresponse')
const Utils = require('../utils')
const crypto = require('crypto')

class ApiKeyController {
    constructor(dbInfo) {
        this.auth = this.auth.bind(this);
        this.pool = mariadb.createPool({ host: dbInfo.host, database: dbInfo.dbName, user: dbInfo.user, password: dbInfo.password, connectionLimit: 5 })
        this.all = []
    }

    async list(req, res) {
        let conn
        try {
            conn = await this.pool.getConnection()
            const result = await conn.query("SELECT * FROM apikey", [])
            JsonResponse.ok(res, this.toList(result))
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.end()
        }
    }
    toList(rows) {
        var result = []
        for (const row of rows) {
            result.push({ apikey: row.ApiKey, name: row.ConsumerName, validuntil: row.ValidUntil })
        }
        return result
    }

    async create(req, res) {
        if (req.body.name === undefined || req.body.name.length < 5) {
            JsonResponse.error(res, `parameter name missing or less than 5 chars.`)
            return;
        }
        const apiKey = crypto.randomUUID().replaceAll('-', '')
        const entry = { apiKey: apiKey, name: req.body.name, validUntil: new Date('9999-12-31T23:59:59Z') }
        await this.insert(entry)
        JsonResponse.ok(res, entry)
    }

    async insert(entry) {
        let conn
        try {
            conn = await this.pool.getConnection()
            let validUntilText = Utils.toMariaDbDateTimeText(entry.validUntil)
            const res = await conn.query("INSERT INTO apikey (ApiKey, ConsumerName, ValidUntil) VALUES (?, ?, ?)", [entry.apiKey, entry.name, validUntilText])
            if (res.affectedRows !== 1) {
                throw new Error(`Inserting entry failed. ${JSON.stringify(entry)}`)
            }
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.end()
        }
    }
    async getByApiKey(apiKey) {
        let conn
        try {
            conn = await this.pool.getConnection()
            const res = await conn.query("SELECT 1 FROM apikey WHERE ApiKey = ?", [apiKey])
            return res
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.end()
        }
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
        return (await this.getByApiKey(apiKey)).length > 0
    }
}

module.exports = ApiKeyController