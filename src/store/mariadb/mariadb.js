'use strict'
const mariadb = require('mariadb')
const RateStore = require('./ratestore')
const ApiKeyStore = require('./apikeystore')
const ExchangeStore = require('./exchangestore')

class MariaDb {
    constructor(dbInfo) {
        this.pool = mariadb.createPool({ host: dbInfo.host, database: dbInfo.dbName, user: dbInfo.user, password: dbInfo.password, connectionLimit: 5 })
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
        return "mariaDb"
    }

    async initialized() {
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
    async initialize() {
        let conn
        try {
            conn = await this.pool.getConnection()
            {
                const sql = "CREATE TABLE `exchange` (" +
                    "`exchangeId` INT NOT NULL AUTO_INCREMENT," +
                    "`exchangeName` VARCHAR(64) NOT NULL," +
                    "PRIMARY KEY (`exchangeId`)," +
                    "UNIQUE KEY `exchangeName_UNIQUE` (`exchangeName`));"
                await conn.query(sql)
            }
            {
                const sql = "CREATE TABLE `rate` (" +
                    "`rateId` INT NOT NULL AUTO_INCREMENT," +
                    "`baseCcy` VARCHAR(10) NOT NULL," +
                    "`quoteCcy` VARCHAR(10) NOT NULL," +
                    "`rate` DOUBLE NOT NULL," +
                    "`exchangeId` INT NOT NULL," +
                    "`dt` DATETIME NOT NULL," +
                    "PRIMARY KEY (`rateId`)," +
                    "INDEX `IX_BASE_QUOTE_DT` (`baseCcy` ASC, `quoteCcy` ASC, `dt` ASC) VISIBLE," +
                    "INDEX `FK_exchangeId_idx` (`exchangeId` ASC) VISIBLE," +
                    "CONSTRAINT `FK_exchangeId` FOREIGN KEY (`exchangeId`) REFERENCES `exchange` (`exchangeId`) ON DELETE NO ACTION ON UPDATE NO ACTION);"
                await conn.query(sql)
            }
            {
                const sql = "CREATE TABLE `apikey` (" +
                    "`apiKeyId` INT NOT NULL AUTO_INCREMENT," +
                    "`apiKey` VARCHAR(32) NOT NULL," +
                    "`consumerName` VARCHAR(64) NOT NULL," +
                    "`validUntil` DATETIME NOT NULL," +
                    "PRIMARY KEY (`apiKeyId`)," +
                    "UNIQUE KEY `apiKey_UNIQUE` (`apiKey`))"
                await conn.query(sql)
            }
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.end()
        }
    }
}

module.exports = MariaDb