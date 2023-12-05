'use strict'

class ExchangeStore {
    constructor(pool) {
        this.pool = pool
    }

    async insert(name) {
        let conn
        try {
            conn = await this.pool.connect()
            const res = await conn.query(`INSERT INTO exchange ("exchangeName") VALUES ($1) RETURNING "exchangeId"`, [name])
            if (res.rowCount !== 1) {
                throw new Error(`Inserting entry failed. ${JSON.stringify(name)}`)
            }
            return await this.id(res.rows[0].exchangeId)
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
            const res = await conn.query(`SELECT * FROM exchange WHERE "exchangeName" = $1`, [name])
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
            const res = await conn.query(`SELECT * FROM exchange WHERE "exchangeId" = $1`, [id])
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
            result.push({ id: row.exchangeId, name: row.exchangeName })
        }
        return result
    }
}

module.exports = ExchangeStore