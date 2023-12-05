'use strict'
const pg = require('pg')

class PostgresDbExchangeStore {
    constructor(dbInfo) {
        this.pool = new pg.Pool({ host: dbInfo.host, database: dbInfo.dbName, user: dbInfo.user, password: dbInfo.password })
    }

    async insert(name) {
        let conn
        try {
            conn = await this.pool.connect()
            const res = await conn.query(`INSERT INTO exchange ("ExchangeName") VALUES ($1) RETURNING "ExchangeId"`, [name])
            if (res.rowCount !== 1) {
                throw new Error(`Inserting entry failed. ${JSON.stringify(name)}`)
            }
            return await this.id(res.rows[0].ExchangeId)
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.release()
        }
    }

    async get(name) {
        let conn
        try {
            conn = await this.pool.connect()
            const res = await conn.query(`SELECT * FROM exchange WHERE "ExchangeName" = $1`, [name])
            return res.rows.length === 0 ? undefined : this.toList(res.rows)[0]
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.release()
        }
    }

    async id(id) {
        let conn
        try {
            conn = await this.pool.connect()
            const res = await conn.query(`SELECT * FROM exchange WHERE "ExchangeId" = $1`, [id])
            return res.rows.length === 0 ? undefined : this.toList(res.rows)[0]
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.release()
        }
    }

    toList(rows) {
        var result = []
        for (const row of rows) {
            result.push({ id: row.ExchangeId, name: row.ExchangeName })
        }
        return result
    }
}

module.exports = PostgresDbExchangeStore