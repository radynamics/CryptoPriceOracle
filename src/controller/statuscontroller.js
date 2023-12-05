'use strict'
const JsonResponse = require('../jsonresponse');

class StatusController {
    constructor(publishers, started) {
        this.publishers = publishers
        this.started = started
    }

    async get(req, res) {
        var stats = []
        for (const publisher of this.publishers) {
            stats.push({ name: publisher.getName(), lastPublished: publisher.getLastPublished(), store: await publisher.getStatus() })
        }

        JsonResponse.ok(res, { started: this.started.toISOString(), publisher: stats })
    }
}

module.exports = StatusController