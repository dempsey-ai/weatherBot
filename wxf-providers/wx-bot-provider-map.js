// THIS FILE CONTAINS THE MAP OF THE WEATHER DATA PROVIDERS AND THE FUNCTIONS THAT FETCH THE WEATHER DATA FROM THE PROVIDERS FOR THE BOT FRAMEWORK

// THE PROVIDERS COULD BE:
// 1. weather.gov
// 2. weatherbit.io (50 calls/day, 7 day forecast)
// 3. openweathermap.org (5 day forecast)

// CURRENTLY IMPLEMENTED PROVIDERS:
// 1. weather.gov
const weatherGov = require("./wx-src-weathergov-new")
// 2. weatherbit.io
const weatherBit = require("./wx-src-weatherbit")


//const openWeatherMap = require("./wx-src-openweathermap");
//const openMeteo = require("./wx-src-openmeteo");

// MAP TOOL:
// https://www.keene.edu/campus/maps/tool/?coordinates=
// concatenate the coordinates (in reverse order) into a string with spaces between the coordinates
// then append to the url
// then open in browser

const { WxDataNormalizer } = require("./wx-data-normalizer")
const cfg = require("../wx-bot-config")
const debugLog = (msg) => {
  if (cfg.appConfig.isDebug) {
    console.log(msg)
  }
  return
}

// PROVIDER MAP TEMPLATE:
const wxWgovFunctions = {
  providerName: weatherGov.provWeatherGov.providerName || "unknown",
  wxfTemplate: [
    {
      geoID: "",
      geoType: "",
      refDateTimeInt: 0,
      wxfPeriod: [
        {
          wxfPeriod: {},
          asofStamp: {},
          wxfDayName: {},
          wxfWindSpeed: {},
          wxfPrecip: {},
          wxfTemp: {},
          wxfIsDaytime: {},
          wxfDescr: {},
          refDayName: {},
          refBadFlag: {},
        },
      ],
    },
  ],

  provGeoData: weatherGov.provWeatherGov.provGeoData,
  provCacheData: weatherGov.provWeatherGov.provCacheData,

  getProvForecastData: async (wxChatUser) => {
    debugLog("getProvForecastData function called...")
    let result = false

    const userLocation = wxChatUser.location
    if (!userLocation) {
      debugLog("No location information available for user")
      return {isValid: false, wxfData: undefined}
    }

    const {label, type, value} = userLocation
    const locID = value

    const existingLocation = wxWgovFunctions.provGeoData.find((loc) => loc.geoData === locID)
    if (existingLocation) {
      debugLog("existingLocation found: " + JSON.stringify(existingLocation, null, 3))

      const getWXF_result = await weatherGov.provWeatherGov.getWXF(existingLocation.forecast, false, true)
      console.log(`


        =========== weather.gov wxfProv ==================
        ${JSON.stringify(getWXF_result, null, 3)}`);
      
      if (getWXF_result.isValid) {
        const wxfFinal = WxDataNormalizer.normalize(getWXF_result.wxfData)
        debugLog(`

        =========== weather.gov wxfFinal ==================
        ${JSON.stringify(wxfFinal, null, 3)}`);

        if (wxfFinal.isValid) { 
          result = true 
          return {isValid: result, wxfData: wxfFinal.wxfData}
        }
      }
      else {
        debugLog("No forecast data available for location: " + locID)
        return {isValid: false, wxfData: undefined}
      }
    }
    else {
      debugLog("No forecast URL available for location: " + locID)
      return {isValid: false, wxfData: undefined}
    }

    return {isValid: result, wxfData: undefined}

  },

  getProvPolyMapURL: async (wxChatUser) => {
    debugLog("getProvPolyMapURL function called...")
    let result = false

    const userLocation = wxChatUser.location
    if (!userLocation) {
      debugLog("No location information available for user")
      return {isValid: false, polyURL: undefined}
    }

    const {value: locID} = userLocation

    debugLog("getProvPolyMapURL existingLocation search: " + locID)
    const existingLocation = wxWgovFunctions.provGeoData.find((loc) => loc.geoData === locID)
    if (existingLocation?.forecast) {
      const getPolyMapURL_result = await weatherGov.provWeatherGov.getPolyMapURL(existingLocation.forecast, true)
      if (getPolyMapURL_result.isValid) {
        result = true 
        debugLog("getPolyMapURL_result: " + JSON.stringify(getPolyMapURL_result, null, 3))
        return {isValid: result, polyURL: getPolyMapURL_result.polyURL}
      }
    }

    debugLog("No forecast URL available for location: " + locID)
    return {isValid: false, polyURL: undefined}
  },

  getwxAlertsData: async (wxChatUser) => {
    let result = false
    const userLocation = wxChatUser.location
    if (!userLocation) {
      debugLog("No location information available for user")
      return {isValid: false, wxaData: undefined}
    }

    const {value: locID} = userLocation

    const existingLocation = wxWgovFunctions.provGeoData.find((loc) => loc.geoData === locID)
    if (existingLocation?.alert) {
      const getWXA_result = await weatherGov.provWeatherGov.getWXA(existingLocation.alert, true)
      if (getWXA_result.isValid) {
        result = true 
        return {isValid: result, wxaData: getWXA_result.wxaData}
      }
    }

    debugLog("No alert URL available for location: " + locID)
    return {isValid: false, wxaData: undefined}
  },

  createProvGeoLoc: async (wxChatUser) => {
    let result = false
    let userLocation = wxChatUser.location
    let newGeoData = await weatherGov.provWeatherGov.createGeoData(userLocation.label, userLocation.type, userLocation.value)

    debugLog("newGeoData: " + JSON.stringify(newGeoData, null, 3))
    result = newGeoData.isValid
    return {isValid: result}
  },

  updateProvGeoData: async function (wxChatUser) {
    const userLocation = wxChatUser.location
    if (!userLocation) {
      debugLog("No location information available for user")
      return undefined
    }

    const {label, type, value} = userLocation
    const locID = value

    const existingLocation = wxWgovFunctions.provGeoData.find((loc) => loc.geoData === locID)
    if (existingLocation) {
      debugLog(`Location ${locID} already exists in provGeoData`)
      return existingLocation
    }

    try {
      const newGeoData = await weatherGov.provWeatherGov.createGeoData(label, type, value)
      if (newGeoData.isValid) {
        wxWgovFunctions.provGeoData.push(newGeoData.newGeoID)
        console.log(`Added new location ${label} to provGeoData`)
        return newGeoData.newGeoID
      }
      console.log(`Failed to create geo data for ${label}`)
      return undefined
    } catch (error) {
      console.error(`Error creating geo data for ${label}:`, error)
      return undefined
    }
  },
}



const wxWbitFunctions = {
  providerName: weatherBit.provWeatherBit.providerName || "unknown",
  wxfTemplate: [
    {
      geoID: "",
      geoType: "",
      refDateTimeInt: 0,
      wxfPeriod: [
        {
          wxfPeriod: {},
          asofStamp: {},
          wxfDayName: {},
          wxfWindSpeed: {},
          wxfPrecip: {},
          wxfTemp: {},
          wxfIsDaytime: {},
          wxfDescr: {},
          refDayName: {},
          refBadFlag: {},
        },
      ],
    },
  ],

  provGeoData: weatherBit.provWeatherBit.provGeoData,
  provCacheData: weatherBit.provWeatherBit.provCacheData,

  getProvForecastData: async (wxChatUser) => {
    debugLog("getProvForecastData function called...")
    let result = false

    const userLocation = wxChatUser.location
    if (!userLocation) {
      debugLog("No location information available for user")
      return {isValid: false, wxfData: undefined}
    }

    const {label, type, value} = userLocation
    const locLabel = label || `${type}:${value}`
    const locID = value

    const existingLocation = wxWbitFunctions.provGeoData.find((loc) => loc.geoData === locID)
    if (existingLocation) {
      debugLog("existingLocation found: " + JSON.stringify(existingLocation, null, 3))

      const getWXF_result = await weatherBit.provWeatherBit.getWXF(existingLocation.forecast, false, true)
      console.log(`


        =========== weatherbit.io wxfProv ==================
        ${JSON.stringify(getWXF_result, null, 3)}`);
      
      if (getWXF_result.isValid) {
        const wxfFinal = WxDataNormalizer.normalize(getWXF_result.wxfData)
        debugLog(`

        =========== weatherbit.io wxfFinal ==================
        ${JSON.stringify(wxfFinal, null, 3)}`);

        if (wxfFinal.isValid) { 
          result = true 
          return {isValid: result, wxfData: wxfFinal.wxfData}
        }
      }
      else {
        debugLog("No forecast data available for location: " + locID)
        return {isValid: false, wxfData: undefined}
      }
    }
    else {
      debugLog("No forecast URL available for location: " + locID)
      return {isValid: false, wxfData: undefined}
    }

    return {isValid: result, wxfData: undefined}
  },

  getProvPolyMapURL: async (wxChatUser) => {
    debugLog("getProvPolyMapURL function called...")
    // Weatherbit.io doesn't support polygon mapping
    return {isValid: false, errMsg: "Polygon mapping not supported by weatherbit.io", polyURL: undefined}
  },

  getwxAlertsData: async (wxChatUser) => {
    let result = false
    const userLocation = wxChatUser.location
    if (!userLocation) {
      debugLog("No location information available for user")
      return null
    }

    const {label, type, value} = userLocation
    const locLabel = label || `${type}:${value}`
    const locID = value

    const existingLocation = wxWbitFunctions.provGeoData.find((loc) => loc.geoData === locID)
    if (existingLocation.alert) {
      const getWXA_result = await weatherBit.provWeatherBit.getWXA(existingLocation.alert, true)
      if (getWXA_result.isValid) {
        result = true 
        return {isValid: result, wxaData: getWXA_result.wxaData}
      }
    }
    else {
      debugLog("No alert URL available for location: " + locID)
      return {isValid: false, wxaData: undefined}
    }

    return {isValid: result, wxaData: undefined}
  },

  createProvGeoLoc: async (wxChatUser) => {
    let result = false
    let userLocation = wxChatUser.location
    let newGeoData = await weatherBit.provWeatherBit.createGeoData(userLocation.label, userLocation.type, userLocation.value)

    debugLog("newGeoData: " + JSON.stringify(newGeoData, null, 3))
    result = true 
    return {isValid: result}
  },

  updateProvGeoData: async function (wxChatUser) {
    const userLocation = wxChatUser.location
    if (!userLocation) {
      debugLog("No location information available for user")
      return undefined
    }

    const {label, type, value} = userLocation
    const locLabel = label || `${type}:${value}`
    const locID = value

    const existingLocation = wxWbitFunctions.provGeoData.find((loc) => loc.geoData === locID)
    if (existingLocation) {
      debugLog(`Location ${locID} already exists in provGeoData`)
      return existingLocation
    }

    try {
      const newGeoData = await weatherBit.provWeatherBit.createGeoData(locLabel, type, value)
      if (newGeoData.isValid) {
        wxWbitFunctions.provGeoData.push(newGeoData.newGeoID)
        console.log(`Added new location ${locLabel} to provGeoData`)
        return newGeoData.newGeoID
      } else {
        console.log(`Failed to create geo data for ${locLabel}`)
        return undefined
      }
    } catch (error) {
      console.error(`Error creating geo data for ${locLabel}:`, error)
      return undefined
    }
  },
}

// To use weatherbit.io provider, uncomment this line:
//const activeProvider = wxWbitFunctions

// Currently using weather.gov provider:
const activeProvider = wxWgovFunctions


module.exports = {activeProvider}
