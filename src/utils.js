'use strict'
const moment = require('moment')

function utf8ToHex(text) {
    return Buffer.from(text, 'utf-8').toString('hex').toUpperCase()
}

function hexToUtf8(hex) {
    return decodeURIComponent('%' + hex.match(/.{1,2}/g).join('%'));
}

function round(amt, digits) {
    return +(Math.round(amt + "e+" + digits) + "e-" + digits);
}

function dateTimeToUtcString(value) {
    // Enforce format 'YYYY-MM-DD HH:MM:SS'
    return new Date(value.toISOString()).toJSON().slice(0, 19).replace('T', ' ')
}
function utcStringToDateTime(value) {
    return moment(value).utc(true).toDate()
}

module.exports = { utf8ToHex, hexToUtf8, round, dateTimeToUtcString, utcStringToDateTime }