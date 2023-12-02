'use strict'
const FxRate = require('../model/fxrate');
const moment = require('moment');
const JsonResponse = require('../jsonresponse');
const Utils = require('../utils')

class RateController {
    constructor(store) {
        this.store = store
    }

    getRate(req, res) {
        const baseCcy = req.params.id
        if (req.query.quote === undefined) {
            JsonResponse.errorParamMissing(res, 'quote')
            return
        }
        const quoteCcy = req.query.quote
        const at = req.query.at === undefined ? moment() : moment(req.query.at, 'YYYY-MM-DDTHHmmssZ')
        const start = moment(at).subtract(1, 'minutes').toDate();
        const end = moment(at).add(1, 'minutes').toDate();

        const result = this.store.list(baseCcy, quoteCcy, start, end)
        if (result.length === 0) {
            JsonResponse.ok(res, null)
            return
        }
        const closest = this.closest(result, at.toDate())
        const avgRate = Utils.round(RateController.avgRate(result), 6)
        JsonResponse.ok(res, { baseCcy: closest.closest, quoteCcy: closest.quoteCcy, rate: avgRate, sourcecount: result.length, at: closest.at })
    }

    static avgRate(list) {
        var sum = 0
        for (const fxRate of list) {
            sum += fxRate.rate
        }
        return (sum / list.length) || 0
    }

    closest(list, at) {
        var candidate = undefined
        for (const fxRate of list) {
            if (candidate === undefined) {
                candidate = fxRate
                continue
            }
            var diffCandidate = Math.abs(candidate.at.getTime() - at.getTime())
            var diffCurrent = Math.abs(fxRate.at.getTime() - at.getTime())
            candidate = diffCandidate <= diffCurrent ? candidate : fxRate
        }
        return candidate
    }
}

module.exports = RateController