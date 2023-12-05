'use strict'

const Memory = require('./memory/memory')
const MariaDb = require('./mariadb/mariadb')
const Postgres = require('./postgres/postgres')

class StoreFactory {
    constructor(dbInfo) {
        this.dbInfo = dbInfo
    }

    create(provider) {
        if (this.dbInfo === undefined) {
            return new Memory()
        }
        switch (provider) {
            case 'mariadb': return new MariaDb(this.dbInfo)
            case 'postgres': return new Postgres(this.dbInfo)
            default: throw new Error(`env.DB_PROVIDER ${provider} is unknown.`)
        }
    }
}

module.exports = StoreFactory