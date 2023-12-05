'use strict'
const mariadb = require('mariadb')
const FxRate = require('../model/fxrate');
const Utils = require('../utils')

class MariaDbRateStore {
    constructor(dbInfo) {
        this.pool = mariadb.createPool({ host: dbInfo.host, database: dbInfo.dbName, user: dbInfo.user, password: dbInfo.password, connectionLimit: 5 })
    }

    async insert(rate, exchangeId) {
        let conn
        try {
            conn = await this.pool.getConnection()
            let atText = Utils.dateTimeToUtcString(rate.at)
            const res = await conn.query("INSERT INTO rate (BaseCcy, QuoteCcy, Rate, ExchangeId, Dt) VALUES (?, ?, ?, ?, ?)", [rate.baseCcy, rate.quoteCcy, rate.rate, exchangeId, atText])
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
            let startText = Utils.dateTimeToUtcString(start)
            let endText = Utils.dateTimeToUtcString(end)
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
            o.at = Utils.utcStringToDateTime(row.Dt)
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
                    "`ExchangeId` INT NOT NULL AUTO_INCREMENT," +
                    "`ExchangeName` VARCHAR(64) NOT NULL," +
                    "PRIMARY KEY (`ExchangeId`)," +
                    "UNIQUE KEY `ExchangeName_UNIQUE` (`ExchangeName`));"
                await conn.query(sql)
            }
            {
                const sql = "CREATE TABLE `rate` (" +
                    "`RateId` INT NOT NULL AUTO_INCREMENT," +
                    "`BaseCcy` VARCHAR(10) NOT NULL," +
                    "`QuoteCcy` VARCHAR(10) NOT NULL," +
                    "`Rate` DOUBLE NOT NULL," +
                    "`ExchangeId` INT NOT NULL," +
                    "`Dt` DATETIME NOT NULL," +
                    "PRIMARY KEY (`RateId`)," +
                    "INDEX `IX_BASE_QUOTE_DT` (`BaseCcy` ASC, `QuoteCcy` ASC, `Dt` ASC) VISIBLE," +
                    "INDEX `FK_ExchangeId_idx` (`ExchangeId` ASC) VISIBLE," +
                    "CONSTRAINT `FK_ExchangeId` FOREIGN KEY (`ExchangeId`) REFERENCES `exchange` (`ExchangeId`) ON DELETE NO ACTION ON UPDATE NO ACTION);"
                await conn.query(sql)
            }
            {
                const sql = "CREATE TABLE `apikey` (" +
                    "`ApiKeyId` INT NOT NULL AUTO_INCREMENT," +
                    "`ApiKey` VARCHAR(32) NOT NULL," +
                    "`ConsumerName` VARCHAR(64) NOT NULL," +
                    "`ValidUntil` DATETIME NOT NULL," +
                    "PRIMARY KEY (`ApiKeyId`)," +
                    "UNIQUE KEY `ApiKey_UNIQUE` (`ApiKey`))"
                await conn.query(sql)
            }
        } catch (err) {
            throw err
        } finally {
            if (conn) conn.end()
        }
    }
}

module.exports = MariaDbRateStore