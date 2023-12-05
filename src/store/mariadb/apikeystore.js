'use strict'
const Utils = require('../../utils')

class ApiKeyStore {
    constructor(pool) {
        this.pool = pool
    }

    async list() {
        let conn
        try {
            conn = await this.pool.getConnection()
            const result = await conn.query("SELECT * FROM apikey", [])
            return this.toList(result)
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.end()
        }
    }
    toList(rows) {
        var result = []
        for (const row of rows) {
            result.push({ apikey: row.apiKey, name: row.consumerName, validuntil: Utils.utcStringToDateTime(row.validUntil) })
        }
        return result
    }
    async insert(entry) {
        let conn
        try {
            conn = await this.pool.getConnection()
            let validUntilText = Utils.dateTimeToUtcString(entry.validUntil)
            const res = await conn.query("INSERT INTO apikey (apiKey, consumerName, validUntil) VALUES (?, ?, ?)", [entry.apiKey, entry.name, validUntilText])
            if (res.affectedRows !== 1) {
                throw new Error(`Inserting entry failed. ${JSON.stringify(entry)}`)
            }
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.end()
        }
    }
    async get(apiKey) {
        let conn
        try {
            conn = await this.pool.getConnection()
            const res = await conn.query("SELECT * FROM apikey WHERE apiKey = ?", [apiKey])
            return res.length === 0 ? null : this.toList(res)[0]
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.end()
        }
    }
}

module.exports = ApiKeyStore