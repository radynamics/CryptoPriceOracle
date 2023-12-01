'use strict'

function utf8ToHex(text) {
    return Buffer.from(text, 'utf-8').toString('hex').toUpperCase()
}

function hexToUtf8(hex) {
    return decodeURIComponent('%' + hex.match(/.{1,2}/g).join('%'));
}

function round(amt, digits) {
    return +(Math.round(amt + "e+" + digits) + "e-" + digits);
}

module.exports = { utf8ToHex, hexToUtf8, round }