/* PROVIDER: weatherbit.io
   API: Weatherbit.io API
   URL: https://api.weatherbit.io/v2.0/forecast/daily?
   DOCUMENTATION: https://www.weatherbit.io/api
   OPEN SOURCE CODE: n/a
   
   WEATHER DATA:
   SAMPLE RAW DATA: https://api.weatherbit.io/v2.0/forecast/daily?city=Raleigh,NC&key=API_KEY
   
   REQUIREMENTS:
   1. BUILD THE WEATHERBIT API URL FROM THE CITY/STATE, or ZIP CODE, or LAT/LON
   2. CONVERT THE RAW WEATHER DATA TO THE STANDARD WEATHER SOURCE FORMAT FOR THE BOT FRAMEWORK
*/


const cfg = require("../wx-bot-config");
const { WX_DATA_TYPES, WX_CAPABILITIES, WX_PERIOD_RESOLUTION, findMaxNumInStr, axiosLoop } = require('./wx-provider-utils');

// Debug logging helper
const debugLog = (msg) => {
  if (cfg.appConfig.isDebug) {
    console.log(msg);
  }
};

// Bad weather codes for this provider
const WB_BAD_WEATHER_CODES = [
  200, 201, 202, 230, 231, 232,  // thunderstorm
  233,                           // hail
  511,                           // freezing rain
  600, 601, 602, 621, 622, 623, // snow
  610,                           // mixed precip
  611, 612,                      // sleet
  711, 731, 751                  // dangerous conditions
];

const provWeatherBit = {
  providerName: "weatherbit.io",
  providerType: WX_DATA_TYPES.DAILY,
  periodResolution: WX_PERIOD_RESOLUTION.DAILY,
  capabilities: {
    hasAlerts: true,
    hasPolygons: false,
    hasPrecipAmount: true,
    hasHourlyData: false,
    useEnhancedDescription: true,
    hasCodesForBadFlag: true,
    badWeatherCodes: WB_BAD_WEATHER_CODES || [-1]
  },

  timeLimit: 3600000 * 1, // 1 hour cache
  provCacheData: [],
  provGeoData: [],

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
      if (dayData.precip < 0.25) rainIntensity = "drizzle"
      else if (dayData.precip <= 0.5) rainIntensity = "light"
      else if (dayData.precip < 0.99) rainIntensity = "good"
      else if (dayData.precip <= 1.5) rainIntensity = "moderate"
      else rainIntensity = "heavy"

      let rainLikelihood = ""
      if (dayData.pop >= 80) rainLikelihood = dayData.pop + "% chance, expect"
      else if (dayData.pop >= 60) rainLikelihood = dayData.pop + "% chance, likely to see"
      else if (dayData.pop >= 40) rainLikelihood = dayData.pop + "% chance of"
      else rainLikelihood = dayData.pop + "% slight chance of"

      if (dayData.precip >= 0.1) {
        let rainPhrase = `${rainLikelihood} ${rainIntensity} rain`
        if (dayData.precip > 1) {
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
    /* using sunset/sunrise times requires more thought and testing of timezone implications 
          from provider, 
          timezone setting where weatherBot is running when calling API,
          and that the Simplex client timezone is not available to weatherBot 
          NOTE: developers can use the commented code below to add at their discretion and testing.
    
    const sunrise = new Date(dayData.sunrise_ts * 1000)
    const sunset = new Date(dayData.sunset_ts * 1000)
    
    // Get the local time zone offset in minutes
    const timezoneOffset = 0 //new Date().getTimezoneOffset() * 60000; // Convert to milliseconds

    // Adjust for UTC offset
    const localSunrise = new Date(sunrise.getTime() - timezoneOffset);
    const localSunset = new Date(sunset.getTime() - timezoneOffset);

    // Format times
    const sunriseTime = localSunrise.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const sunsetTime = localSunset.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    
    // Add sunrise and sunset
    description.push(`Sunrise ${sunriseTime}, sunset ${sunsetTime} (EDT)`)
    */

    // Add moon phase only at significant points
    const moonPhase = dayData.moon_phase_lunation
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

  // Convert raw weatherbit data to wxfProv format
  normalizeToWxfProv: (rawData, wxfURL) => {
    //console.log("rawData:", rawData);
    
    const periods = rawData.map(dayData => {
      const date = new Date(dayData.valid_date);
      //const isBadWeather = WB_BAD_WEATHER_CODES.includes(Number(dayData.weather.code));
      console.log("dayData valid_date:", dayData.valid_date);
      console.log("dayData datetime:", dayData.datetime);
      console.log("dayData ts:", new Date(dayData.ts * 1000).toISOString());

      return {
        date: dayData.valid_date,
        isDaytime: true,
        startTime: new Date(new Date(date).setHours(0, 0, 0, 0)).toISOString(),
        endTime: new Date(new Date(date).setHours(23, 59, 59, 999)).toISOString(),
        temperature: {
          value: dayData.high_temp,
          low: dayData.low_temp,
          feelsLike: dayData.app_max_temp
        },
        conditions: {
          description: dayData.weather.description,
          enhancedDescription: provWeatherBit.createEnhancedDescription(dayData),
          precipitation: {
            probability: dayData.pop || 0,
            amount: dayData.precip || 0,
            type: "rain"
          },
          wind: {
            speed: dayData.wind_spd ? dayData.wind_spd : undefined,  //normalizer will extract from description if not incl from provider
            gust: dayData.wind_gust_spd ? dayData.wind_gust_spd : undefined,  //normalizer will extract from description if not incl from provider
            direction: dayData.wind_cdir_full || ""
          },
          atmospheric: {
            visibility: dayData.vis || 0,
            humidity: dayData.rh || 0,
            pressure: dayData.pres || 0,
            dewpoint: dayData.dewpt || 0,
            uvIndex: dayData.uv || 0
          },
          codes: {
            description: dayData.weather.description,
            code: dayData.weather.code,
            //isBadCodesFlag: isBadWeather
          }
        },
        astronomy: {
          sunrise: dayData.sunrise_ts ? new Date(dayData.sunrise_ts * 1000).toISOString() : undefined,
          sunset: dayData.sunset_ts ? new Date(dayData.sunset_ts * 1000).toISOString() : undefined,
          moonPhase: dayData.moon_phase_lunation
        },
        flags: {
          //isBadWeather: isBadWeather
        }
      };
    });

    return {
      metadata: {
        provider: {
          name: provWeatherBit.providerName,
          type: provWeatherBit.providerType,
          periodResolution: provWeatherBit.periodResolution,
          capabilities: provWeatherBit.capabilities,
          dataCharacteristics: {
            temperaturesPerPeriod: 2
          }
        },
        location: {
          timezone: "not set",
          wxfURL: wxfURL
        },
        generated: {
          timestamp: new Date().toISOString(),
          validUntil: new Date(Date.now() + provWeatherBit.timeLimit).toISOString()
        }
      },
      periods
    };
  },

  sleep: async (manySecs) => {
    return new Promise((resolve) => {
      setTimeout(resolve, manySecs * 1000)
    })
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
      locationParam = locationParam.replace(/\s+/g, '+')  // replace spaces with "+" per the api docs
      locationParam = `city=${encodeURIComponent(geoData)}`
    } else if (geoType === "loc-zip") {
      locationParam = `postal_code=${geoData}&country=US`  // add country=US per the api docs
    }

    // Add units=I to get Imperial units (Fahrenheit, mph, inches)
    retGeoData.forecast = `https://api.weatherbit.io/v2.0/forecast/daily?${locationParam}&units=I&key=${apiKey}`
    retGeoData.alert = `https://api.weatherbit.io/v2.0/alerts?${locationParam}&key=${apiKey}`

    return {isValid: true, newGeoID: retGeoData}
  },



  // Main interface methods
  getWXF: async (wxfURL, forceRefresh = false, keepTrying = false) => {
    if (!wxfURL?.startsWith('https://api.weatherbit.io/')) {
      return {
        isValid: false, 
        errMsg: "Invalid weatherbit.io URL",
        wxfData: undefined
      };
    }


    // Check cache first
    const nowDate = new Date()
    const nowMidnight = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime()

    if (!forceRefresh) {
      const cached = provWeatherBit.provCacheData.find(c => c.metadata.location.wxfURL === wxfURL);
      if ((cached && ((Date.now() - new Date(cached.metadata.generated.timestamp).getTime()) < provWeatherBit.timeLimit)) &&
      (Date.now() - nowMidnight > provWeatherBit.timeLimit))  // startdate driven logic...Force refresh if cache is prior to midnight
       {debugLog("using Cache for rate limiting")
        return { isValid: true, wxfData: cached };
      }
     }

    debugLog("Not using Cache, now going to reach out to Weatherbit.io...")
    const todaytest = new Date();
    //debugLog("what is new Date() returning:", todaytest);
    // Fetch fresh data
    try {
        const freshWeatherResults = await axiosLoop("weatherbit.io", wxfURL, keepTrying)

        if (!freshWeatherResults.isValid) {
          return {isValid: false, errMsg: freshWeatherResults.errMsg, wxfData: undefined}
        }
        /*debugLog(`


            =========== freshWeatherResults.data ==================
            ${JSON.stringify(freshWeatherResults, null, 3)}`);*/
            if ((freshWeatherResults.jsonData.data == undefined ? 0 : freshWeatherResults.jsonData.data.length) == 0)
              return {isValid: false, errMsg: "no periods returned from weatherbit.io", wxfData: undefined}
    
        //console.log("freshWeatherResults.data:", freshWeatherResults.data);
        
        const wxfProv = provWeatherBit.normalizeToWxfProv(freshWeatherResults.jsonData.data, wxfURL);



      provWeatherBit.provCacheData = provWeatherBit.provCacheData.filter(c => 
        c.metadata.location.wxfURL !== wxfURL
      );
      
      /*debugLog(`


        =========== new wxfProv ==================
        ${JSON.stringify(wxfProv, null, 3)}`);*/

      provWeatherBit.provCacheData.push(wxfProv);

      return { isValid: true, wxfData: wxfProv };
      } catch (err) {
      debugLog("Error fetching weather data: " + err)
      return {
        isValid: false,
        errMsg: "Failed to fetch weather data",
        wxfData: undefined
       };
      }
  },  //end of getWXF
  
  getWXA: async (PwxaURL, PkeepTrying) => {
    let wxfURL = ""
    if (!PwxaURL || typeof PwxaURL !== 'string' || !PwxaURL.startsWith('https://api.weatherbit.io/v2.0/alerts')) {
      return {isValid: false, errMsg: "Invalid or missing alerts URL. Must be a valid weatherbit.io API URL", wxaData: []}
    }
    else {
      wxfURL = PwxaURL
    }

    let keepTrying = PkeepTrying || false

    const alertResults = await axiosLoop("weatherbit.io", wxfURL, keepTrying)

    if (!alertResults.isValid) {
      return {isValid: false, errMsg: alertResults.errMsg, wxaData: []}
    }




    const validAlerts = alertResults.jsonData.alerts.map((alert, index) => ({
      wxfPeriod: index,
      wxfDayName: alert.expires_local,
      wxfDescr: alert.description,
      refDayName: `expires: ${alert.expires_local}`,
      doReport: true,
      formatted: `expires: ${provWeatherBit.formatAlertTime(alert.expires_local)} - ${alert.title}\n${alert.description}`
    }))

    return {isValid: true, wxaData: validAlerts}
   },  //end of getWXA

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
  },  //end of formatAlertTime

  // Weatherbit.io doesn't provide polygon data for mapping
  getPolyMapURL: async () => {
    return {isValid: false, errMsg: "Polygon mapping not supported by weatherbit.io", polyURL: undefined}
  },  //end of getPolyMapURL




}; //end of provWeatherBit

module.exports = { provWeatherBit }; 