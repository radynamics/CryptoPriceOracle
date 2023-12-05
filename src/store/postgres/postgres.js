'use strict'
const pg = require('pg')
const RateStore = require('./ratestore')
const ApiKeyStore = require('./apikeystore')
const ExchangeStore = require('./exchangestore')

class Postgres {
    constructor(dbInfo) {
        this.pool = new pg.Pool({ host: dbInfo.host, database: dbInfo.dbName, user: dbInfo.user, password: dbInfo.password })
        this.rateStore = new RateStore(this.pool)
        this.apiKeyStore = new ApiKeyStore(this.pool)
        this.exchangeStore = new ExchangeStore(this.pool)
    }

    getRateStore() {
        return this.rateStore
    }
    getApiKeyStore() {
        return this.apiKeyStore
    }
    getExchangeStore() {
        return this.exchangeStore
    }

    getName() {
        return "postgres"
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

module.exports = Postgres