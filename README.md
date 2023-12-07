# CryptoPriceOracle
Fetches exchange rates for currency pairs (eg. XRP/USD, BTC/EUR) from various sources. Data can be stored in memory, MariaDB or PostgreSQL. For XRPL it's additionally possible to store exchange rates on-chain using an XRPL TrustSet command.

If stored in memory or a database, this service offers a REST API to fetch persisted data. API calls are protected using <code>env.ADMINPWR</code> and <code>x-api-key</code> HTTP header.

Don't trust. Verify. Run your own instance to ensure you're getting the expected data.

### Wallets on-chain storage
- [rpXCfDds782Bd6eK9Hsn15RDnGMtxf752m](https://bithomp.com/explorer/rpXCfDds782Bd6eK9Hsn15RDnGMtxf752m) (XRPL main)

## HTTP endpoints
| url                 | description                                                                        | examples                          |
|---------------------|------------------------------------------------------------------------------------|-----------------------------------|
| GET  /rate/:id?quote=USD | Get latest quote for currency pair                                                 | /rate/XRP?quote=USD (x-api-key required) |
| GET  /rate/:id?quote=USD&at=YYYYMMDDTHHmmssZ   | Get quote for currency pair at a point in (UTC) time         | /rate/XRP?quote=USD&at=20231207T073723Z (x-api-key required) |
| GET  /apikey             | List all api keys                                                                  | /apikey?pwr=env.ADMINPWR     |
| POST /apikey             | Create new api key for URL encoded form data 'name'                                | /apikey?pwr=env.ADMINPWR     |
| GET  /health             | HTTP 200 if good or HTTP 500 with details                                          | /health?pwr=env.ADMINPWR     |
| GET  /status             | JSON status response                                                               | /status?pwr=env.ADMINPWR     |

## Config
Exchange rate sources are defined in ./provider/definitions with one json file per base currency.

| .env variable                 | values (\<default>)        | description                                                                        |
|-------------------------------|---------------------------|------------------------------------------------------------------------------------|
| PORT                          | <3000>                    | HTTP port for service                                                              |
| TIMEOUT_SECONDS               | <15>                      | Timeout seconds for exchange rate source timeout                                   |
| LOG_INFO                      | \<false>                   | True if infos should be printed to console                                            |
| UNHEALTHY_AFTER               | <900000>                  | Millis without any new exchange rates until service returns   HTTP 500 at /health                                 |
| ADMINPWR                      |                           | Password for administrative calls                                                  |
| FETCH_CURRENCIES              | [XRP,XAH], <[]>           | A list of baseCurrencies to be fetched. [] or obmitted is considered all                       |
| PUBLISH_INTERVAL              | <60000>                   | Fetch & publish trigger interval in millis                                         |
| DB_PROVIDER                   | mariadb, postgres     | Storage provider or null, for memory storage only                                  |
| DB_HOST                       |                           | Database (db) server name                                                          |
| DB_NAME                       |                           | Database name                                                                      |
| DB_USER                       |                           | Database user                                                                      |
| DB_PASSWORD                   |                           | Database password                                                                  |
| RATESTORE_MAXAGE_SECONDS      | <5184000>, <7200>         | Maximum age to keep in storage before removal (2 month for db, 2 hours for memory) |
| XRPL_TRUSTLINE_PUBLISH_CONFIG | <>                        | JSON config string for XRPL on-chain storage or omitted if not used                       |

### XRPL_TRUSTLINE_PUBLISH_CONFIG
A JSON array defining how and which exchange rates should be stored on-chain.

Example
```json
[
  {
    "publishCurrencies": [
      "XRP"
    ],
    "endpoint": "wss://s.altnet.rippletest.net:51233",
    "maxFeeDrops": 1010,
    "accountPublicKey": "rKF4sbPfJiNUQwAh4R6PuYqJRCxaBX8W76",
    "accountSecret": "s...",
    "issuerPublicKey": "r9yFdE8aASi5opAoYASYpyo9iqYF8Ly3jJ"
  },
  {
    "publishCurrencies": [
      "XAH"
    ],
    "endpoint": "wss://xahau-test.net",
    "feeProvider": "hooksFee",
    "maxFeeDrops": 1500,
    "accountPublicKey": "rHEbBTy4t5BGS7o4EmHyP6uZ9P7M53mziK",
    "accountSecret": "s...",
    "issuerPublicKey": "r32imWPz2BX199eFi12Uae3AEZYv93BBGT"
  }
]
```