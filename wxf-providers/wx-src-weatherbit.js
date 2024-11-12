// PROVIDER: weatherbit.io
// API: Weatherbit.io Weather API
// URL: https://api.weatherbit.io/v2.0/
// DOCUMENTATION: https://www.weatherbit.io/api/weather-forecast-16-day

const axios = require("axios").default
const badWeatherData = require("../wx-bot-wordlists/bad_weather.json")
const cfg = require("../wx-bot-config")
const { WX_DATA_TYPES, WX_CAPABILITIES, WX_PERIOD_RESOLUTION } = require('./wx-provider-types')
const { WxDay, WxPeriod, WxDataNormalizer } = require('./wx-data-normalizer')

const debugLog = (msg) => {
  if (cfg.appConfig.isDebug) {
    console.log(msg)
  }
  return
}

const provWeatherBit = {
  providerName: "weatherbit.io",
  providerType: WX_DATA_TYPES.DAILY,
  periodResolution: WX_PERIOD_RESOLUTION.DAILY,
  capabilities: [WX_CAPABILITIES.ALERTS],
  provGeoData: [],
  provCacheData: [],

  timeLimit: 3600000 * 1, // 1 hour cache
  
  formatDateTime: (timestamp) => {
    const date = new Date(timestamp * 1000)
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long", 
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short"
    }
    return date.toLocaleString("en-US", options)
  },

  getDayName: (date) => {
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()]
  },

  sleep: async (manySecs) => {
    return new Promise((resolve) => {
      setTimeout(resolve, manySecs * 1000)
    })
  },

  axiosLoop: async (wxfURL, keepTrying) => {
    let retVal = ""
    let response = ""
    let gotResponse = false
    let ErrorMsg = "Weatherbit.io API error, please try again"

    for (var i = 0; i < 10; i++) {
      try {
        response = await axios.get(wxfURL, {
          responseType: "json",
          transformResponse: [(v) => v],
        })
        gotResponse = true
      } catch (err) {
        debugLog("API call error: " + err)
        gotResponse = false
      }

      if (gotResponse || !keepTrying) break

      if (i == 9) {
        ErrorMsg = "Failed after maximum retries"
      }
      
      await provWeatherBit.sleep(keepTrying ? (i < 5 ? 1.1 : 5) : 0)
    }

    if (!gotResponse) {
      return {result: ErrorMsg, wxfData: undefined}
    }

    retVal = JSON.parse(response.data)
    return retVal
  },

  createGeoData: async (locLabel, geoType, geoData) => {
    debugLog(`Creating geo data for ${locLabel} (${geoType}: ${geoData})`)

    let retGeoData = {
      geoID: locLabel,
      geoType: geoType,
      geoData: geoData,
      forecast: "",
      alert: "",
      polyMapURL: "",
      providerType: provWeatherBit.providerType,
      periodResolution: provWeatherBit.periodResolution
    }

    // Build API URLs based on location type
    const apiKey = cfg.appConfig.wxProviderApiKey
    let locationParam = ""

    if (geoType === "loc-gps") {
      const [lat, lon] = geoData.split(",")
      locationParam = `lat=${lat}&lon=${lon}`
    } else if (geoType === "loc-city") {
      locationParam = `city=${encodeURIComponent(geoData)}`
    } else if (geoType === "loc-zip") {
      locationParam = `postal_code=${geoData}`
    }

    // Add units=I to get Imperial units (Fahrenheit, mph, inches)
    retGeoData.forecast = `https://api.weatherbit.io/v2.0/forecast/daily?${locationParam}&units=I&key=${apiKey}`
    retGeoData.alert = `https://api.weatherbit.io/v2.0/alerts?${locationParam}&key=${apiKey}`

    return {isValid: true, newGeoID: retGeoData}
  },

  getWXF: async (PwxfURL, PforceRefresh, PkeepTrying) => {
    let wxfURL = ""
    if (!PwxfURL || typeof PwxfURL !== 'string' || !PwxfURL.startsWith('https://api.weatherbit.io/')) {
      return {isValid: false, errMsg: "Invalid or missing forecast URL. Must be a valid weatherbit.io API URL", wxfData: undefined}
    }
    else {
      wxfURL = PwxfURL
    }

    let forceRefresh = PforceRefresh || false
    let keepTrying = PkeepTrying || false

    // Check cache first
    let geoBlock = provWeatherBit.provCacheData.find(g => g.wxfURL === wxfURL)
    
    if (geoBlock && !forceRefresh && (Date.now() - geoBlock.refDateTimeInt <= provWeatherBit.timeLimit)) {
      return {isValid: true, wxfData: geoBlock}
    }

    // Fetch fresh data
    const freshWeatherResults = await provWeatherBit.axiosLoop(wxfURL, keepTrying)
    if (!freshWeatherResults.data) {
      return {isValid: false, errMsg: "No forecast data returned", wxfData: undefined}
    }

    const cacheTime = Date.now()
    const badWeatherWords = badWeatherData.specificCriteria[0].parameter
    const geoBuild = []

    const normalizedDays = freshWeatherResults.data
      .filter(dayData => {
        const forecastDate = new Date(dayData.valid_date)
        const today = new Date()
        // Set to midnight for clean date comparison
        today.setHours(0, 0, 0, 0)
        forecastDate.setHours(0, 0, 0, 0)
        return forecastDate >= today
      })
      .map(dayData => provWeatherBit.normalizeData(dayData))

    geoBlock = {
      wxfURL: wxfURL,
      refDateTimeInt: cacheTime,
      providerType: provWeatherBit.providerType,
      periodResolution: provWeatherBit.periodResolution,
      wxfData: normalizedDays
    }

    provWeatherBit.provCacheData.push(geoBlock)
    return {isValid: true, wxfData: geoBlock}
  },

  getWXA: async (PwxaURL, PkeepTrying) => {
    let wxfURL = ""
    if (!PwxaURL || typeof PwxaURL !== 'string' || !PwxaURL.startsWith('https://api.weatherbit.io/v2.0/alerts')) {
      return {isValid: false, errMsg: "Invalid or missing alerts URL. Must be a valid weatherbit.io API URL", wxaData: []}
    }
    else {
      wxfURL = PwxaURL
    }

    let keepTrying = PkeepTrying || false

    const alertResults = await provWeatherBit.axiosLoop(wxfURL, keepTrying)
    if (!alertResults.alerts) {
      return {isValid: true, wxaData: []}
    }

    const validAlerts = alertResults.alerts.map((alert, index) => ({
      wxfPeriod: index,
      wxfDayName: alert.expires_local,
      wxfDescr: alert.description,
      refDayName: `expires: ${alert.expires_local}`,
      doReport: true,
      formatted: `expires: ${provWeatherBit.formatAlertTime(alert.expires_local)} - ${alert.title}\n${alert.description}`
    }))

    return {isValid: true, wxaData: validAlerts}
  },

  formatAlertTime: (dateString) => {
    const date = new Date(dateString)
    const options = {
      weekday: "long",
      month: "long", 
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short"
    }
    return date.toLocaleString("en-US", options)
  },

  // Weatherbit.io doesn't provide polygon data for mapping
  getPolyMapURL: async () => {
    return {isValid: false, errMsg: "Polygon mapping not supported by weatherbit.io", polyURL: undefined}
  },

  createEnhancedDescription: (dayData) => {
    let description = []
    
    // Temperature narrative
    const tempPhrase = `High of ${Math.round(dayData.high_temp)}°F`
    description.push(tempPhrase)

    // Special weather conditions based on codes
    const weatherCode = dayData.weather.code
    let specialCondition = ""
    
    // Check for severe/special weather conditions first
    if ([200, 201, 202, 230, 231, 232].includes(weatherCode)) {
      specialCondition = "Thunderstorms"
    } else if (weatherCode === 233) {
      specialCondition = "Hail"
    } else if (weatherCode === 511) {
      specialCondition = "Freezing rain"
    } else if ([600, 601, 602, 621, 622, 623].includes(weatherCode)) {
      specialCondition = "Snow"
    } else if (weatherCode === 610) {
      specialCondition = "Mixed snow and rain"
    } else if ([611, 612].includes(weatherCode)) {
      specialCondition = "Sleet"
    } else if (weatherCode === 711) {
      specialCondition = "Smoke"
    } else if (weatherCode === 721) {
      specialCondition = "Haze"
    } else if (weatherCode === 731) {
      specialCondition = "Sand/dust"
    } else if (weatherCode === 741) {
      specialCondition = "Fog"
    } else if (weatherCode === 751) {
      specialCondition = "Freezing fog"
    }

    if (specialCondition) {
      description.push(specialCondition)
    }

    // Cloud coverage narrative
    let cloudPhrase = ""
    const totalCloud = (dayData.clouds_low + dayData.clouds_mid + dayData.clouds_hi) / 3
    if (totalCloud < 20) cloudPhrase = "Clear skies"
    else if (totalCloud < 40) cloudPhrase = "Mostly sunny"
    else if (totalCloud < 60) cloudPhrase = "Partly cloudy"
    else if (totalCloud < 80) cloudPhrase = "Mostly cloudy"
    else cloudPhrase = "Cloudy"
    description.push(cloudPhrase)

    // Precipitation narrative
    if (dayData.pop > 0) {
      let rainIntensity = ""
      if (dayData.precip < 0.25) rainIntensity = "light"
      else if (dayData.precip < 0.5) rainIntensity = "moderate"
      else if (dayData.precip < 0.75) rainIntensity = "heavy"
      else rainIntensity = "very heavy"

      let rainLikelihood = ""
      if (dayData.pop >= 80) rainLikelihood = dayData.pop + "% chance, expect"
      else if (dayData.pop >= 60) rainLikelihood = dayData.pop + "% chance, likely to see"
      else if (dayData.pop >= 40) rainLikelihood = dayData.pop + "% chance of"
      else rainLikelihood = dayData.pop + "% slight chance of"

      if (dayData.precip >= 0.1) {
        let rainPhrase = `${rainLikelihood} ${rainIntensity} rain`
        if (dayData.precip >= 0.5) {
          rainPhrase += ` with accumulation possible of ${dayData.precip.toFixed(2)} inches`
        }
        description.push(rainPhrase)
      }
    }

    // Snow narrative (if applicable)
    if (dayData.snow > 0) {
      let snowIntensity = ""
      if (dayData.snow < 2) snowIntensity = dayData.snow + "% chance, light snow"
      else if (dayData.snow < 4) snowIntensity = dayData.snow + "% chance, moderate snow"
      else if (dayData.snow < 6) snowIntensity = dayData.snow + "% chance, heavy snow"
      else snowIntensity = dayData.snow + "% chance, blizzard conditions"
      
      description.push(snowIntensity)
    }

    // Wind narrative
    let windPhrase = ""
    const windSpeed = Math.round(dayData.wind_spd)
    const gustSpeed = Math.round(dayData.wind_gust_spd)
    
    if (windSpeed < 5) {
      windPhrase = "Winds under 5 mph"
    } else if (windSpeed < 10) {
      windPhrase = `Light winds under 10 mph from the ${dayData.wind_cdir_full.toLowerCase()}`
    } else {
      windPhrase = `Windy with winds from the ${dayData.wind_cdir_full.toLowerCase()} at ${windSpeed} mph`
    }
    
    if (gustSpeed > windSpeed + 10) {
      windPhrase += ` with gusts to ${gustSpeed} mph`
    }
    
    description.push(windPhrase)

    // Humidity/comfort narrative
    if (dayData.rh > 80) {
      description.push("Humidity over 80%")
    } else if (dayData.rh < 30) {
      description.push("Humidity under 30%")
    }

    // Visibility narrative (if poor)
    if (dayData.vis < 5) {
      description.push(`Poor visibility around ${dayData.vis} miles`)
    }

    // Add night time low temperature
    description.push(`Night time low temp of ${Math.round(dayData.low_temp)}°F`)


    // Sun/Moon narrative
    const sunrise = new Date(dayData.sunrise_ts * 1000)
    const sunset = new Date(dayData.sunset_ts * 1000)
    const moonPhase = dayData.moon_phase_lunation
    
    // Format times
    const sunriseTime = sunrise.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const sunsetTime = sunset.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    
    // Add sunrise and sunset
    description.push(`Sunrise ${sunriseTime}, sunset ${sunsetTime}`)
    
    // Add moon phase only at significant points
    if (Math.abs(moonPhase - 0) < 0.05 || Math.abs(moonPhase - 1) < 0.05) {
      description.push(" !6 New moon!")
    } else if (Math.abs(moonPhase - 0.25) < 0.05) {
      description.push(" !6 First quarter moon!")
    } else if (Math.abs(moonPhase - 0.5) < 0.05) {
      description.push(" !6 Full moon!")
    } else if (Math.abs(moonPhase - 0.75) < 0.05) {
      description.push(" !6 Last quarter moon!")
    }
    
    // Combine all elements into a natural-sounding description
    return description.join(". ") + "."
  },

  normalizeData: (rawData) => {
    const description = provWeatherBit.createEnhancedDescription(rawData)
    const forecastDate = new Date(rawData.valid_date)
    const adjustedDayName = WxDataNormalizer.getAdjustedDayName(forecastDate)

    return new WxDay({
      date: forecastDate,
      dayOfWeek: adjustedDayName,
      highTemp: rawData.high_temp || 0,
      lowTemp: rawData.low_temp || 0,
      description: description,
      precipProb: rawData.pop || 0,
      precipAmount: rawData.precip || 0,
      windSpeed: rawData.wind_spd || 0,
      windGust: rawData.wind_gust_spd || 0,
      windDir: rawData.wind_cdir_full || "",
      isBadWeather: WxDataNormalizer.checkForBadWeather(description),
      periods: [{
        timeOfDay: 'day',
        startTime: forecastDate.setHours(6, 0, 0, 0),
        endTime: forecastDate.setHours(18, 0, 0, 0),
        temp: rawData.high_temp || 0,
        description: description,
        precip: rawData.pop || 0,
        precipAmount: rawData.precip || 0,
        wind: {
          speed: rawData.wind_spd || 0,
          gust: rawData.wind_gust_spd || 0,
          direction: rawData.wind_cdir_full || ""
        },
        clouds: (rawData.clouds_low + rawData.clouds_mid + rawData.clouds_hi) / 3 || 0,
        visibility: rawData.vis || 0
      }]
    })
  }

  
}

module.exports = {provWeatherBit} 