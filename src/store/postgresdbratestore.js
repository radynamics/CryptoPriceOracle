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
                const sql = `CREATE TABLE exchange (
                    "exchangeId" integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 ),
                    "exchangeName" character varying(64) NOT NULL,
                    PRIMARY KEY ("exchangeId"),
                    CONSTRAINT "exchangeName_UNIQUE" UNIQUE ("exchangeName")
                );`
                await conn.query(sql)
            }
            {
                const sql = `CREATE TABLE rate (
                    "rateId" integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 ),
                    "baseCcy" character varying(10) NOT NULL,
                    "quoteCcy" character varying NOT NULL,
                    "rate" double precision NOT NULL,
                    "exchangeId" integer NOT NULL,
                    "dt" timestamp without time zone NOT NULL,
                    PRIMARY KEY ("rateId"),
                    FOREIGN KEY ("exchangeId") REFERENCES exchange ("exchangeId") MATCH SIMPLE ON UPDATE NO ACTION ON DELETE NO ACTION NOT VALID
                );
                CREATE INDEX ON rate USING btree ("baseCcy" ASC NULLS LAST, "quoteCcy" ASC NULLS LAST, "dt" ASC NULLS LAST) WITH (deduplicate_items=True);`
                await conn.query(sql)
            }
            {
                const sql = `CREATE TABLE apikey (
                    "apiKeyId" integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 ),
                    "apiKey" character varying(32) NOT NULL,
                    "consumerName" character varying(64) NOT NULL,
                    "validUntil" timestamp without time zone NOT NULL,
                    PRIMARY KEY ("apiKeyId"),
                    CONSTRAINT "apiKey_UNIQUE" UNIQUE ("apiKey")
                );`
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