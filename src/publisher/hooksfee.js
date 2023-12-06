'use strict'
const codec = require('ripple-binary-codec')

class HooksFee {
    constructor(client) {
        this.client = client
    }

    async get(tx) {
        // As documented (https://xrpl-hooks.readme.io/docs/hook-fees)
        tx.Fee = '0'
        tx.SigningPubKey = ''

        const response = await this.client.request({
            "command": "fee",
            "tx_blob": codec.encode(tx)
        })

        return response.result.drops.base_fee
    }
}

module.exports = HooksFee