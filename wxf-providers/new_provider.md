# Create a new weather provider

weatherbot uses a provider map file to access the specific weather provider API implementation.
we can create a new provider by adding a new file to the wx-src directory and then adding the new provider to the @wx-bot-provider-map.js file.
We can set the active provider by adding a new "wxWbitFunctions" entry to the @wx-bot-provider-map.js file.


## Current Provider Files and methodology

@wx-bot-provider-map.js is the data access layer for the weather forecast data.
    - these are the application aware functions that call the specific weather provider API implementation.
    - Any weather data returned from the specific provider has already been translated from the provider specific json structure to the weatherbot expected structure
    - weatherbot location data is aware of the originally supplied location value and possibly a user supplied label which are supplied to provider specific functions to handle storing relevant location data structures so elements can be referenced to building appropriate URLs.
@wx-src-weathergov.js is the specific weather provider API implementation for weather.gov provider.



## NEW PROVIDER = weatherbit.io
- new provider file name: wx-src-weatherbit.js
- create a new "wxWbitFunctions" object in the @wx-bot-provider-map.js file.
    - the wxWbitFunctions object will have all the same function and const names as the wxWgovFunctions object but will call the weatherbit.io specific API implementation from the new wx-src-weatherbit.js file.
- there are 2 weather forecast data files to be used as comparison references of forecast data for the same location at the same time and how to recreate the expected weatherbot json data structure reporting results
    - weather-gov.json  (for weather.gov provider)
    - weatherbit-io.json (for weatherbit.io provider)
    - use the weatherbit-io.json file to determine the expected json data structure returned by the weatherbit.io provider in order to create the functions needed for @wx-bot-provider-map.js to access the weatherbit.io provider json data.
    - the weatherbit-io.json dataset does not have 2 periods of a daytime and nighttime forecast data, just a single forecast for each day.  The low temp element will be used to create the nighttime forecast data but the other element values will all stay with the daytime equivalent.  The weather.description element will simply state "night time low temperature of 45 degrees" or something similar.

- all URL requests require an API key value which will be stored in the config.yaml file.
    - key available in appConfig.wxProviderApiKey
- there is no separate daytime or nighttime forecast data, just a single forecast for each day.
- the url for the forecast accepts city,state or zipcode or lat/lon coordinates.
- the daily forecast returns 16 days of data.
- noteable fields:
    - valid_date
    - ts
    - wind_gust_spd
    - wind_spd
    - pop
    - high_temp 
    - low_temp
    - weather.description
    - 

forecast documentation
    - https://www.weatherbit.io/api/weather-forecast-16-day
    - base url,  https://www.weatherbit.io/api/forecast/daily
    - ex. https://api.weatherbit.io/v2.0/forecast/daily?city=Los Angeles&key=YOUR_API_KEY

Alerts documentation
    - https://www.weatherbit.io/api/alerts
    - base url, https://api.weatherbit.io/v2.0/alerts
    - ex. https://api.weatherbit.io/v2.0/alerts?city=Los Angeles&key=YOUR_API_KEY



