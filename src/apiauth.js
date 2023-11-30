'use strict'

const auth = (req, res, next) => {
    /*let apiKey = req.header('x-api-key');
    if (!valid(apiKey)) {
        res.status(403).send({ success: false, error: { message: 'x-api-key missing or invalid' } });
        return
    }*/
    next()
}

const valid = (apiKey) => {
    return apiKey !== undefined && apiKey.length > 0
}

module.exports = { auth }