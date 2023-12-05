'use strict'
const pg = require('pg')
const Utils = require('../utils')

class PostgresDbApiKeyStore {
    constructor(dbInfo) {
        this.pool = new pg.Pool({ host: dbInfo.host, database: dbInfo.dbName, user: dbInfo.user, password: dbInfo.password })
    }

    async list() {
        let conn
        try {
            conn = await this.pool.connect()
            const result = await conn.query(`SELECT * FROM apikey`, [])
            return this.toList(result.rows)
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.release()
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
            conn = await this.pool.connect()
            let validUntilText = Utils.dateTimeToUtcString(entry.validUntil)
            const res = await conn.query(`INSERT INTO apikey ("apiKey", "consumerName", "validUntil") VALUES ($1, $2, $3)`, [entry.apiKey, entry.name, validUntilText])
            if (res.rowCount !== 1) {
                throw new Error(`Inserting entry failed. ${JSON.stringify(entry)}`)
            }
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.release()
        }
    }
    async get(apiKey) {
        let conn
        try {
            conn = await this.pool.connect()
            const res = await conn.query(`SELECT * FROM apikey WHERE "apiKey" = $1`, [apiKey])
            return res.rows.length === 0 ? null : this.toList(res.rows)[0]
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.release()
        }
    }
}

module.exports = PostgresDbApiKeyStore