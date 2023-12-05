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
            conn = await this.pool.connect()
            let atText = Utils.dateTimeToUtcString(rate.at)
            const res = await conn.query(`INSERT INTO rate ("baseCcy", "quoteCcy", "rate", "exchangeId", "dt") VALUES ($1, $2, $3, $4, $5)`, [rate.baseCcy, rate.quoteCcy, rate.rate, exchangeId, atText])
            if (res.rowCount !== 1) {
                throw new Error(`Inserting rate failed. ${JSON.stringify(rate)}`)
            }
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.release()
        }
    }

    async deleteBefore(before) {
        let conn
        try {
            conn = await this.pool.connect()
            let beforeText = Utils.dateTimeToUtcString(before)
            await conn.query(`DELETE FROM rate WHERE "dt" < $1`, [beforeText])
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.release()
        }
    }

    async list(baseCcy, quoteCcy, start, end) {
        let conn
        try {
            conn = await this.pool.connect()
            let startText = Utils.dateTimeToUtcString(start)
            let endText = Utils.dateTimeToUtcString(end)
            const res = await conn.query(`SELECT * FROM rate WHERE "baseCcy" = $1 AND "quoteCcy" = $2 AND "dt" BETWEEN $3 AND $4`, [baseCcy, quoteCcy, startText, endText])
            return this.toFxRateList(res.rows)
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.release()
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

    async count() {
        let conn
        try {
            conn = await this.pool.connect()
            const res = await conn.query(`SELECT COUNT(1) AS "Cnt" FROM rate`)
            return res.rows[0].Cnt
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.release()
        }
    }
}

module.exports = RateStore