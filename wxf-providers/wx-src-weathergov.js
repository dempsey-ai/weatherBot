// PROVIDER: weather.gov
// API: NOAA's NWS Weather Forecast API
// URL: https://api.weather.gov/
// DOCUMENTATION: https://www.weather.gov/documentation/services-web-api
// OPEN SOURCE CODE: https://github.com/benjamintatum/wx-api

// WEATHER DATA:
// SAMPLE RAW DATA: https://api.weather.gov/gridpoints/PUB/82,92/forecast

// REQUIREMENTS:
// 1. GET THE LAT/LON DIRECTLY OR CONVERTED FROM THE USER'S MESSAGE WHICH COULD BE IN THE FORM OF AN CITY, STATE, or ZIP CODE, or LAT/LON
// 2. USE THE LAT/LON TO BUILD THE WEATHER.GOV API URL TO FETCH THE WEATHER DATA FOR THE LOCATION
// 3. CONVERT THE RAW WEATHER DATA TO THE STANDARD WEATHER SOURCE FORMAT FOR THE BOT FRAMEWORK

// PROVIDER MAP CLEAN DATA TEMPLATE:
/*
  wxfTemplate: [{
    geoID: '', 
    geoType: '',
    refDateTimeInt: 0, 
    wxfPeriod: [
      { wxfPeriod: {},  asofStamp: {}, wxfDayName: {},   wxfWindSpeed: {}, 
        wxfPrecip: {},  wxfTemp: {},   wxfIsDaytime: {}, wxfDescr: {}, 
        refDayName: {}, refBadFlag: {} 
      }]  
  }],
*/

const axios = require("axios").default
const badWeatherData = require("../wx-bot-wordlists/bad_weather.json")

const cfg = require("../wx-bot-config")
const debugLog = (msg) => {
  if (cfg.appConfig.isDebug) {
    console.log(msg)
  }
  return
}

const { WX_DATA_TYPES, WX_CAPABILITIES, WX_PERIOD_RESOLUTION } = require('./wx-provider-types')
const { WxDay, WxPeriod, WxDataNormalizer } = require('./wx-data-normalizer')

const provWeatherGov = {
  providerName: "weather.gov",
  providerType: WX_DATA_TYPES.MULTI_PERIOD,
  periodResolution: WX_PERIOD_RESOLUTION.TWELVE_HOUR,
  capabilities: [WX_CAPABILITIES.ALERTS, WX_CAPABILITIES.POLYGONS],
  provGeoData: [
    {
      geoID: "80809",
      geoType: "loc-zip",
      geoData: "80809",
      forecast: "https://api.weather.gov/gridpoints/PUB/84,95/forecast",
      alert: "https://api.weather.gov/alerts?point=38.91181%2C-104.98553&status=actual&message_type=alert",
      polyMapURL: "",
    },
    {
      geoID: "pikespeak",
      geoType: "loc-gps",
      geoData: "38.8408655,-105.0441532",
      forecast: "https://api.weather.gov/gridpoints/PUB/82,92/forecast",
      alert: "https://api.weather.gov/alerts?point=38.8408655%2C-105.0441532&status=actual&message_type=alert",
      polyMapURL: "",
    },
  ],

  provCacheData: [],

  formatDateTime: (isoString) => {
    const date = new Date(isoString)

    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }

    return date.toLocaleString("en-US", options)
  },

  getAdjustedDayName: (pedKey, pedValue, startDate) => {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    const startDay = startDate.getDay()
    const periodDate = new Date(startDate)
    periodDate.setDate(startDate.getDate() + Math.floor(pedKey / 2))

    const dayName = pedValue.name.split(" ")[0] // Get just the day name, without "Night"
    const isNight = !pedValue.isDaytime

    // Calculate the next Sunday
    const daysUntilNextSunday = 7 - startDay
    const nextSunday = new Date(startDate)
    nextSunday.setDate(startDate.getDate() + daysUntilNextSunday)
    nextSunday.setHours(0, 0, 0, 0) // Set to start of next Sunday

    // If the period is after next Sunday AND it's not Sunday
    if (periodDate > nextSunday && periodDate.getDay() !== 0) {
      return "Next " + pedValue.name
    }

    return pedValue.name
  },

  extractGustSpeed: (detailedForecast) => {
    if (!detailedForecast) return 0

    const gustPatterns = [/gusts as high as (\d+)/i, /gusting to (\d+)/i, /gusts up to (\d+)/i, /wind gusts (\d+)/i]

    for (const pattern of gustPatterns) {
      const match = detailedForecast.match(pattern)
      if (match) {
        return parseInt(match[1])
      }
    }

    return 0
  },

  extractInteger: (value) => {
    if (value === null || value === undefined) {
      return 0
    }
    const match = String(value).match(/\d+/)
    return match ? parseInt(match[0]) : 0
  },

  extractWindSpeed: (windSpeedString) => {
    if (windSpeedString === null || windSpeedString === undefined) {
      return 0
    }
    const matches = windSpeedString.match(/\d+/g)
    return matches ? parseInt(matches[matches.length - 1]) : 0
  },

  getDayOfWeekInt: (dayName) => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    const index = days.findIndex((day) => dayName.toLowerCase().includes(day.toLowerCase()))
    return index !== -1 ? index + 1 : -1 // Adding 1 to make Sunday 1 and Saturday 7
  },

  getDayName: (date) => {
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()]
  },

  adjustDayName: (name, currentDay, isDaytime) => {
    if (name.toLowerCase() === "today" || name.toLowerCase() === "tonight") {
      return currentDay
    }
    if (name.toLowerCase() === "tomorrow") {
      return getDayName(new Date(new Date().setDate(new Date().getDate() + 1)))
    }
    return name.replace(" Night", "")
  },

  timeLimit: 3600000 * 1, // = 60min   //1702555872762 - 1702519101950

  milliseconds: Date.now(), //1702555872762 - 1702519101950

  formatTime: (milliseconds) => {
    const seconds = Math.floor((milliseconds / 1000) % 60)
    const minutes = Math.floor((milliseconds / 1000 / 60) % 60)
    const hours = Math.floor((milliseconds / 1000 / 60 / 60) % 24)

    return [hours.toString().padStart(2, "0"), minutes.toString().padStart(2, "0"), seconds.toString().padStart(2, "0")].join(":")
  },

  alertIsCurrent: {
    ">=": function (expireISOdate) {
      try {
        let today = new Date()
        const dd = String(today.getDate()).padStart(2, "0")
        const mm = String(today.getMonth() + 1).padStart(2, "0") //January is 0!
        const yyyy = today.getFullYear()
        today = yyyy + "-" + mm + "-" + dd

        const eDateISO = new Date(expireISOdate).toISOString().split("T")[0]
        const expSplit = eDateISO.split("-")
        const todaySplit = today.split("-")
        const expDate = expSplit[0].concat(expSplit[1], expSplit[2])
        const todayDate = todaySplit[0].concat(todaySplit[1], todaySplit[2])
        return expDate >= todayDate
      } catch (err) {
        debugLog(err)
        return true
      } //if any error, return true to include alerts regardlessv
    }, //end of first function
    "<=": function (isA, thanB) {
      return isA <= thanB
    },
  }, //end var/function

  sleep: async (manySecs) => {
    return new Promise((resolve) => {
      setTimeout(resolve, manySecs * 1000)
    })
  },

  axiosLoop: async (wxfURL, keepTrying, checkThrottled) => {
    let retVal = ""
    let response = ""
    let gotResponse = false
    for (var i = 0; i < 10; i++) {
      try {
        response = await axios.get(wxfURL, {
          responseType: "json",
          transformResponse: [(v) => v],
        })
        gotResponse = true
        let isThrottled = JSON.parse(response.data)

        if (checkThrottled && /(throttled)/.test(isThrottled.latt.toLowerCase())) {
          debugLog("isThrottled stuff...." + JSON.stringify(isThrottled, null, 3))
          throw "Throttle issue happened"
        } // generates an exception
      } catch (err) {
        debugLog("in catch..." + i)
        if (err.response !== undefined) {
          debugLog(err.response.data.error)
        } else {
          debugLog("in catch err..." + err)
        }

        gotResponse = false
        //return {result: wxErrorMsg, wxfData: undefined}
      }
      if (gotResponse || !keepTrying) {
        break
      }
      debugLog("Trying axios call again loop..." + i)
      if (i == 9) {
        ErrorMsg = "final axios URL fail...looping out of max retries"
      }
      if (keepTrying && i < 5) {
        await provWeatherGov.sleep(1.1)
      } else if (keepTrying) {
        await provWeatherGov.sleep(5)
      }
    } //end loop
    if (!gotResponse) {
      return {result: ErrorMsg, wxfData: undefined}
    }

    retVal = JSON.parse(response.data)

    return retVal
  },

  createGeoData: async (locLabel, geoType, geoData) => {
    let retGeoData = {
      geoID: locLabel,
      geoType: geoType,
      geoData: geoData,
      forecast: "",
      alert: "",
      polyMapURL: "",
      providerType: provWeatherGov.providerType,
      periodResolution: provWeatherGov.periodResolution
    }

    let result = "ok"
    let ErrorMsg = "something wrong, do better"
    let preMsg = "these are the settings used to compose response"
    let reply = "something failed"
    let geoLatLon = {}
    let geoGSP = ""
    let response = ""

    if (geoType == "loc-gps") {
      //split into lat and long
      const geoSplit = geoData.toLowerCase().split(",")
      geoLatLon.latt = geoSplit[0]
      geoLatLon.longt = geoSplit[1]
    } else if (geoType == "loc-city") {
      debugLog("https://geocode.xyz/" + geoData + "?region=us&json=1")

      geoLatLon = await provWeatherGov.axiosLoop("https://geocode.xyz/" + geoData + "?region=us&json=1", true, true)
    } else if (geoType == "loc-zip") {
      debugLog("https://geocode.xyz/" + geoData + "?region=us&json=1")

      geoLatLon = await provWeatherGov.axiosLoop("https://geocode.xyz/" + geoData + "?region=us&json=1", true, true)
    }

    const wxaURL = "https://api.weather.gov/alerts?point=" + geoLatLon.latt + "%2C" + geoLatLon.longt + "&status=actual&message_type=alert"

    let gspURL = "https://api.weather.gov/points/" + geoLatLon.latt + "," + geoLatLon.longt
    debugLog(gspURL)

    geoGSP = await provWeatherGov.axiosLoop(gspURL, true, false)

    retGeoData = {
      geoID: locLabel,
      geoType: geoType,
      geoData: geoData,
      forecast: geoGSP.properties.forecast,
      alert: wxaURL,
      polyMapURL: "",
    }

    return {isValid: true, newGeoID: retGeoData}
  },

  getWXF: async (PwxfURL, PforceRefresh, PkeepTrying) => {
    let wxfURL = ""
    if (!PwxfURL || typeof PwxfURL !== 'string' || !PwxfURL.startsWith('https://api.weather.gov/')) {
      return {isValid: false, errMsg: "Invalid or missing forecast URL. Must be a valid weather.gov API URL", wxfData: undefined}
    }
    else {
      wxfURL = PwxfURL
    }
    
    let forceRefresh = typeof PforceRefresh !== "undefined" ? PforceRefresh : false
    let keepTrying = typeof PkeepTrying !== "undefined" ? PkeepTrying : false

    let resultMsg = "ok"
    let ErrorMsg = "Weather.gov can be flaky, please try again in a few seconds or minutes but it should clear up"
    let freshWeatherResults = undefined //used for wxfURL results pre parsing
    let response = ""
    let useCache = false
    let geoBlock = undefined
    //check cache first and return if recent
    geoBlock = provWeatherGov.provCacheData.find((gArr) => gArr.wxfURL == wxfURL)

    if (
      (geoBlock == undefined ? 0 : geoBlock.length) == 0 ||
      forceRefresh ||
      Date.now() - geoBlock.refDateTimeInt > provWeatherGov.timeLimit
    ) {
      debugLog("geoID not found or past cacheLimit or forcing refresh requested")
      geoBlock = []
      useCache = false
    } else {
      useCache = true
    }

    if (geoBlock.wxfURL !== undefined) {
      debugLog("cache calc info...timeLimit..." + provWeatherGov.timeLimit + "....geoBlock...." + geoBlock.refDateTimeInt)
      debugLog("cache calc info...minus calc " + (Date.now() - parseInt(geoBlock.refDateTimeInt)))
      debugLog("cache calc info ..new calc... " + (Date.now() - parseInt(geoBlock.refDateTimeInt) > provWeatherGov.timeLimit))
      debugLog("cache calc info...orig calc... " + (Date.now() - parseInt(geoBlock.refDateTimeInt) > provWeatherGov.timeLimit))
    }

    debugLog("checked use cache and result is......useCache= " + useCache)
    if (useCache) {
      debugLog("using Cache that becomes wxfVert")
      return {isValid: true, wxfData: geoBlock}
    }

    debugLog("Not using Cache, now going to reach out to Weather.gov...")
    //no cache or out of date, flush it before adding current get
    let gotResponse = false
    for (var i = 0; i < 10; i++) {
      try {
        response = await axios.get(wxfURL, {
          responseType: "json",
          transformResponse: [(v) => v],
        })

        if (response.status == 500) {
          gotResponse = false
        } else {
          gotResponse = true
        }
      } catch (err) {
        debugLog(err)
        gotResponse = false
        //return {result: wxErrorMsg, wxfData: undefined}
      }
      if (gotResponse || !keepTrying) {
        break
      }
      debugLog("Trying Weather.gov again loop..." + i)
      if (i == 9) {
        ErrorMsg = "final Weather.gov fail...looping out of max retries"
      }
      if (keepTrying && i < 5) {
        await provWeatherGov.sleep(1.1)
      } else if (keepTrying) {
        await provWeatherGov.sleep(5)
      }
    } //end loop
    if (!gotResponse) {
      return {isValid: false, errMsg: ErrorMsg, wxfData: undefined}
    }

    freshWeatherResults = JSON.parse(response.data)

    if ((freshWeatherResults.properties.periods == undefined ? 0 : freshWeatherResults.properties.periods.length) == 0)
      return {isValid: false, errMsg: "no periods returned from weather.gov", wxfData: undefined}

    let cacheTime = Date.now()
    let geoBuild = []
    // Use the array from the JSON file to be able to flag "bad" weather forecast periods
    const badWeatherWords = badWeatherData.specificCriteria[0].parameter
    let setBadFlag = false
    let lowercaseDetailedForecast = ""

    const normalizedDays = provWeatherGov.normalizeData(freshWeatherResults)

    geoBlock = {
      wxfURL: wxfURL,
      refDateTimeInt: cacheTime,
      providerType: provWeatherGov.providerType,
      periodResolution: provWeatherGov.periodResolution,
      wxfData: normalizedDays
    }

    return {isValid: true, wxfData: geoBlock}
  }, //end of function

  getWXA: async (PwxaURL, PkeepTrying) => {
    let wxfURL = ""
    if (!PwxaURL || typeof PwxaURL !== 'string' || !PwxaURL.startsWith('https://api.weather.gov/alerts?')) {
      return {isValid: false, errMsg: "Invalid or missing alerts URL. Must be a valid weather.gov API URL", wxfData: undefined}
    }
    else {
      wxfURL = PwxaURL
    }


    let keepTrying = typeof PkeepTrying !== "undefined" ? PkeepTrying : false

    let resultMsg = "ok"
    let ErrorMsg = "Weather.gov can be flaky, please try again in a few seconds or minutes but it should clear up"
    let freshWeatherResults = undefined //used for wxfURL results pre parsing
    let response = ""

    let wxaFlat = []

    debugLog("Never hold Alert Cache, now going to reach out to Weather.gov for..." + wxfURL)
    //no cache or out of date, flush it before adding current get
    let gotResponse = false
    for (var i = 0; i < 10; i++) {
      try {
        response = await axios.get(wxfURL, {
          responseType: "json",
          transformResponse: [(v) => v],
        })
        gotResponse = true
      } catch (err) {
        debugLog("in catch..." + i)
        debugLog(err.response.data.error)
        gotResponse = false
        //return {result: wxErrorMsg, wxfData: undefined}
      }
      if (gotResponse || !keepTrying) {
        break
      }
      debugLog("Trying Weather.gov again loop..." + i)
      if (i == 9) {
        ErrorMsg = "final Weather.gov fail...looping out of max retries"
      }
      if (keepTrying && i < 5) {
        await provWeatherGov.sleep(1.1)
      } else if (keepTrying) {
        await provWeatherGov.sleep(5)
      }
    } //end loop
    if (!gotResponse) {
      return {isValid: false, errMsg: ErrorMsg, wxaData: []}
    }

    freshWeatherResults = JSON.parse(response.data)

    if ((freshWeatherResults.features == undefined ? 0 : freshWeatherResults.features.length) == 0) {
      return {isValid: true, Msg: "no alerts returned from weather.gov", wxaData: []}
    }

    let cacheTime = Date.now()
    debugLog("cacheTime...." + cacheTime)
    let validWeather = []
    freshWeatherResults.features.forEach(function (pedValue, pedKey) {
      const wxaFlat = {
        wxfPeriod: pedKey,
        wxfDayName: pedValue.properties.expires,
        wxfDescr: pedValue.properties.description,
        refDayName: "expires: " + pedValue.properties.expires,
        doReport: provWeatherGov.alertIsCurrent[">="](pedValue.properties.expires),
        formatted:
          "expires: " +
          provWeatherGov.formatDateTime(pedValue.properties.expires) +
          " - " +
          pedValue.properties.headline +
          " \n" +
          pedValue.properties.description,
      }
      if (wxaFlat.doReport) {
        validWeather.push(wxaFlat)
      }
    }) // end of forEach loop

    return {isValid: true, wxaData: validWeather}
  }, //end of function

  getPolyMapURL: async (PwxfURL, PkeepTrying) => {
    debugLog("getPolyMapURL function called...")
    // get the polygon coordinates from the provGeoData
    let wxfURL = ""
    if (!PwxfURL || typeof PwxfURL !== 'string' || !PwxfURL.startsWith('https://api.weather.gov/')) {
      return {isValid: false, errMsg: "Invalid or missing forecast URL. Must be a valid weather.gov API URL", wxfData: undefined}
    }
    else {
      wxfURL = PwxfURL
    }

    let keepTrying = typeof PkeepTrying !== "undefined" ? PkeepTrying : false

    let ErrorMsg = "Weather.gov can be flaky, please try again in a few seconds or minutes but it should clear up"
    let freshWeatherResults = undefined //used for wxfURL results pre parsing
    let response = ""

    let gotResponse = false
    for (var i = 0; i < 10; i++) {
      try {
        response = await axios.get(wxfURL, {
          responseType: "json",
          transformResponse: [(v) => v],
        })

        if (response.status == 500) {
          gotResponse = false
        } else {
          gotResponse = true
        }
      } catch (err) {
        debugLog(err)
        gotResponse = false
        //return {result: wxErrorMsg, wxfData: undefined}
      }
      if (gotResponse || !keepTrying) {
        break
      }
      debugLog("Trying Weather.gov again loop..." + i)
      if (i == 9) {
        ErrorMsg = "final Weather.gov fail...looping out of max retries"
      }
      if (keepTrying && i < 5) {
        await provWeatherGov.sleep(1.1)
      } else if (keepTrying) {
        await provWeatherGov.sleep(5)
      }
    } //end loop
    if (!gotResponse) {
      return {isValid: false, errMsg: ErrorMsg, wxfData: undefined}
    }

    freshWeatherResults = JSON.parse(response.data)

    if ((freshWeatherResults.geometry == undefined ? 0 : freshWeatherResults.geometry.coordinates.length) == 0)
      return {isValid: false, errMsg: "no coordinates returned from weather.gov", wxfData: undefined}

    let cacheTime = Date.now()
    let polyURL = "https://www.keene.edu/campus/maps/tool/?coordinates="

    // Check if geometry and coordinates exist
    if (freshWeatherResults.geometry && freshWeatherResults.geometry.coordinates) {
      // Loop through each polygon (usually just one)
      freshWeatherResults.geometry.coordinates.forEach((polygon, polyIndex) => {
        // Loop through each point in the polygon
        polygon.forEach((point, index) => {
          // Add the point to the URL
          polyURL += point[0] + "," + point[1]

          // Add %0A if it's not the last point in the polygon
          if (index < polygon.length - 1) {
            polyURL += "%0A"
          }
        })

        // Close the polygon by adding the first point again
        if (polygon.length > 0) {
          polyURL += "%0A" + polygon[0][0] + "," + polygon[0][1]
        }

        // Add %0A between polygons if there are multiple
        if (polyIndex < freshWeatherResults.geometry.coordinates.length - 1) {
          polyURL += "%0A"
        }
      })
    } else {
      return {isValid: false, errMsg: "No geometry coordinates found", wxfData: undefined}
    }

    return {isValid: true, polyURL: polyURL}
  }, // end of function

  normalizeData: (rawData) => {
    const currentDate = new Date()
    
    // Group periods by day first
    const dayPeriods = rawData.properties.periods.reduce((days, period) => {
      const date = new Date(period.startTime)
      const dayKey = date.toISOString().split('T')[0]
      
      if (!days[dayKey]) {
        days[dayKey] = {
          periods: [],
          high: -Infinity,
          low: Infinity,
          date: date
        }
      }

      // Add period with null checks
      days[dayKey].periods.push(new WxPeriod({
        timeOfDay: period.isDaytime ? 'day' : 'night',
        startTime: period.startTime || date.toISOString(),
        endTime: period.endTime || new Date(date.getTime() + 12*60*60*1000).toISOString(),
        temp: period.temperature || 0,
        description: period.detailedForecast || "No description available",
        precip: period.probabilityOfPrecipitation?.value || 0,
        precipAmount: 0, // weather.gov doesn't provide amount
        wind: {
          speed: WxDataNormalizer.extractWindSpeed(period.windSpeed || "0 mph"),
          gust: WxDataNormalizer.extractGustSpeed(period.detailedForecast || ""),
          direction: period.windDirection || ""
        },
        clouds: 0, // weather.gov doesn't provide cloud coverage
        visibility: 0 // weather.gov doesn't provide visibility
      }))

      // Update high/low based on time of day
      if (period.isDaytime) {
        days[dayKey].high = Math.max(days[dayKey].high, period.temperature || 0)
      } else {
        days[dayKey].low = Math.min(days[dayKey].low, period.temperature || 0)
      }

      return days
    }, {})

    // Convert each day's data into WxDay objects
    return Object.entries(dayPeriods).map(([dateKey, data]) => {
      // Check each period for bad weather
      const periodsWithBadWeatherCheck = data.periods.map(period => ({
        ...period,
        isBadWeather: WxDataNormalizer.checkForBadWeather(period.conditions.description)
      }))

      // Get the day name from the date
      const dayName = data.date.toLocaleDateString('en-US', { weekday: 'long' })

      return new WxDay({
        date: data.date,
        dayOfWeek: dayName,
        highTemp: data.high === -Infinity ? 0 : data.high,
        lowTemp: data.low === Infinity ? 0 : data.low,
        description: periodsWithBadWeatherCheck[0]?.description || "No description available",
        precipProb: periodsWithBadWeatherCheck[0]?.conditions?.precipitation?.probability || 0,
        precipAmount: 0, // weather.gov doesn't provide amount
        windSpeed: periodsWithBadWeatherCheck[0]?.conditions?.wind?.speed || 0,
        windGust: periodsWithBadWeatherCheck[0]?.conditions?.wind?.gust || 0,
        windDir: periodsWithBadWeatherCheck[0]?.conditions?.wind?.direction || "",
        periods: periodsWithBadWeatherCheck,
        isBadWeather: periodsWithBadWeatherCheck.some(period => period.isBadWeather)
      })
    })
  },
} //end of provWeatherGov export

module.exports = {provWeatherGov}
