'use strict'
const mariadb = require('mariadb')

class MariaDbExchangeStore {
    constructor(dbInfo) {
        this.pool = mariadb.createPool({ host: dbInfo.host, database: dbInfo.dbName, user: dbInfo.user, password: dbInfo.password, connectionLimit: 5 })
    }

    async insert(name) {
        let conn
        try {
            conn = await this.pool.getConnection()
            const res = await conn.query("INSERT INTO exchange (exchangeName) VALUES (?)", [name])
            if (res.affectedRows !== 1) {
                throw new Error(`Inserting entry failed. ${JSON.stringify(name)}`)
            }
            return await this.id(res.insertId)
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.end()
        }
    }

    async get(name) {
        let conn
        try {
            conn = await this.pool.getConnection()
            const res = await conn.query("SELECT * FROM exchange WHERE exchangeName = ?", [name])
            return res.length === 0 ? undefined : this.toList(res)[0]
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.end()
        }
    }

    async id(id) {
        let conn
        try {
            conn = await this.pool.getConnection()
            const res = await conn.query("SELECT * FROM exchange WHERE exchangeId = ?", [id])
            return res.length === 0 ? undefined : this.toList(res)[0]
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.end()
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

module.exports = MariaDbExchangeStore