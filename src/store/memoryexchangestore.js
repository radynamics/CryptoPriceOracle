'use strict'

class MemoryExchangeStore {
    constructor() {
        this.entries = []
    }

    async insert(name) {
        var entry = { id: this.entries.length, name: name }
        this.entries.push(entry)
        return entry
    }

    async get(name) {
        var results = this.entries.filter((o) => o.name === name)
        return results.length === 0 ? undefined : results[0]
    }
}

module.exports = MemoryExchangeStore