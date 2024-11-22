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


const cfg = require("../wx-bot-config");
//const { WX_DATA_TYPES, WX_CAPABILITIES, WX_PERIOD_RESOLUTION } = require('./wx-provider-types');
const { WX_DATA_TYPES, WX_CAPABILITIES, WX_PERIOD_RESOLUTION, findMaxNumInStr, axiosLoop } = require('./wx-provider-utils');

const debugLog = (msg) => {
  if (cfg.appConfig.isDebug) {
    console.log(msg);
  }
};

const WB_BAD_WEATHER_CODES = undefined;

const provWeatherGov = {
  providerName: "weather.gov",
  providerType: WX_DATA_TYPES.MULTI_PERIOD,
  periodResolution: WX_PERIOD_RESOLUTION.TWELVE_HOUR,
  capabilities: {
    hasAlerts: true,
    hasPolygons: true,
    hasPrecipAmount: false,
    hasHourlyData: false,
    useEnhancedDescription: false,
    hasCodesForBadFlag: false,
    badWeatherCodes: WB_BAD_WEATHER_CODES || [-1]
  },

  timeLimit: 3600000 * 1, // 1 hour cache
  provCacheData: [],
  provGeoData: [],

  // Placeholder enhanced description (not used by weather.gov)
  createEnhancedDescription: () => "",

  // Convert raw weather.gov data to wxfProv format
  normalizeToWxfProv: (rawData, location) => {
    const currentDate = new Date();
    let firstPeriodIsNight = false;

    const periods = rawData.properties.periods.map((period, index) => {
      // Parse dates consistently - get local date from startTime without timezone conversion
      let date = period.startTime.split('T')[0];
      let periodDate = new Date(date + 'T00:00:00');  // Create Date object at start of day to avoid timezone issues

      // Check for prior night condition on first period only
      if (index === 0) {
        firstPeriodIsNight = currentDate.getHours() < 6 && 
                            !period.isDaytime && 
                            periodDate.toISOString().split('T')[0] === currentDate.toISOString().split('T')[0];
        
        if (firstPeriodIsNight) {
          periodDate.setDate(periodDate.getDate() - 1);
          periodDate.setHours(18, 0, 0, 0);
          date = periodDate.toISOString().split('T')[0];
        }
      }

      return {
        date,     //date of period is a challenge with weather.gov, hence the custom code above
        isDaytime: period.isDaytime,  
        startTime: periodDate,   //startTime of period is a challenge with weather.gov, hence the custom code above
        endTime: period.endTime,
        temperature: {
          value: period.isDaytime ? period.temperature : undefined,
          low: period.isDaytime ? undefined : period.temperature,
          feelsLike: undefined
        },
        conditions: {
          description: period.detailedForecast,    //weather.gov has a good description already, can use as is
          enhancedDescription: "",   //not needed with weather.gov
          precipitation: {
            probability: period.probabilityOfPrecipitation?.value ?? 0,
            amount: undefined,
            type: undefined
          },
          wind: {
            speed: findMaxNumInStr(period.windSpeed),  //normalizer will extract from description if not incl from provider
            gust: undefined, //normalizer will extract from description if not incl from provider
            direction: period.windDirection
          },
          atmospheric: {
            visibility: undefined,
            humidity: undefined,
            pressure: undefined,
            dewpoint: undefined,
            uvIndex: undefined
          }
        },
        astronomy: {
          sunrise: undefined,
          sunset: undefined,
          moonPhase: undefined
        },
        flags: {
          isBadWeather: false
        }
      };
    });

    return {
      metadata: {
        provider: {
          name: provWeatherGov.providerName,
          type: provWeatherGov.providerType,
          periodResolution: provWeatherGov.periodResolution,
          capabilities: provWeatherGov.capabilities,
          dataCharacteristics: {
            temperaturesPerPeriod: 1
          }
        },
        location: {
          timezone: "MDT",  // Standard timezone code
          wxfURL: location.wxfURL
        },
        generated: {
          timestamp: new Date().toISOString(),
          validUntil: new Date(Date.now() + provWeatherGov.timeLimit).toISOString()
        }
      },
      periods
    };
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

    let geoLatLon = {}
    let geoGPS = ""
    const keepTrying = true
    const checkThrottled = true

    if (geoType == "loc-gps") {
      //split into lat and long
      const geoSplit = geoData.toLowerCase().split(",")
      geoLatLon.latt = geoSplit[0]
      geoLatLon.longt = geoSplit[1]
    } else if (geoType == "loc-city") {
      debugLog("https://geocode.xyz/" + geoData + "?region=us&json=1")

      geoLatLon = await axiosLoop("geoCode", "https://geocode.xyz/" + geoData + "?region=us&json=1", keepTrying, checkThrottled)
    } else if (geoType == "loc-zip") {
      debugLog("https://geocode.xyz/" + geoData + "?region=us&json=1")

      geoLatLon = await axiosLoop("geoCode", "https://geocode.xyz/" + geoData + "?region=us&json=1", keepTrying, checkThrottled)
    }

    if (!geoLatLon.isValid) {
      return {isValid: false, errMsg: geoLatLon.errMsg, newGeoID: undefined}
    }

    const wxaURL = "https://api.weather.gov/alerts?point=" + geoLatLon.jsonData.latt + "%2C" + geoLatLon.jsonData.longt + "&status=actual&message_type=alert"

    let gpsURL = "https://api.weather.gov/points/" + geoLatLon.jsonData.latt + "," + geoLatLon.jsonData.longt
    debugLog(gpsURL)

    geoGPS = await axiosLoop("weather.gov", gpsURL, keepTrying)

    if (!geoGPS.isValid) {
      return {isValid: false, errMsg: geoGPS.errMsg, newGeoID: undefined}
    }

    retGeoData = {
      geoID: locLabel,
      geoType: geoType,
      geoData: geoData,
      forecast: geoGPS.jsonData.properties.forecast,
      alert: wxaURL,
      polyMapURL: "",
    }

    return {isValid: true, newGeoID: retGeoData}
  },

  getWXF: async (wxfURL, forceRefresh = false, keepTrying = true) => {
    if (!wxfURL?.startsWith('https://api.weather.gov/')) {
      return {
        isValid: false, 
        errMsg: "Invalid weather.gov URL",
        wxfData: undefined
      };
    }
    
    let freshWeatherResults = undefined //used for wxfURL results pre parsing

    // Check cache first
    const nowDate = new Date()
    const nowMidnight = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime()
  
    if (!forceRefresh) {
      const cached = provWeatherGov.provCacheData.find(c => c.metadata.location.wxfURL === wxfURL);
      if ((cached && ((Date.now() - new Date(cached.metadata.generated.timestamp).getTime()) < provWeatherGov.timeLimit)) &&
      (Date.now() - nowMidnight > provWeatherGov.timeLimit))  // startdate driven logic...Force refresh if cache is prior to midnight
       {debugLog("using Cache for rate limiting")
        return { isValid: true, wxfData: cached };
      }
     }

    debugLog("Not using Cache, now going to reach out to Weather.gov...")
    //no cache or out of date, flush it before adding current get

    freshWeatherResults = await axiosLoop("weather.gov", wxfURL, keepTrying)

    if (!freshWeatherResults.isValid) {
      return {isValid: false, errMsg: freshWeatherResults.errMsg, wxfData: undefined}
    }
            /*debugLog(`
  
  
            =========== freshWeatherResults.data ==================
            ${JSON.stringify(freshWeatherResults, null, 3)}`);*/
            

    if ((freshWeatherResults.jsonData.properties.periods == undefined ? 0 : freshWeatherResults.jsonData.properties.periods.length) == 0)
      return {isValid: false, errMsg: "no periods returned from weather.gov", wxfData: undefined}

    let cacheTime = Date.now()

    const wxfProv = provWeatherGov.normalizeToWxfProv(freshWeatherResults.jsonData, wxfURL);

    provWeatherGov.provCacheData = provWeatherGov.provCacheData.filter(c => 
        c.metadata.location.wxfURL !== wxfURL );

    provWeatherGov.provCacheData.push(wxfProv);
  
    return { isValid: true, wxfData: wxfProv };       
        
  }, //end of function



  getWXA: async (PwxaURL, keepTrying = true) => {
    let wxfURL = ""
    if (!PwxaURL || typeof PwxaURL !== 'string' || !PwxaURL.startsWith('https://api.weather.gov/alerts?')) {
      return {isValid: false, errMsg: "Invalid or missing alerts URL. Must be a valid weather.gov API URL", wxfData: undefined}
    }
    else {
      wxfURL = PwxaURL
    }

    let freshWeatherResults = undefined //used for wxfURL results pre parsing

    let wxaFlat = []

    debugLog("Never hold Alert Cache, now going to reach out to Weather.gov for..." + wxfURL)
    //no cache or out of date, flush it before adding current get
    
    freshWeatherResults = await axiosLoop("weather.gov", wxfURL, keepTrying)

    if (!freshWeatherResults.isValid) {
      return {isValid: false, errMsg: freshWeatherResults.errMsg, wxaData: []}
    }


    if ((freshWeatherResults.jsonData.features == undefined ? 0 : freshWeatherResults.jsonData.features.length) == 0) {
      return {isValid: true, Msg: "no alerts returned from weather.gov", wxaData: []}
    }

    let cacheTime = Date.now()
    debugLog("cacheTime...." + cacheTime)
    let validWeather = []
    freshWeatherResults.jsonData.features.forEach(function (pedValue, pedKey) {
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


  getPolyMapURL: async (PwxfURL, keepTrying = true) => {
    debugLog("getPolyMapURL function called...")
    // get the polygon coordinates from the provGeoData
    let wxfURL = ""
    if (!PwxfURL || typeof PwxfURL !== 'string' || !PwxfURL.startsWith('https://api.weather.gov/')) {
      return {isValid: false, errMsg: "Invalid or missing forecast URL. Must be a valid weather.gov API URL", wxfData: undefined}
    }
    else {
      wxfURL = PwxfURL
    }

    let freshWeatherResults = undefined //used for wxfURL results pre parsing

    freshWeatherResults = await axiosLoop("weather.gov", wxfURL, keepTrying)

    if (!freshWeatherResults.isValid) {
      return {isValid: false, errMsg: freshWeatherResults.errMsg, wxfData: undefined}
    }

    if ((freshWeatherResults.jsonData.geometry == undefined ? 0 : freshWeatherResults.jsonData.geometry.coordinates.length) == 0)
      return {isValid: false, errMsg: "no coordinates returned from weather.gov", wxfData: undefined}

    let cacheTime = Date.now()
    let polyURL = "https://www.keene.edu/campus/maps/tool/?coordinates="

    // Check if geometry and coordinates exist
    if (freshWeatherResults.jsonData.geometry && freshWeatherResults.jsonData.geometry.coordinates) {
      // Loop through each polygon (usually just one)
      freshWeatherResults.jsonData.geometry.coordinates.forEach((polygon, polyIndex) => {
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
        if (polyIndex < freshWeatherResults.jsonData.geometry.coordinates.length - 1) {
          polyURL += "%0A"
        }
      })
    } else {
      return {isValid: false, errMsg: "No geometry coordinates found", wxfData: undefined}
    }

    return {isValid: true, polyURL: polyURL}
  }, // end of function


};

module.exports = { provWeatherGov };
