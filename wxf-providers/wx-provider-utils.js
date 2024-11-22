const axios = require("axios").default;
const cfg = require("../wx-bot-config");

const debugLog = (msg) => {
  if (cfg.appConfig.isDebug) {
    console.log(msg);
  }
};



// Provider data structure types
const WX_DATA_TYPES = {
    DAILY: 'DAILY',          // Base type - one forecast per day
    MULTI_PERIOD: 'MULTI_PERIOD'  // Multiple periods within a day (12hr or hourly)
  }
  
  // Period resolutions within a day
  const WX_PERIOD_RESOLUTION = {
    DAILY: 'DAILY',    // One period per day (like weatherbit.io)
    TWELVE_HOUR: 'TWELVE_HOUR',  // Day/night periods (like weather.gov)
    HOURLY: 'HOURLY'   // Hourly periods
  }
  
  // Provider capabilities flags
  const WX_CAPABILITIES = {
    ALERTS: 'ALERTS',
    POLYGONS: 'POLYGONS',
    HOURLY: 'HOURLY'
  }
  

const findMaxNumInStr = (str) => {
/**
 * Finds the maximum number in a string containing one or more numbers
 * @param {string} str - String containing numbers (e.g. "8 to 13 mph")
 * @returns {number} - Maximum number found in string, or 0 if no numbers found
 */
    if (!str) return 0;
  const numbers = str.match(/\d+/g);
  return numbers ? Math.max(...numbers.map(Number)) : 0;
};

const sleep = async (manySecs) => {
    return new Promise((resolve) => {
      setTimeout(resolve, manySecs * 1000)
    })
};

    /*
    * This function is used to get the latitude and longitude from a location string
    * which can then be used in other weather provider API
    * it has unique handling for throttling issues of it's API
    */
const axiosLoop_geoCode = async (infoText = "", thisURL, keepTrying, checkThrottled) => {
    debugLog("axiosLoop_geoCode function called...")
    debugLog("trying URL: " + thisURL)
    let retVal = ""
    let response = ""
    let gotResponse = false
    let ErrorMsg = infoText + " API error, please try again"

    for (var i = 0; i < 10; i++) {
      try {
        response = await axios.get(thisURL, {
          responseType: "json",
          transformResponse: [(v) => v],
        })

        if (response.status >= 500 && response.status < 600) {
            gotResponse = false
          } else {
            let isThrottled = JSON.parse(response.data)
            if (checkThrottled && /(throttled)/.test(isThrottled.latt.toLowerCase())) {
              debugLog("isThrottled geoCode issue...." + JSON.stringify(isThrottled, null, 3))
              throw "axios geoCode throttle issue happened"
            } // generates an exception
            else {
              gotResponse = true}  //no throttle issue and we have a response
          }
      } catch (err) {
        debugLog("in axiosLoop_geoCode catch..." + i)
        if (err.response !== undefined) {
          debugLog(err.response.data.error)
        } else {
          debugLog("in axiosLoop_geoCode catch err..." + err)
        }
      }

      if (gotResponse || !keepTrying) break

      if (i == 9) {
        ErrorMsg = "Failed after maximum retries"
      }
      
      await sleep(keepTrying ? (i < 5 ? 1.1 : 5) : 0)   //progressively longer sleep times to help with throttling timers
    }

    if (!gotResponse) {
        return {isValid: false, errMsg: ErrorMsg, jsonData: undefined}
      }
  
  
      try {
        retVal = JSON.parse(response.data)
      } catch (err) {
      console.log("Error parsing "+infoText+" json response: " + err)
        return {isValid: false, errMsg: "Error parsing "+infoText+" response", jsonData: undefined}
      }
  
      return {isValid: true, jsonData: retVal}
  }


const axiosLoop = async (infoText = "", thisURL, keepTrying) => {
    let retVal = ""
    let response = ""
    let gotResponse = false
    let ErrorMsg = infoText + " API error, please try again"


    for (var i = 0; i < 10; i++) {
      try {
        response = await axios.get(thisURL, {
          responseType: "json",
          transformResponse: [(v) => v],
        })

        if (response.status >= 500 && response.status < 600) {
          gotResponse = false
        } else {
          gotResponse = true
        }
      } catch (err) {
        debugLog(err)
        gotResponse = false
      }
      if (gotResponse || !keepTrying) {
        break
      }
      debugLog("Trying "+infoText+" again loop..." + i)
      if (i == 9) {
        ErrorMsg = "final "+infoText+" fail...looping out of max retries"
      }
      await sleep(keepTrying ? (i < 5 ? 1.1 : 5) : 0)   //progressively longer sleep times to help with throttling timers

    } //end loop
    if (!gotResponse) {
      return {isValid: false, errMsg: ErrorMsg, jsonData: undefined}
    }


    try {
      retVal = JSON.parse(response.data)
    } catch (err) {
    console.log("Error parsing "+infoText+" json response: " + err)
      return {isValid: false, errMsg: "Error parsing "+infoText+" response", jsonData: undefined}
    }

    return {isValid: true, jsonData: retVal}
}

module.exports = {
  WX_DATA_TYPES,
  WX_PERIOD_RESOLUTION,
  WX_CAPABILITIES,
  findMaxNumInStr,
  axiosLoop_geoCode,
  axiosLoop
};
