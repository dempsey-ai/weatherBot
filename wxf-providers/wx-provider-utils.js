/*
weatherBot chat client - version 1.0 - Uses SimpleX Chat frameworkto provide weather forecast reports to user messages
    Copyright (C) 2024  Scott Dempsey

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
*/
/* PURPOSE:
   This file contains 
      1. Provider type metadata that drives code logic
      2. Utility functions used by the weather providers to reduce code duplication
   Summary of utility functions: 
        function to find the maximum number in a string, 
        a sleep function, 
        and an axiosLoop function which is used to contact external API providers
             and handle special throttling issues
             as well as provide a limited retry loop to deal with occasional denial of service issues
*/

const axios = require("axios").default;
const cfg = require("../wx-bot-config");

const debugLog = async (msg) => {
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
    /**
    * @param {string} infoText - Description of the API call for logging
    * @param {string} thisURL - The URL to call
    * @param {boolean} [keepTrying=false] - Whether to retry on failure
    * @param {boolean} [checkThrottled=false] - Whether to check for geoCode API specific throttling errors in response
    *   - Note: this is formatted for geoCode API calls which is used to return lat/lon from a location string to build other strings
    */
    const axiosLoop = async (infoText = "", thisURL, keepTrying = false, checkThrottled = false) => {
    debugLog("axiosLoop function called..."+infoText)
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
        await debugLog("axiosLoop response status: " + response.status)
        
        if (response.status >= 500 && response.status < 600) {
          gotResponse = false
          continue
        }

        // Then check for throttling if needed
        if (checkThrottled) {
          let responseData = JSON.parse(response.data)
          if (/(throttled)/i.test(responseData.latt)) {
            await debugLog("isThrottled geoCode issue...." + JSON.stringify(responseData, null, 3))
            gotResponse = false
            continue
          }
        }

        // If we get here, we have a good response
        gotResponse = true
        retVal = response.data
        break

      } catch (err) {
        await debugLog("in axiosLoop catch..." + i)
        if (err.response !== undefined) {
          await debugLog(err.response.data.error)
        } else {
          await debugLog("in axiosLoop catch err..." + err)
        }
        gotResponse = false
      }

      // Only continue if we want to keep trying and haven't got a response
      if (!keepTrying || gotResponse) {
        break
      }

      if (i == 9) {
        ErrorMsg = "Failed after maximum axios loop retries"
      }
      
      await sleep(keepTrying ? (i < 5 ? 1.1 : 5) : 0)
    }

    if (!gotResponse) {
      return {isValid: false, errMsg: ErrorMsg, jsonData: undefined}
    }

    try {
      retVal = typeof retVal === 'string' ? JSON.parse(retVal) : retVal
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
  axiosLoop
};
