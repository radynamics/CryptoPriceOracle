'use strict'
const mariadb = require('mariadb')
const Utils = require('../utils')

class MariaDbApiKeyStore {
    constructor(dbInfo) {
        this.pool = mariadb.createPool({ host: dbInfo.host, database: dbInfo.dbName, user: dbInfo.user, password: dbInfo.password, connectionLimit: 5 })
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
            result.push({ apikey: row.ApiKey, name: row.ConsumerName, validuntil: row.ValidUntil })
        }
        return result
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
    async get(apiKey) {
        let conn
        try {
            conn = await this.pool.getConnection()
            const res = await conn.query("SELECT * FROM apikey WHERE ApiKey = ?", [apiKey])
            return res.length === 0 ? null : this.toList(res)[0]
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.end()
        }
    }
}

module.exports = MariaDbApiKeyStore