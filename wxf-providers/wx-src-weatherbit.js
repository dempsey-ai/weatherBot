// PROVIDER: weatherbit.io
// API: Weatherbit.io Weather API
// URL: https://api.weatherbit.io/v2.0/
// DOCUMENTATION: https://www.weatherbit.io/api/weather-forecast-16-day

const axios = require("axios").default
const badWeatherData = require("../wx-bot-wordlists/bad_weather.json")
const cfg = require("../wx-bot-config")

const debugLog = (msg) => {
  if (cfg.appConfig.isDebug) {
    console.log(msg)
  }
  return
}

const provWeatherBit = {
  providerName: "weatherbit.io",
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
      polyMapURL: ""
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

    // Process each day's forecast and create both day/night periods
    freshWeatherResults.data.forEach((day, index) => {
      const dayTemp = day.high_temp
      const nightTemp = day.low_temp
      const description = day.weather.description
      const windSpeed = day.wind_spd
      const precipitation = day.pop
      const validDate = new Date(day.valid_date)
      const dayName = provWeatherBit.getDayName(validDate)

      // Check for bad weather conditions
      const setBadFlag = badWeatherWords.some(word => 
        description.toLowerCase().includes(word.toLowerCase())
      )

      // Create daytime period
      geoBuild.push({
        wxfPeriod: index * 2,
        wxfDayName: dayName,
        wxfWindSpeed: `${Math.round(windSpeed)} mph`,
        wxfPrecip: precipitation,
        wxfTemp: Math.round(dayTemp),
        wxfIsDaytime: true,
        wxfDescr: provWeatherBit.createEnhancedDescription(day),
        refDayName: dayName,
        refDOW: dayName,
        refDOW_int: validDate.getDay() + 1,
        refNextDayFlag: index === 1,
        refRainPrecip: precipitation,
        refWindSpeed: Math.round(windSpeed),
        refGustSpeedMax: Math.round(day.wind_gust_spd),
        refBadFlag: setBadFlag
      })

      // Create nighttime period
      geoBuild.push({
        wxfPeriod: index * 2 + 1,
        wxfDayName: `${dayName} Night`,
        wxfWindSpeed: `${Math.round(windSpeed)} mph`,
        wxfPrecip: precipitation,
        wxfTemp: Math.round(nightTemp),
        wxfIsDaytime: false,
        wxfDescr: `Night time low temperature of ${Math.round(nightTemp)} degrees`,
        refDayName: `${dayName} Night`,
        refDOW: dayName,
        refDOW_int: validDate.getDay() + 1,
        refNextDayFlag: false,
        refRainPrecip: precipitation,
        refWindSpeed: Math.round(windSpeed),
        refGustSpeedMax: Math.round(day.wind_gust_spd),
        refBadFlag: setBadFlag
      })
    })

    geoBlock = {
      wxfURL: wxfURL,
      refDateTimeInt: cacheTime,
      wxfPeriod: geoBuild
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
      wxfDayName: alert.expires_at,
      wxfDescr: alert.description,
      refDayName: `expires: ${alert.expires_at}`,
      doReport: true,
      formatted: `expires: ${provWeatherBit.formatDateTime(alert.expires_at)} - ${alert.title}\n${alert.description}`
    }))

    return {isValid: true, wxaData: validAlerts}
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
      if (dayData.pop >= 80) rainLikelihood = "Expect"
      else if (dayData.pop >= 60) rainLikelihood = "Likely to see"
      else if (dayData.pop >= 40) rainLikelihood = "Chance of"
      else rainLikelihood = "Slight chance of"

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
      if (dayData.snow < 2) snowIntensity = "Light snow"
      else if (dayData.snow < 4) snowIntensity = "Moderate snow"
      else if (dayData.snow < 6) snowIntensity = "Heavy snow"
      else snowIntensity = "Blizzard conditions"
      
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
      description.push("New moon")
    } else if (Math.abs(moonPhase - 0.25) < 0.05) {
      description.push("First quarter moon")
    } else if (Math.abs(moonPhase - 0.5) < 0.05) {
      description.push("Full moon")
    } else if (Math.abs(moonPhase - 0.75) < 0.05) {
      description.push("Last quarter moon")
    }
    
    // Combine all elements into a natural-sounding description
    return description.join(". ") + "."
  }
}

module.exports = {provWeatherBit} 