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

module.exports = MariaDbRateStore