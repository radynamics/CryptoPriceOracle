'use strict'
const moment = require('moment')
const mariadb = require('mariadb')
const FxRate = require('../model/fxrate');

class MariaDbStore {
    static DefaultMaxAgeSeconds = 60 * 60 * 24 * 60
    constructor(host, dbName, user, password) {
        this.lastPublished = null
        this.maxAgeSeconds = MariaDbStore.DefaultMaxAgeSeconds
        this.pool = mariadb.createPool({ host: host, database: dbName, user: user, password: password, connectionLimit: 5 })
    }

    publishAll(rates) {
        for (const fxRate of rates) {
            this.publish(fxRate)
        }
        this.removeOutdated()
    }
    async publish(rate) {
        let conn
        try {
            conn = await this.pool.getConnection()
            let atText = this.toDateTimeText(rate.at)
            const res = await conn.query("INSERT INTO rate (BaseCcy, QuoteCcy, Rate, ExchangeName, Dt) VALUES (?, ?, ?, ?, ?)", [rate.baseCcy, rate.quoteCcy, rate.rate, rate.exchangeName, atText])
            if (res.affectedRows !== 1) {
                throw new Error(`Inserting rate failed. ${JSON.stringify(rate)}`)
            }
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.end()
        }
        this.lastPublished = new Date()
    }

    async removeOutdated() {
        var before = moment().subtract(this.maxAgeSeconds, 'seconds').toDate()
        let conn
        try {
            conn = await this.pool.getConnection()
            let beforeText = this.toDateTimeText(before)
            await conn.query("DELETE FROM rate WHERE Dt < ?", [beforeText])
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.end()
        }
    }

    async list(baseCcy, quoteCcy, start, end) {
        let conn
        try {
            conn = await this.pool.getConnection()
            let startText = this.toDateTimeText(start)
            let endText = this.toDateTimeText(end)
            const res = await conn.query("SELECT * FROM rate WHERE BaseCcy = ? AND QuoteCcy = ? AND Dt BETWEEN ? AND ?", [baseCcy, quoteCcy, startText, endText])
            return this.toFxRateList(res)
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.end()
        }
    }

    toFxRateList(rows) {
        var result = []
        for (const row of rows) {
            let o = new FxRate(row.BaseCcy, row.QuoteCcy, row.Rate, row.ExchangeName)
            o.at = row.Dt
            result.push(o)
        }
        return result
    }

    async size() {
        let conn
        try {
            conn = await this.pool.getConnection()
            const res = await conn.query("SELECT COUNT(1) AS Cnt FROM rate")
            return res[0].Cnt
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.end()
        }
    }

    setMaxAgeSeconds(value) {
        this.maxAgeSeconds = value
    }

    getName() {
        return "MariaDbStore"
    }

    getLastPublished() {
        return this.lastPublished
    }

    async getStatus() {
        return { lastPublished: this.getLastPublished(), size: new String(await this.size()) }
    }

    toDateTimeText(value) {
        // Enforce format 'YYYY-MM-DD HH:MM:SS'
        return new Date(value.toISOString()).toJSON().slice(0, 19).replace('T', ' ')
    }
    async anyTablePresent() {
        let conn
        try {
            conn = await this.pool.getConnection()
            const res = await conn.query("SHOW TABLES")
            return res.length > 0
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.end()
        }
    }
    async initDb() {
        let conn
        try {
            conn = await this.pool.getConnection()
            {
                const sql = "CREATE TABLE `rate` (" +
                    "`RateId` INT NOT NULL AUTO_INCREMENT," +
                    "`BaseCcy` VARCHAR(10) NOT NULL," +
                    "`QuoteCcy` VARCHAR(10) NOT NULL," +
                    "`Rate` DOUBLE NOT NULL," +
                    "`ExchangeName` VARCHAR(32) NOT NULL," +
                    "`Dt` DATETIME NOT NULL," +
                    "PRIMARY KEY (`RateId`)," +
                    "INDEX `IX_BASE_QUOTE_DT` (`BaseCcy` ASC, `QuoteCcy` ASC, `Dt` ASC) VISIBLE)"
                await conn.query(sql)
            }
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.end()
        }
    }
}

module.exports = MariaDbStore