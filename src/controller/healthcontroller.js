'use strict'

class HealthController {
    constructor(publishers, unhealthyAfter) {
        this.publishers = publishers
        this.unhealthyAfter = unhealthyAfter
    }

    async get(req, res) {
        var stats = this.getStats()
        if (stats.filter(e => !e.healthy).length > 0) {
            res.status(500).send(stats)
        } else {
            res.status(200).send(null)
        }
    }

    getStats() {
        var stats = []
        for (const publisher of this.publishers) {
            const lastPublished = publisher.getLastPublished()
            const healthy = lastPublished == null || lastPublished.getTime() + this.unhealthyAfter > new Date().getTime()
            const lastPublishedText = lastPublished == null ? null : lastPublished.toISOString()
            stats.push({ name: publisher.getName(), healthy: healthy, lastPublished: lastPublishedText })
        }
        return stats
    }

    allHealthy() {
        return this.getStats().filter(e => !e.healthy).length === 0
    }
}

module.exports = HealthController