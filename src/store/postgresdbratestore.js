'use strict'
const pg = require('pg')
const FxRate = require('../model/fxrate');
const Utils = require('../utils')

class PostgresDbRateStore {
    constructor(dbInfo) {
        this.dbInfo = dbInfo
        this.pool = new pg.Pool({ host: dbInfo.host, database: dbInfo.dbName, user: dbInfo.user, password: dbInfo.password, timezone: 'UTC' })
    }

    async insert(rate, exchangeId) {
        let conn
        try {
            conn = await this.pool.connect()
            let atText = Utils.dateTimeToUtcString(rate.at)
            const res = await conn.query(`INSERT INTO rate ("BaseCcy", "QuoteCcy", "Rate", "ExchangeId", "Dt") VALUES ($1, $2, $3, $4, $5)`, [rate.baseCcy, rate.quoteCcy, rate.rate, exchangeId, atText])
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
            await conn.query(`DELETE FROM rate WHERE "Dt" < $1`, [beforeText])
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
            const res = await conn.query(`SELECT * FROM rate WHERE "BaseCcy" = $1 AND "QuoteCcy" = $2 AND "Dt" BETWEEN $3 AND $4`, [baseCcy, quoteCcy, startText, endText])
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
            let o = new FxRate(row.BaseCcy, row.QuoteCcy, row.Rate, row.ExchangeName)
            o.at = Utils.utcStringToDateTime(row.Dt)
            result.push(o)
        }
        return result
    }

    async size() {
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

    async initialized() {
        let conn
        try {
            conn = await this.pool.connect()
            const res = await conn.query(`SELECT * FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';`)
            return res.rows.length > 0
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.release()
        }
    }
    async initialize() {
        let conn
        try {
            conn = await this.pool.connect()
            {
                const sql = `CREATE TABLE rate (
                    "RateId" integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 ),
                    "BaseCcy" character varying(10) NOT NULL,
                    "QuoteCcy" character varying NOT NULL,
                    "Rate" double precision NOT NULL,
                    "ExchangeId" integer NOT NULL,
                    "Dt" timestamp without time zone NOT NULL,
                    PRIMARY KEY ("RateId")
                );
                ALTER TABLE IF EXISTS rate OWNER to ${this.dbInfo.user};`
                await conn.query(sql)
                // TODO: index missing
            }
            {
                const sql = `CREATE TABLE apikey (
                    "ApiKeyId" integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 ),
                    "ApiKey" character varying(32) NOT NULL,
                    "ConsumerName" character varying(64) NOT NULL,
                    "ValidUntil" timestamp without time zone NOT NULL,
                    PRIMARY KEY ("ApiKeyId"),
                    CONSTRAINT "ApiKey_UNIQUE" UNIQUE ("ApiKey")
                );
                ALTER TABLE IF EXISTS apikey OWNER to ${this.dbInfo.user};`
                await conn.query(sql)
            }
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.release()
        }
    }
}

module.exports = PostgresDbRateStore