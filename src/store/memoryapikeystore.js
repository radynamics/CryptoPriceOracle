'use strict'

class MemoryApiKeyStore {
    constructor() {
        this.entries = []
    }

    async list() {
        return this.entries
    }
    async insert(entry) {
        this.entries.push(entry)
    }
    async get(apiKey) {
        for (const e of this.entries) {
            if (e.apiKey === apiKey) {
                return e
            }
        }
        return null
    }
}

module.exports = MemoryApiKeyStore