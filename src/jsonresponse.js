'use strict'

function ok(res, value) {
    res.json({ success: true, data: value || null })
}
function error(res, message) {
    res.json({ success: false, error: { message: message } })
}
function errorParamMissing(res, name) {
    error(res, `missing parameter ${name}`)
}

module.exports = { ok, error, errorParamMissing }