'use strict'

class ExchangeIdHelper {
    static unknown = 0
    static map = new Map([
        [ExchangeIdHelper.unknown, 'unknown'],
        [1, 'bitstamp'],
        [2, 'binance'],
        [3, 'kraken'],
        [4, 'btse'],
        [5, 'bithash'],
        [6, 'bitbank'],
        [7, 'gmo-coin'],
        [8, 'upbit'],
        [9, 'coinone'],
        [10, 'btcturk'],
        [11, 'bitkub'],
        [12, 'coingecko'],
        [13, 'mercadobitcoin'],
        [14, 'novadax'],
        [15, 'coinjar'],
        [16, 'independent-reserve'],
        [17, 'bitso'],
        [18, 'luno'],
        [19, 'valr'],
        [20, 'altcointrader'],
        [21, 'coinbase'],
        [22, 'indodax'],
        [23, 'tokenize-exchange'],
        [24, 'bitfinex'],
        [25, 'bitrue'],
    ]);

    static toId(text) {
        for (const [id, name] of ExchangeIdHelper.map) {
            if (name === text) {
                return id
            }
        }
        return ExchangeIdHelper.unknown
    }
}

module.exports = ExchangeIdHelper