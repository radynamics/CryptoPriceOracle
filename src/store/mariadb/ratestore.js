'use strict'
const FxRate = require('../../model/fxrate');
const Utils = require('../../utils')

class RateStore {
    constructor(pool) {
        this.pool = pool
    }

    async insert(rate, exchangeId) {
        let conn
        try {
            conn = await this.pool.getConnection()
            let atText = Utils.dateTimeToUtcString(rate.at)
            const res = await conn.query("INSERT INTO rate (baseCcy, quoteCcy, rate, exchangeId, dt) VALUES (?, ?, ?, ?, ?)", [rate.baseCcy, rate.quoteCcy, rate.rate, exchangeId, atText])
            if (res.affectedRows !== 1) {
                throw new Error(`Inserting rate failed. ${JSON.stringify(rate)}`)
            }
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.end()
        }
    }

    async deleteBefore(before) {
        let conn
        try {
            conn = await this.pool.getConnection()
            let beforeText = Utils.dateTimeToUtcString(before)
            await conn.query("DELETE FROM rate WHERE dt < ?", [beforeText])
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
            let startText = Utils.dateTimeToUtcString(start)
            let endText = Utils.dateTimeToUtcString(end)
            const res = await conn.query("SELECT * FROM rate WHERE baseCcy = ? AND quoteCcy = ? AND dt BETWEEN ? AND ?", [baseCcy, quoteCcy, startText, endText])
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
            let o = new FxRate(row.baseCcy, row.quoteCcy, row.rate, row.exchangeName)
            o.at = Utils.utcStringToDateTime(row.dt)
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
}

module.exports = RateStore