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

const fs = require("fs").promises
const path = require("path")
const natural = require("natural")

const userManagement = require("./wx-bot-usermgmt")
const wxBotProviderMap = require("./wxf-providers/wx-bot-provider-map")
const cfg = require("./wx-bot-config")
const { WX_DATA_TYPES, WX_PERIOD_RESOLUTION } = require('./wxf-providers/wx-provider-types')

const activeProviderName = wxBotProviderMap.activeProvider.providerName

const chatTeal = (someString) => {
  return (someString = " !5 " + someString + "! ")
}

const chatBlue = (someString) => {
  return (someString = " !3 " + someString + "! ")
}
const chatYellow = (someString) => {
  return (someString = " !4 " + someString + "! ")
}

const WELCOME_MSG =
  "Welcome to the weather bot! Before I can provide weather information, I need to know your" +
  chatYellow("location") +
  ". \n\nYou can easily set your location by sending me a message like," +
  chatYellow("my location is 80809") +
  " or," +
  chatYellow("my location is pikes peak,co") +
  " or" +
  chatYellow("location 38.8408655,-105.0441532") +
  " etc.  \n\nFor GPS coordinates, you also can assign a label to the location with an additional message like" +
  chatYellow('location label "pikes peak"') +
  "\nTo get help later on location setup, send a message with" +
  chatTeal("help location") +
  "\n\nAfter setting your location start with a simple message like" +
  chatTeal("temps") +
  " or " +
  chatTeal("any rain this week") +
  "\n\nFor a good list of examples, send a message with" +
  chatTeal("help examples")
const HELP_LOCATION_MSG =
  "\nHere are some examples of messages you can send to set your location:\n\n" +
  chatYellow("my location is 80809") +
  "\n" +
  chatYellow("my location is pikes peak,co") +
  "\n" +
  chatYellow("location 38.8408655,-105.0441532") +
  "\n" +
  chatYellow("location label pikes peak") +
  "\n" +
  chatYellow("location map") +
  " (URL link to your precise GPS shape used for weather alerts and forecasts)\n" 
const HELP_EXAMPLES_MSG =
  "\nHere are some examples of messages you can send to get weather information for your current location:\n\n" +
  chatYellow("temps") +
  "\n" +
  chatTeal("any") +
  chatYellow("rain") +
  chatTeal("this week") +
  "\n" +
  chatTeal("any") +
  chatYellow("windy") +
  chatTeal("days") +
  "\n" +
  chatTeal("any") +
  chatYellow("bad weather") +
  chatTeal("this week") +
  "\n" +
  chatTeal("rain over 50%") +
  "\n" +
  chatTeal("no rain") +
  "\n" +
  chatTeal("no wind") +
  "\n" +
  chatTeal("wind over 10 mph") +
  "\n" +
  chatTeal("weather next 2 days") +
  "\n" +
  chatTeal("weather this") +
  chatYellow("weekend") +
  "\n" +
  chatYellow("find cloudy") +
  chatTeal("days") +
  "\n" +
  chatYellow("find sunny") +
  chatTeal("days") +
  "\n" +
  chatTeal("weather on wed") +
  "\n" +
  chatTeal("tomorrow") +
  "\n" +
  chatTeal("today") +
  "\n" +
  chatTeal("tonight") +
  "\n\nFor a good list of SHORTCUT examples, send a message with" +
  chatYellow("help shortcuts")
const HELP_SHORTCUTS_MSG =
  "\nHere are some good SHORTCUT examples of messages you can send to get weather information for your current location:\n\n" +
  chatYellow("?") +
  " (weekly summary of daily temps)\n" +
  chatYellow("?>90") +
  " (find days hotter than 90, use your own number)\n" +
  chatYellow("?<35") +
  " (find days colder than 35, use your own number)\n" +
  chatYellow("freeze") +
  " (find days or nights colder than 32)\n" +
  chatYellow("cool") +
  " or" +
  chatYellow("chilly") +
  " (find daytime temps cooler than 60)\n" +
  chatYellow("bad weather") +
  " (searches forecast for bad weather related keywords)\n" +
  chatYellow("hot") +
  " (find daytime temps hotter than 85)\n"

const HELP_ADMINHOST_MSG =
  "\nHere are some Admin/Host examples of messages you can send to manage the bot:\n\n" +
  chatYellow("show users") +
  " (lists all users)\n" +
  chatYellow("disable user [ID] for [reason]") +
  " (disables a user)\n" +
  chatYellow("enable user [ID]") +
  " (enables a user)\n" +
  chatYellow("add admin to [ID]") +
  " (adds user to admin group)\n" +
  chatYellow("remove admin from [ID]") +
  " (removes user from admin group)\n"

const debugLog = (msg) => {
  if (cfg.appConfig.isDebug) {
    console.log(msg)
  }
  return
}

const cleanupString = (str) => {
  // First, replace two or more spaces with a single space
  let cleanStr = str.replace(/\s{2,}/g, " ")

  // Then, remove leading spaces
  cleanStr = cleanStr.replace(/^\s+/, "")

  return cleanStr
}

const logFunctionName = () => {
  const stack = new Error().stack
  const callerName = stack.split("\n")[2].trim().split(" ")[1]
  debugLog(`Currently inside function: ${callerName}`)
}

// Load word lists
async function loadTopics() {
  try {
    const topics = {
      topic_badWeather: JSON.parse(
        await fs.readFile(path.join(cfg.appConfig.paths.appHome, "wx-bot-wordlists", "bad_weather.json"), "utf8")
      ),
      topic_wxAlerts: JSON.parse(
        await fs.readFile(path.join(cfg.appConfig.paths.appHome, "wx-bot-wordlists", "weather_alerts.json"), "utf8")
      ),
      topic_temps: JSON.parse(await fs.readFile(path.join(cfg.appConfig.paths.appHome, "wx-bot-wordlists", "temperature.json"), "utf8")),
      topic_rain: JSON.parse(await fs.readFile(path.join(cfg.appConfig.paths.appHome, "wx-bot-wordlists", "rain.json"), "utf8")),
      topic_wind: JSON.parse(await fs.readFile(path.join(cfg.appConfig.paths.appHome, "wx-bot-wordlists", "wind.json"), "utf8")),
      topic_wxForecasts: JSON.parse(
        await fs.readFile(path.join(cfg.appConfig.paths.appHome, "wx-bot-wordlists", "forecasts.json"), "utf8")
      ),
      topic_location: JSON.parse(await fs.readFile(path.join(cfg.appConfig.paths.appHome, "wx-bot-wordlists", "location.json"), "utf8")),
      topic_hostFunctions: JSON.parse(
        await fs.readFile(path.join(cfg.appConfig.paths.appHome, "wx-bot-wordlists", "host_functions.json"), "utf8")
      ),
    }
    return topics
  } catch (error) {
    console.error("Error loading topic files:", error)
    throw error
  }
}

// Use with initialization
let weatherTopics
;(async () => {
  weatherTopics = await loadTopics()
})()

// Function to find the best matching topic
const findBestMatchingTopic = async (input, topics) => {
  const tokenizer = new natural.WordTokenizer()
  const inputWords = tokenizer.tokenize(input)
  let bestMatch = {topic: null, score: 0}

  inputWords.forEach((inputWord) => {
    for (const [topic, wordsObj] of Object.entries(topics)) {
      wordsObj.generalWords.forEach((word) => {
        const score = natural.JaroWinklerDistance(inputWord, word.toLowerCase()) // Convert word to lowercase
        if (score > bestMatch.score) {
          bestMatch = {topic, score}
        }
      })
    }
  })

  return bestMatch.topic
}

// Function to evaluate the message
const evaluateMessage = async (wxChatUser, msg) => {
  const lowercaseMsg = msg.toLowerCase()

  // First thing to check is if the user is asking for help
  if (lowercaseMsg.includes("help")) {
    let helpType = "general"

    if (lowercaseMsg.includes("example") || lowercaseMsg.includes("examples")) {
      helpType = "examples"
    } else if (lowercaseMsg.includes("location")) {
      helpType = "location"
    } else if (lowercaseMsg.includes("shortcuts")) {
      helpType = "shortcuts"
    } else if (
      lowercaseMsg.includes("admin") ||
      lowercaseMsg.includes("host") ||
      lowercaseMsg.includes("user") ||
      lowercaseMsg.includes("system") ||
      lowercaseMsg.includes("functions") ||
      lowercaseMsg.includes("commands")
    ) {
      helpType = "adminhost"
    }

    return {
      isValid: true,
      msg_subject: "help",
      msg_criteria: helpType,
    }
  }

  let bestMatchingTopic = await findBestMatchingTopic(lowercaseMsg, weatherTopics)
  debugLog(`Best matching topic: ${bestMatchingTopic}`)

  if (bestMatchingTopic == undefined || bestMatchingTopic == null) {
    // double check for special temp short hand that word compare won't catch
    let special_match =
      lowercaseMsg === "?" ||
      lowercaseMsg.match("\\?\\<\\s*(\\\d+)") ||
      lowercaseMsg.match("^\\<\\s*(\\\d+)") ||
      lowercaseMsg.match("^\\>\\s*(\\\d+)") ||
      lowercaseMsg.match("\\?\\>\\s*(\\\d+)")

    debugLog("regex <35..." + lowercaseMsg.match("^\\<\\s*(\\\d+)"))

    if (special_match) {
      debugLog("found special_match, setting topic")
      bestMatchingTopic = "topic_temps"
    }
  }

  let msg_subject = "unknown"
  let msg_criteria = msg_subject
  let ret_isValid = false
  let ret_qualifiedParameter = undefined
  let ret_inValidReason =
    "Couldn't determine weather subject. Please try rephrasing your request, using different key words.  ex. 'rain?' or 'weather saturday?' or 'cool temps?'"

  let eval_result = {
    isValid: ret_isValid,
    msg_subject: "unknown",
    msg_criteria: msg_subject,
    qualifiedParameter: undefined,
    inValidReason: ret_inValidReason,
  }

  // Evaluate the result with a switch statement
  switch (bestMatchingTopic) {
    case "topic_hostFunctions":
      console.log("The topic is related to hostFunctions.")
      if (wxChatUser.chattyType === "host" || wxChatUser.chattyType === "admin") {
        console.log(`User is a ${wxChatUser.chattyType}, processing host/admin functions`)
        // Process host-specific commands
        for (const criteria of weatherTopics.topic_hostFunctions.specificCriteria) {
          const regex = new RegExp(criteria.regex, "i")
          const match = lowercaseMsg.match(regex)
          debugLog("match=" + JSON.stringify(match))
          if (match) {
            ret_isValid = true
            msg_subject = "hostfunction"
            msg_criteria = criteria.label
            ret_qualifiedParameter = criteria.parameter

            // If there's a captured group, add it to the parameter
            if (criteria.parameter.action === "userStatus") {
              if (match[1]) {
                ret_qualifiedParameter.userID = parseFloat(match[1])
              }
              if (match[2]) {
                ret_qualifiedParameter.reason = match[2]
              } else {
                ret_qualifiedParameter.reason = "No reason provided"
              }
            } else if (criteria.parameter.action === "changeGroup") {
              if (match[1]) {
                ret_qualifiedParameter.userID = parseFloat(match[1])
              }
            }

            break
          }
        }
      } else {
        console.log("user is not a host, setting ret_isValid to false")
        ret_isValid = false
        ret_inValidReason = "You don't have permission to perform this action."
      }
      eval_result = {
        isValid: ret_isValid,
        msg_subject,
        msg_criteria: msg_criteria,
        qualifiedParameter: ret_qualifiedParameter,
        inValidReason: ret_isValid ? "" : ret_inValidReason,
      }
      break

    case "topic_location":
      debugLog("The topic is related to location.")
      // Add your logic for location here
      ret_isValid = false
      ret_qualifiedParameter = undefined
      ret_inValidReason = ""
      msg_subject = "location"

      // Check for specific location criteria
      for (const criteria of weatherTopics.topic_location.specificCriteria) {
        const regex = new RegExp(criteria.regex, "i")
        const match = lowercaseMsg.match(regex)
        if (match) {
          debugLog("in forloop...match=" + match[1])
        }

        if (match) {
          ret_isValid = true
          debugLog("in forloop...ret_isValid=" + ret_isValid)
          ret_qualifiedParameter = criteria.parameter
          msg_criteria = criteria.label

          // If there's a captured group, process it
          if (match[1]) {
            // Check if it's a GPS coordinate
            if (ret_qualifiedParameter.startsWith("loc-gps:")) {
              // For GPS, we need to capture both coordinates
              if (match[2]) {
                ret_qualifiedParameter += match[1] + "," + match[2]
              } else {
                console.warn("GPS coordinate is incomplete. Missing longitude.")
                ret_qualifiedParameter += match[1]
              }
            } else {
              // For non-GPS parameters, just add the first captured group
              ret_qualifiedParameter += match[1]
            }
          }
          break
        }
      }

      ret_isValid = true
      eval_result = {
        isValid: ret_isValid,
        msg_subject,
        msg_criteria: msg_criteria,
        qualifiedParameter: ret_qualifiedParameter,
        inValidReason: ret_isValid ? "" : ret_inValidReason,
      }

      break

    case "topic_badWeather":
      debugLog("The topic is related to badWeather.")
      // Add your logic for badWeather here
      ret_isValid = false
      ret_qualifiedParameter = undefined
      ret_inValidReason = ""
      msg_subject = "badWeather"

      // pass the list of bad weather words to search for in wxfData forecasts
      ret_isValid = true
      ret_qualifiedParameter = weatherTopics.topic_badWeather.specificCriteria[0].parameter
      debugLog("bad words list: " + ret_qualifiedParameter)

      eval_result = {
        isValid: ret_isValid,
        msg_subject,
        msg_criteria: "bad weather",
        qualifiedParameter: ret_qualifiedParameter,
        inValidReason: ret_isValid ? "" : ret_inValidReason,
      }

      break

    case "topic_wxAlerts":
      debugLog("The topic is related to wxAlerts.")
      // Add your logic for wxAlerts here
      ret_isValid = false
      ret_qualifiedParameter = undefined
      ret_inValidReason = ""
      msg_subject = "wxAlerts"

      // Check for any active weather advisories
      ret_isValid = true
      ret_qualifiedParameter = ""

      eval_result = {
        isValid: ret_isValid,
        msg_subject,
        msg_criteria: "active Alerts",
        qualifiedParameter: ret_qualifiedParameter,
        inValidReason: ret_isValid ? "" : ret_inValidReason,
      }

      break

    case "topic_temps":
      debugLog("The topic is related to temp.")
      // Add your logic for temp here
      ret_isValid = false
      ret_qualifiedParameter = undefined
      ret_inValidReason = ""
      msg_subject = "temp"

      // Check for specific temp criteria
      for (const criteria of weatherTopics.topic_temps.specificCriteria) {
        const regex = new RegExp(criteria.regex, "i")
        const match = lowercaseMsg.match(regex)
        if (match) {
          debugLog("in forloop...match=" + match[1])
        }

        if (match) {
          ret_isValid = true
          debugLog("in forloop...ret_isValid=" + JSON.stringify(match))
          ret_qualifiedParameter = criteria.parameter
          msg_criteria = criteria.label

          // If there's a captured group (temp), add it to the parameter
          if (match[1]) {
            ret_qualifiedParameter += match[1]
          }

          break
        }
      }

      ret_isValid = true
      eval_result = {
        isValid: ret_isValid,
        msg_subject,
        msg_criteria: msg_criteria,
        qualifiedParameter: ret_qualifiedParameter,
        inValidReason: ret_isValid ? "" : ret_inValidReason,
      }

      break

    case "topic_rain":
      debugLog("The topic is related to rain.")
      // Add your logic for rain here
      ret_isValid = false
      ret_qualifiedParameter = undefined
      ret_inValidReason = ""
      msg_subject = "rain"

      // Check for specific rain criteria
      for (const criteria of weatherTopics.topic_rain.specificCriteria) {
        const regex = new RegExp(criteria.regex, "i")
        const match = lowercaseMsg.match(regex)

        if (match) {
          ret_isValid = true
          ret_qualifiedParameter = criteria.parameter
          msg_criteria = criteria.label

          // If there's a captured group (percentage), add it to the parameter
          if (match[1]) {
            ret_qualifiedParameter += match[1]
          }

          break
        }
      }

      // If no specific criteria matched, check for general rain mention
      if (!ret_isValid && weatherTopics.topic_rain.generalWords.some((word) => lowercaseMsg.includes(word))) {
        ret_isValid = true
        ret_qualifiedParameter = "r>0" // Default to any chance of rain
      }

      eval_result = {
        isValid: ret_isValid,
        msg_subject,
        msg_criteria: msg_criteria,
        qualifiedParameter: ret_qualifiedParameter,
        inValidReason: ret_isValid ? "" : ret_inValidReason,
      }

      break
    case "topic_wind":
      debugLog("The topic is related to wind.")
      // Add your logic for wind here
      ret_isValid = false
      ret_qualifiedParameter = undefined
      ret_inValidReason = ""
      msg_subject = "wind"

      // Check for specific wind criteria
      for (const criteria of weatherTopics.topic_wind.specificCriteria) {
        const regex = new RegExp(criteria.regex, "i")
        const match = lowercaseMsg.match(regex)

        if (match) {
          ret_isValid = true
          ret_qualifiedParameter = criteria.parameter
          msg_criteria = criteria.label

          // If there's a captured group (wind speed), add it to the parameter
          if (match[1]) {
            ret_qualifiedParameter += match[1]
          }

          break
        }
      }

      // If no specific criteria matched, check for general wind mention
      if (!ret_isValid && weatherTopics.topic_wind.generalWords.some((word) => lowercaseMsg.includes(word))) {
        ret_isValid = true
        ret_qualifiedParameter = "wmin>5" // Default to any chance of wind
      }

      eval_result = {
        isValid: ret_isValid,
        msg_subject,
        msg_criteria: msg_criteria,
        qualifiedParameter: ret_qualifiedParameter,
        inValidReason: ret_isValid ? "" : ret_inValidReason,
      }

      break

    case "topic_wxForecasts":
      debugLog("The topic is related to wxForecasts.")
      // Add your logic for wxForecasts here
      ret_isValid = false
      ret_qualifiedParameter = undefined
      ret_inValidReason = ""
      msg_subject = "wxForecasts"

      // Check for specific wxForecasts criteria
      for (const criteria of weatherTopics.topic_wxForecasts.specificCriteria) {
        const regex = new RegExp(criteria.regex, "i")
        const match = lowercaseMsg.match(regex)

        if (match) {
          // This condition was missing
          ret_isValid = true
          ret_qualifiedParameter = criteria.parameter

          // If there's a captured group (search term), add it to the parameter
          if (match[1]) {
            if (ret_qualifiedParameter.action.toLowerCase() === "ndays") {
              debugLog("nDays match:", match)
              ret_qualifiedParameter.numOfDays = parseInt(match[1])
            } else if (ret_qualifiedParameter.action.toLowerCase() === "search") {
              debugLog("search match:", match)
              ret_qualifiedParameter.searchValue = match[1].trim()
            }
          }

          break // This break is now properly inside the if (match) block
        }
      }

      // If no specific criteria matched, check for general wxForecasts mention
      if (!ret_isValid && weatherTopics.topic_wxForecasts.generalWords.some((word) => lowercaseMsg.includes(word))) {
        ret_isValid = true
        ret_qualifiedParameter = "" //just return all forecasts
      }

      eval_result = {
        isValid: ret_isValid,
        msg_subject,
        msg_criteria: "Daily Forecasts",
        qualifiedParameter: ret_qualifiedParameter,
        inValidReason: ret_isValid ? "" : ret_inValidReason,
      }

      break

    default:
      debugLog("The topic is unknown, returned unknown subject message")
      // Add your logic for unknown topics here
      break
  } // end of switch statement

  return eval_result
}

const handleLocationUpdate = async (chat, wxUsers, wxUserId, wxChatUser, qualified_msg) => {
  logFunctionName()

  // Handle location updates 
  if (
    qualified_msg.msg_subject === "location" &&
    qualified_msg.isValid &&
    qualified_msg.msg_criteria !== "unknown" &&
    qualified_msg.qualifiedParameter
  ) {
    const [paramType, paramValue] = qualified_msg.qualifiedParameter.split(":")
    let [locationLabel, locationType, locationValue] = ["", "", ""]
    
    debugLog("paramType: " + paramType)
    if (paramType === "loc-map") {
      debugLog("Polygon map request...")
      
      const userLocation = wxChatUser.location
      if (!userLocation) {
        debugLog("No location found in provGeoData for map request")
        await sendMessage(chat, wxChatUser, "You have to set a location first before requesting a map of it. send 'help location' for more info.")
        return 
      }
  
      const {label, type, value} = userLocation
      const locLabel = label || `${type}:${value}` // Use label if available, otherwise construct it
      const locID = value // the label can be a user assigned description, but value is the actual location ID of the original location set by the user
      
      const existingLocation = wxBotProviderMap.activeProvider.provGeoData.find((loc) => loc.geoData === locID)
      if (existingLocation.polyMapURL !== undefined && existingLocation.polyMapURL.includes("https")) {
        debugLog("existing Location found: " + JSON.stringify(existingLocation.polyMapURL, null, 3))

        const currentLocationInfo = `Current Provider: ${activeProviderName}\nYour current location is set to: Label=${wxChatUser.location.label} (Location=${wxChatUser.location.value} \nPolygon Mapping Tool URL: ${existingLocation.polyMapURL})`
        await sendMessage(chat, wxChatUser, currentLocationInfo)
      }
      else {
        debugLog("No location found in provGeoData for map request")
        await sendMessage(chat, wxChatUser, "You have to set a location first before requesting a map of it. send 'help location' for more info.")
        return 
      }
  

      
      return
    }


    if (["loc-city", "loc-zip", "loc-gps", "loc-label"].includes(paramType)) {
      if (paramType === "loc-label") {
        // Convert label to Title Case, handling special characters
        locationLabel = paramValue.split(/[\s-]+/) // Split on spaces and hyphens
          .map((word) => {
          // Skip capitalizing certain words if they're not at the start
          const lowercaseWords = ['of', 'the', 'and', 'in', 'on', 'at'];
          if (lowercaseWords.includes(word) && locationLabel !== '') {
            return word.toLowerCase();
          }
          // Handle apostrophes by capitalizing after them
          return word.replace(/['\s-]/g, (match) => match)  // Preserve special characters
            .replace(/\w\S*/g, (txt) => {
              // Capitalize first letter of each word part
              return txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase();
            });
        })
        .join(' ') // Rejoin with spaces
          .replace(/\s+/g, ' ') // Remove extra spaces
          .trim()

        // Use the current location type and value
        //wedebug- wxChatUser = wxUsers[wxUserId];
        locationType = wxChatUser.location.type
        locationValue = wxChatUser.location.value

        // Update user's location information
        //wxUsers = await userManagement.updateUserLocation(wxUsers, wxUserId, locationLabel, locationType, locationValue);
        //wedebug- wxChatUser = wxUsers[wxUserId];
        await userManagement.updateUserLocation(wxUsers, wxUserId, wxChatUser, locationLabel, locationType, locationValue)
        const currentLocationInfo = `Current Provider: ${activeProviderName}\nYour current location is set to: Label=${wxChatUser.location.label} (Location=${wxChatUser.location.value})`
        await sendMessage(chat, wxChatUser, currentLocationInfo)
      } //end of if paramType is loc-label
      else {
        // For other location types, use the location value as the label
        if (paramType === "loc-city") {
          // Handle city,state format
          const [city, state] = paramValue.split(",").map(part => part.trim())
          if (state) {
            // Format city with proper capitalization
            const formattedCity = city
              .split(/[\s-]+/)
              .map(word => {
                const lowercaseWords = ['of', 'the', 'and', 'in', 'on', 'at'];
                if (lowercaseWords.includes(word.toLowerCase()) && locationLabel !== '') {
                  return word.toLowerCase();
                }
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
              })
              .join(' ')
              .trim();
            
            // Format as "City, STATE"
            locationLabel = `${formattedCity}, ${state.toUpperCase()}`
          } else {
            // If no state, just format city
            locationLabel = city
              .split(/[\s-]+/)
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ')
              .trim();
          }
        } else {
          // For zip codes and GPS coordinates, use as-is
          locationLabel = paramValue
        }        locationType = paramType
        locationValue = paramValue

        // Update user's location information
        await userManagement.updateUserLocation(wxUsers, wxUserId, wxChatUser, locationLabel, locationType, locationValue)
        // creates needed provider specific geo data format from user's common reference
        let newGeoData = await wxBotProviderMap.activeProvider.updateProvGeoData(wxChatUser)
        debugLog("newGeoData: " + JSON.stringify(newGeoData, null, 3))

        // Confirm the location update to the user
        const currentLocationInfo = `Current Provider: ${activeProviderName}\nYour current location is set to: Label=${locationLabel} (Location=${locationValue})`
        await sendMessage(chat, wxChatUser, currentLocationInfo)

        // prime the weather forecast data cache with this new location id
        let xxx = await wxBotProviderMap.activeProvider.getProvForecastData(wxChatUser)

        // get the polygon URL
        let polyURL = await wxBotProviderMap.activeProvider.getProvPolyMapURL(wxChatUser)
        if (polyURL.isValid) {
          // update the geoData with the polyURL
          wxBotProviderMap.activeProvider.provGeoData.find((loc) => loc.geoData === locationValue).polyMapURL = polyURL.polyURL
        }
      } //end of else paramType is not loc-label

      // things were updated, log the wxChatUser
      debugLog("wxChatUser: " + JSON.stringify(wxChatUser, null, 3))
    } else if (wxChatUser.locationValue) {
      // If no valid parameter but a location is set, send current location info
      const currentLocationInfo = `Current Provider: ${activeProviderName}\nYour current location is set to: Label=${wxChatUser.location.label} (Location=${wxChatUser.location.value})`
      await sendMessage(chat, wxChatUser, currentLocationInfo)
    } else {
      // If no valid parameter and no location is set
      await sendMessage(chat, wxChatUser, "No location is currently set. Please provide a valid location.")
    }

    return
  } else if (qualified_msg.msg_subject === "location" && qualified_msg.isValid && qualified_msg.msg_criteria == "unknown") {
    if (wxChatUser.location) {
      debugLog("wxChatUser.location: " + JSON.stringify(wxChatUser.location, null, 3))
      // If no valid parameter but a location is set, send current location info
      const currentLocationInfo = `Current Provider: ${activeProviderName}\nYour current location is set to: Label=${wxChatUser.location.label} (Location=${wxChatUser.location.value})`
      await sendMessage(chat, wxChatUser, currentLocationInfo)
      return
    } else {
      debugLog("No location is set...")
      const currentLocationInfo = "No location is set...\n" + HELP_LOCATION_MSG
      await sendMessage(chat, wxChatUser, currentLocationInfo)
      return
    } //end of else no location is set
  } //end of location related activity

  return
} //end of handleLocationUpdate

const processUserRequest = async (wxData, qualMsg) => {
  logFunctionName()
  debugLog("wxData= " + JSON.stringify(wxData, null, 3) + " qualMsg= " + JSON.stringify(qualMsg, null, 3))

  // Create processor with provider type and resolution
  const processor = new WxDataProcessor(
    wxData.providerType, 
    wxData.periodResolution
  )

  // Process the request
  const formattedData = await processor.findThisKindOfWeather(wxData, qualMsg)
  return formattedData
}

class WxDataProcessor {
  constructor(providerType, periodResolution) {
    this.providerType = providerType
    this.periodResolution = periodResolution
  }

  async findThisKindOfWeather(days, qualMsg) {
    // days is now array of WxDay objects
    switch (qualMsg.msg_subject.toLowerCase()) {
      case "temp":
        return this.FindByTempFilter(days, qualMsg)
      case "rain":
        return this.FindRainWeather(days, qualMsg)  
      case "wind":
        return this.FindWindyWeather(days, qualMsg)
      case "wxforecasts":
        return this.FilterForecastWeather(days, qualMsg)
      case "wxalerts":
        return this.findActiveAlerts(days, qualMsg)
      case "badweather":
        return this.FindBadWeatherWords(days, qualMsg)
      default:
        return ["Unsupported weather data type"]
    }
  }


  FindByTempFilter(days, qualMsg) {
    let formattedData = []
    const match = qualMsg.qualifiedParameter.match(/(hilo|hi|lo)([<>])(\d+)/)
    if (!match) {
      formattedData.push("Invalid temperature parameter format.")
      return formattedData
    }

    const [, tempType, operator, value] = match
    const threshold = parseInt(value)

    days.forEach(day => {
      let meetsCondition = false
      let tempToCheck
      let periodType

      switch(tempType) {
        case "hilo":
          meetsCondition = (operator === ">" && 
            (day.summary.high > threshold || day.summary.low > threshold)) ||
            (operator === "<" && 
            (day.summary.high < threshold || day.summary.low < threshold))
          break
        case "hi":
          tempToCheck = day.summary.high
          periodType = 'day'
          meetsCondition = (operator === ">" && tempToCheck > threshold) || 
                          (operator === "<" && tempToCheck < threshold)
          break
        case "lo":
          tempToCheck = day.summary.low
          periodType = 'night'
          meetsCondition = (operator === ">" && tempToCheck > threshold) || 
                          (operator === "<" && tempToCheck < threshold)
          break
      }

      if (meetsCondition) {
        // For multi-period providers, we can get the specific period description
        let description = day.summary.description
        if (day.periods.length > 0 && periodType) {
          const period = day.periods.find(p => p.timeOfDay === periodType)
          if (period) {
            description = period.conditions.description
          }
        }

        const tempInfo = tempType === "hilo" ? 
          `High: ${day.summary.high}°F, Low: ${day.summary.low}°F` :
          `${tempType === "hi" ? "High" : "Low"}: ${tempToCheck}°F`

        formattedData.push(cleanupString(
          `${chatTeal(day.dayOfWeek)}: ${chatYellow(tempInfo)}. ${description}`
        ))
      }
    })

    if (formattedData.length === 0) {
      formattedData.push(
        `No days found with ${
          tempType === "hilo" ? "temperatures" : 
          tempType === "hi" ? "high temperatures" : 
          "low temperatures"
        } ${operator} ${threshold}°F.`
      )
    }

    return formattedData
  }

  FilterForecastWeather(days, qualMsg) {
    logFunctionName()
    if (!qualMsg.qualifiedParameter) {
      return this.formatUnfilteredForecastData(days)
    }

    const params = qualMsg.qualifiedParameter
    switch (params.action.toLowerCase()) {
      case "search":
        return this.handleSearchCriteria(days, params.searchValue)
      case "day":
        return this.formatThisDayForecast(days, params.dayValue)
      case "ndays":
        const n = parseInt(params.numOfDays) || 1  // Default to 1 if invalid
        const maxDays = days.length - 1  // Subtract 1 because we start from tomorrow
        const daysToShow = Math.min(n, maxDays)  // Don't exceed available days
        return this.formatUnfilteredForecastData(days.slice(1, daysToShow + 1))
      case "today":
        return this.formatUnfilteredForecastData(days.slice(0, 1))
      case "tomorrow":
        return this.formatUnfilteredForecastData(days.slice(1, 2))
      case "tonight":
        if (this.periodResolution === WX_PERIOD_RESOLUTION.DAILY) {
          // For daily resolution, display today's entire forecast
          return this.formatUnfilteredForecastData(days.slice(0, 1))
        } 
        else if (this.periodResolution === WX_PERIOD_RESOLUTION.TWELVE_HOUR) {
          // For 12-hour resolution, find the correct period
          const periods = days[0].periods
          debugLog('Debug - Array Check:', {
            isArray: Array.isArray(periods),
            length: periods.length,
            periodTypes: periods.map(p => typeof p),
            timeOfDays: periods.map(p => p.timeOfDay)
          })

          // Test direct array access
          debugLog('Debug - Direct Access:', {
            period0: periods[0]?.timeOfDay,
            period1: periods[1]?.timeOfDay
          })

          // Test find with debugging
          const nightPeriod = periods.find(p => {
            debugLog('Debug - Find iteration:', {
              timeOfDay: p.timeOfDay,
              matches: p.timeOfDay === "night"
            })
            return p.timeOfDay === "night"
          })

          switch(params.action.toLowerCase()) {
            case "tonight":
              debugLog('Debug - Night Period Found:', nightPeriod)
              return this.formatTonightForecast(nightPeriod)
          }
        }
        else if (this.periodResolution === WX_PERIOD_RESOLUTION.HOURLY) {
          // For hourly resolution, group relevant hours
          const currentHour = new Date().getHours()
          const periods = days[0].periods
          switch(params.action.toLowerCase()) {
            case "tonight":
              return this.formatHourlyForecast(periods.filter(p => {
                  const hour = new Date(p.startTime).getHours()
                          return hour >= 18 || hour < 6}),"Tonight")
          }
        }
        else {
          return ["case tonight fell through all if checks"]
        }
      default:
        return ["Invalid forecast request"]
    }
  }

  formatTodayForecast(day) {
    debugLog("WxDataProcessor formatTodayForecast input:", { day: JSON.stringify(day) })  // Add debug logging
    const formattedData = []
    
    // Add the daily summary if no periods
    if (!day.periods.length) {
      formattedData.push(this.formatDailyTempsSummaryStr(day))
      return formattedData
    }

    // For multi-period providers, get all remaining periods for today
    const now = new Date()
    const todayPeriods = day.periods.filter(period => 
      new Date(period.startTime) >= now
    )

    todayPeriods.forEach(period => {
      formattedData.push(this.format12hrTempsSummaryStr(day.dayOfWeek, period))
    })

    return formattedData.length ? formattedData : ["No more forecasts available for today"]
  }

  formatTonightForecast(period) {
    debugLog("WxDataProcessor formatTonightForecast input:", { period })
    
    if (!period || !period.conditions) {
      return ["No tonight forecast available"]
    }

    const formattedData = []
    
    // Format the night period data
    formattedData.push(
      `Tonight: ${period.conditions.description} ` +
      `Temperature: ${period.temperature}°F. ` +
      `${period.conditions.precipitation.probability > 0 ? 
        `Chance of precipitation: ${period.conditions.precipitation.probability}%. ` : 
        ''}`
    )

    return formattedData
  }


  async formatDailyForecast(day, timeframe) {
    if (!day) return ["No forecast data available for " + timeframe]

    const tempDisplay = day.temperature > cfg.appConfig.tempHot ? 
      chatYellow(`${day.highTemp}°F`) : 
      day.temperature < cfg.appConfig.tempCold ? 
        chatBlue(`${day.highTemp}°F`) : 
        `${day.highTemp}°F`

    const windInfo = day.windSpeed > 0 ? 
      ` Wind ${day.windDir} ${day.windSpeed}${day.windGust > 0 ? ` gusting to ${day.windGust}` : ''} mph.` : 
      ''
    
    const precipInfo = day.precipProb > 0 ? 
      ` Chance of precipitation ${day.precipProb}%.` : 
      ''

    return [cleanupString(
      `${chatTeal(timeframe.charAt(0).toUpperCase() + timeframe.slice(1))}: ` +
      `High ${tempDisplay}. ` +
      `${day.description}${windInfo}${precipInfo}`
    )]
  }

  async formatHourlyForecast(periods, timeframe) {
    if (!periods || periods.length === 0) {
      return ["No forecast data available for " + timeframe]
    }

    let formattedData = []
    let currentTemp = null
    let maxTemp = -Infinity
    let minTemp = Infinity
    let conditions = new Set()
    let maxWind = 0
    let maxGust = 0
    let precipProb = 0

    // Analyze all periods
    periods.forEach(period => {
      if (!currentTemp) currentTemp = period.temperature
      maxTemp = Math.max(maxTemp, period.temperature)
      minTemp = Math.min(minTemp, period.temperature)
      conditions.add(period.conditions.description)
      maxWind = Math.max(maxWind, period.conditions.wind.speed)
      maxGust = Math.max(maxGust, period.conditions.wind.gust)
      precipProb = Math.max(precipProb, period.conditions.precipitation.probability)
    })

    // Format temperature display
    const tempDisplay = (temp) => {
      if (temp > cfg.appConfig.tempHot) return chatYellow(`${temp}°F`)
      if (temp < cfg.appConfig.tempCold) return chatBlue(`${temp}°F`)
      return `${temp}°F`
    }

    // Build the forecast string
    let forecastStr = `${chatTeal(timeframe)}: `
    
    // Temperature info
    if (maxTemp === minTemp) {
      forecastStr += `Temperature steady around ${tempDisplay(maxTemp)}. `
    } else {
      forecastStr += `Temperature ranging from ${tempDisplay(minTemp)} to ${tempDisplay(maxTemp)}. `
    }

    // Conditions
    forecastStr += Array.from(conditions).join('. ') + '. '

    // Wind info
    if (maxWind > 0) {
      forecastStr += `Winds up to ${maxWind}${maxGust > 0 ? ` gusting to ${maxGust}` : ''} mph. `
    }

    // Precipitation probability
    if (precipProb > 0) {
      forecastStr += `Chance of precipitation ${precipProb}%.`
    }

    formattedData.push(cleanupString(forecastStr))
    return formattedData
  }


  formatDailyTempsSummaryStr(day) {
    return cleanupString(
      `${chatTeal(day.dayOfWeek)}: High ${
        day.summary.high > cfg.appConfig.tempHot ? 
          chatYellow(`${day.summary.high}°F`) : 
          `${day.summary.high}°F`
      }, Low ${
        day.summary.low < cfg.appConfig.tempCold ? 
          chatBlue(`${day.summary.low}°F`) : 
          `${day.summary.low}°F`
      }. ${day.summary.description}`
    )
  }

  format12hrTempsSummaryStr(dayName, period) {
    console.log("WxDataProcessor formatPeriod input:", { dayName, period: JSON.stringify(period) })  // Add debug logging
    const timePrefix = period.timeOfDay === 'night' ? 'Night' : ''
    const periodName = timePrefix ? `${dayName} ${timePrefix}` : dayName
    
    return cleanupString(
      `${chatTeal(periodName)}: ${
        period.temperature > cfg.appConfig.tempHot ? 
          chatYellow(`${period.temperature}°F`) : 
          period.temperature < cfg.appConfig.tempCold ? 
            chatBlue(`${period.temperature}°F`) : 
            `${period.temperature}°F`
      }. ${period.conditions.description}`
    )
  }

  FindRainWeather(days, qualMsg) {
    console.log('DEBUG: FindRainWeather input:', {
      daysCount: days.length,
      firstDayStructure: days[0],
      qualMsg
    })
    let formattedData = []

    // For unqualified requests (just "rain"), use summary data
    if (!qualMsg.qualifiedParameter) {
      days.forEach(day => {
        if (day.summary.precipitation.probability > 0) {
          formattedData.push(cleanupString(
            `${chatTeal(day.dayOfWeek)}: ${chatYellow(`${day.summary.precipitation.probability}% chance of rain`)}. ${day.summary.description}`
          ))
        }
      })
      
      if (formattedData.length === 0) {
        formattedData.push("No rain expected in the forecast period.")
      }
      return formattedData
    }

    // For qualified requests (e.g., "r>30"), use appropriate data source
    const match = qualMsg.qualifiedParameter.match(/r([<>])(\d+)/)
    if (!match) {
      formattedData.push("Invalid rain parameter format.")
      return formattedData
    }

    const [, operator, value] = match
    const threshold = parseInt(value)

    // For DAILY resolution providers, use summary data
    if (this.periodResolution === WX_PERIOD_RESOLUTION.DAILY) {
      days.forEach(day => {
        const rainProb = day.summary.precipitation.probability
        const meetsCondition = (operator === ">" && rainProb > threshold) || 
                             (operator === "<" && rainProb < threshold)

        if (meetsCondition) {
          formattedData.push(cleanupString(
            `${chatTeal(day.dayOfWeek)}: ${chatYellow(`${rainProb}% chance of rain`)}. ${day.summary.description}`
          ))
        }
      })
    }
    // For TWELVE_HOUR resolution providers, use periods data
    else if (this.periodResolution === WX_PERIOD_RESOLUTION.TWELVE_HOUR) {
      days.forEach(day => {
        day.periods.forEach(period => {
          const rainProb = period.conditions.precipitation.probability
          const meetsCondition = (operator === ">" && rainProb > threshold) || 
                               (operator === "<" && rainProb < threshold)

          if (meetsCondition) {
            const timePrefix = period.timeOfDay === 'night' ? 'Night' : ''
            const periodName = timePrefix ? `${day.dayOfWeek} ${timePrefix}` : day.dayOfWeek
            formattedData.push(cleanupString(
              `${chatTeal(periodName)}: ${chatYellow(`${rainProb}% chance of rain`)}. ${period.conditions.description}`
            ))
          }
        })
      })
    }

    if (formattedData.length === 0) {
      formattedData.push(`No periods found with rain probability ${operator} ${threshold}%.`)
    }

    return formattedData
  }

  FindWindyWeather(days, qualMsg) {
    let formattedData = []
    const match = qualMsg.qualifiedParameter.match(/(wmin|wmax|gmin)([<>])(\d+)/)
    if (!match) {
      formattedData.push("Invalid wind parameter format.")
      return formattedData
    }

    const [, paramType, operator, value] = match
    const threshold = parseInt(value)

    days.forEach(day => {
      let meetsCondition = false
      const windSpeed = day.summary.wind.avgSpeed
      const gustSpeed = day.summary.wind.maxGust

      switch (paramType) {
        case "wmin":
        case "wmax":
          meetsCondition = (operator === ">" && (windSpeed > threshold || gustSpeed > threshold)) ||
                          (operator === "<" && (windSpeed < threshold && gustSpeed < threshold))
          break
        case "gmin":
          meetsCondition = (operator === ">" && gustSpeed > threshold)
          break
      }

      if (meetsCondition) {
        let windInfo = `Wind: ${windSpeed} mph`
        if (gustSpeed > 0 && gustSpeed !== windSpeed) {
          windInfo += `, gusts up to ${gustSpeed} mph`
        }
        formattedData.push(cleanupString(
          `${chatTeal(day.dayOfWeek)}: ${chatYellow(windInfo)}. ${day.summary.description}`
        ))
      }

      // Check individual periods if available
      if (day.periods && day.periods.length > 0) {
        day.periods.forEach(period => {
          const periodWind = period.conditions.wind
          meetsCondition = false
          
          switch (paramType) {
            case "wmin":
            case "wmax":
              meetsCondition = (operator === ">" && 
                (periodWind.speed > threshold || periodWind.gust > threshold)) ||
                (operator === "<" && 
                (periodWind.speed < threshold && periodWind.gust < threshold))
              break
            case "gmin":
              meetsCondition = (operator === ">" && periodWind.gust > threshold)
              break
          }

          if (meetsCondition) {
            const timePrefix = period.timeOfDay === 'night' ? 'Night' : ''
            const periodName = timePrefix ? `${day.dayOfWeek} ${timePrefix}` : day.dayOfWeek
            let windInfo = `Wind: ${periodWind.speed} mph`
            if (periodWind.gust > 0) {
              windInfo += `, gusts up to ${periodWind.gust} mph`
            }
            formattedData.push(cleanupString(
              `${chatTeal(periodName)}: ${chatYellow(windInfo)}. ${period.conditions.description}`
            ))
          }
        })
      }
    })

    if (formattedData.length === 0) {
      formattedData.push(`No periods found with ${paramType === "gmin" ? "gust" : "wind"} speeds ${operator} ${threshold} mph.`)
    }

    return formattedData
  }

  FindBadWeatherWords(days, qualMsg) {
    let formattedData = []
    let loopData = []

    // For DAILY resolution providers, use summary data
    if (this.periodResolution === WX_PERIOD_RESOLUTION.DAILY) {
      days.forEach(day => {
        if (day.flags.isBadWeather) {
          loopData.push(this.formatDailyTempsSummaryStr(day))   //debug--wrong name
        }
      })
      if (loopData.length > 0) { formattedData = loopData}
    }
    // For TWELVE_HOUR resolution providers, use periods data
    else if (this.periodResolution === WX_PERIOD_RESOLUTION.TWELVE_HOUR) {
      days.forEach(day => {
          // Add period-specific bad weather if available
        day.periods.forEach(period => {
          if (period.isBadWeather || 
            period.conditions.description.toLowerCase().includes('severe') ||
              period.conditions.description.toLowerCase().includes('warning')) {
                const timePrefix = period.timeOfDay === 'night' ? 'Night' : ''
                const periodName = timePrefix ? `${day.dayOfWeek} ${timePrefix}` : day.dayOfWeek
                debugLog('DEBUG: FindBadWeatherWords periodName:' +periodName + ', ' + JSON.stringify(period))
                loopData.push(this.formatWxPeriod(day.dayOfWeek, period))
              }
            })
          
        })
        if (loopData.length > 0) { formattedData = loopData}
      }

    if (formattedData.length === 0) {
      formattedData.push("No periods with bad weather found in the forecast.")
    }

    // Highlight bad weather words in each formatted string
    const badWeatherWords = qualMsg.qualifiedParameter
    formattedData = formattedData.map(str => 
      this.formatHighlightWords(str, badWeatherWords)
    )

    return formattedData
  }


  formatHighlightWords(origStr, arrWordsToHighlight) {
    logFunctionName()
    let newStr = origStr

    // Highlight specific words in the description
    arrWordsToHighlight.forEach((word) => {
      // Escape special characters in the word
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`\\b${escapedWord}\\b`, "gi")
      newStr = newStr.replace(regex, (match) => chatYellow(match))
    })
  
    return newStr
  }
  

  findActiveAlerts(wxaData, qualMsg) {
    logFunctionName()
    let formattedData = []

    // Iterate over each alert in wxaData
    wxaData.forEach((alert) => {
      // Check if this alert should be reported
      if (alert.doReport === true) {
        // If so, push its formatted message to formattedData
        formattedData.push(alert.formatted)
      }
    })

    // If no alerts were added to formattedData, add the "Good news" message
    if (formattedData.length === 0) {
      formattedData.push("Good news! No active location alerts found.")
    }

    return formattedData
  }


  formatWxPeriod(dayName, period) {
    const timePrefix = period.timeOfDay === 'night' ? 'Night' : ''
    const periodName = timePrefix ? `${dayName} ${timePrefix}` : dayName
    
    // Build the description with important weather details
    const description = [
      period.conditions.description,
      `Temperature: ${period.temperature}°F`,
      period.conditions.precipitation.probability > 0 ? 
        `Precipitation chance: ${period.conditions.precipitation.probability}%` : null,
      period.conditions.wind.speed > 0 ?
        `Wind: ${period.conditions.wind.speed}mph${period.conditions.wind.gust ? 
          `, gusts to ${period.conditions.wind.gust}mph` : ''}` : null
    ].filter(Boolean).join('. ')

    return cleanupString(`${chatTeal(periodName)}: ${description}`)
  }


  formatThisDayForecast(days, dayValue) {
    const formattedData = []
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    const searchDay = dayValue.toLowerCase()
    const isWeekend = searchDay === "wknd"
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (const day of days) {
      const forecastDate = new Date(day.date)
      forecastDate.setHours(0, 0, 0, 0)

      // Get the raw day name without any formatting
      const rawDayName = dayNames[forecastDate.getDay()]

      console.log('Debug - Day Names:', {
        searchDay,
        rawDayName,
        formattedDayName: day.dayOfWeek
      })

      const dayMatches = isWeekend ? 
        ["saturday", "sunday"].includes(rawDayName) :
        rawDayName.startsWith(searchDay)
      
      if (dayMatches) {
        // Calculate end of current week (next Sunday)
        const endOfCurrentWeek = new Date(today)
        endOfCurrentWeek.setDate(today.getDate() + (7 - today.getDay()))
        endOfCurrentWeek.setHours(23, 59, 59, 999)

        // Check if this is the first occurrence after today
        const isNextOccurrence = forecastDate > today && (
          // Either the date is within current week
          forecastDate <= endOfCurrentWeek ||
          // Or it's the first occurrence of this day after today
          !formattedData.length
        )

        console.log('Debug - Occurrence Check:', {
          dayOfWeek: day.dayOfWeek,
          isAfterToday: forecastDate > today,
          isWithinCurrentWeek: forecastDate <= endOfCurrentWeek,
          isNextOccurrence,
          dayName: day.dayOfWeek
        })

        if (isNextOccurrence) {
          // For DAILY resolution providers, use summary
          if (this.periodResolution === WX_PERIOD_RESOLUTION.DAILY) {
            formattedData.push(this.formatDailyTempsSummaryStr(day))
          }
          // For MULTI_PERIOD providers, use periods
          else if (this.periodResolution === WX_PERIOD_RESOLUTION.TWELVE_HOUR) {
            // Sort periods to ensure 'day' comes before 'night'
            const sortedPeriods = [...day.periods].sort((a, b) => 
              a.timeOfDay === 'night' ? 1 : -1
            )
            
            sortedPeriods.forEach(period => {
              const timePrefix = period.timeOfDay === 'night' ? 'Night' : ''
              const periodName = timePrefix ? `${day.dayOfWeek} ${timePrefix}` : day.dayOfWeek
              formattedData.push(cleanupString(
                `${chatTeal(periodName)}: ${period.conditions.description}`
              ))
            })
          }
          // For HOURLY providers, group by day parts
          else if (this.periodResolution === WX_PERIOD_RESOLUTION.HOURLY) {
            // Group hours into day parts (morning, afternoon, evening, night)
            const dayParts = {
              morning: day.periods.filter(p => {
                const hour = new Date(p.startTime).getHours()
                return hour >= 6 && hour < 12
              }),
              afternoon: day.periods.filter(p => {
                const hour = new Date(p.startTime).getHours()
                return hour >= 12 && hour < 18
              }),
              evening: day.periods.filter(p => {
                const hour = new Date(p.startTime).getHours()
                return hour >= 18 && hour < 24
              }),
              night: day.periods.filter(p => {
                const hour = new Date(p.startTime).getHours()
                return hour >= 0 && hour < 6
              })
            }

            // Format each day part that has data
            Object.entries(dayParts).forEach(([partName, periods]) => {
              if (periods.length > 0) {
                formattedData.push(this.formatHourlyForecast(
                  periods,
                  `${day.dayOfWeek} ${partName.charAt(0).toUpperCase() + partName.slice(1)}`
                ))
              }
            })
          }
          // Only break if not weekend, so we can get both Sat and Sun
          if (!isWeekend) {
            break
          }
        }
      }
    }

    if (formattedData.length === 0) {
      formattedData.push(`No forecast found for ${isWeekend ? "weekend" : dayValue}`)
    }

    return formattedData.flat() // Flatten in case of nested arrays from hourly forecasts
  }

  handleSearchCriteria(days, searchValue) {
    const formattedData = []
    const searchTerm = searchValue.toLowerCase()

    days.forEach(day => {
      // For DAILY resolution, check summary
      if (this.periodResolution === WX_PERIOD_RESOLUTION.DAILY) {
        if (day.summary.description.toLowerCase().includes(searchTerm)) {
          formattedData.push(cleanupString(
            `${chatTeal(day.dayOfWeek)}: ${day.summary.description}`
          ))
        }
      }
      // For MULTI_PERIOD, check each period
      else if (this.periodResolution === WX_PERIOD_RESOLUTION.TWELVE_HOUR) {
        day.periods.forEach(period => {
          if (period.conditions.description.toLowerCase().includes(searchTerm)) {
            const timePrefix = period.timeOfDay === 'night' ? 'Night' : ''
            const periodName = timePrefix ? `${day.dayOfWeek} ${timePrefix}` : day.dayOfWeek
            formattedData.push(cleanupString(
              `${chatTeal(periodName)}: ${period.conditions.description}`
            ))
          }
        })
      }
    })

    if (formattedData.length === 0) {
      formattedData.push(`No forecast periods found containing "${searchValue}"`)
    }

    return formattedData
  }

  formatUnfilteredTempData(days) {
    let formattedData = []

    days.forEach(day => {
      // Format string with color coding
      let formattedString = `${chatTeal(day.dayOfWeek)} (hi: `

      // Add color to high temperature if it exceeds tempHot
      if (day.summary.high > cfg.appConfig.tempHot) {
        formattedString += chatYellow(`${day.summary.high}°`)
      } else {
        formattedString += `${day.summary.high}°`
      }

      formattedString += `, night: `
      
      // Add color to low temperature if it's below tempCold
      if (day.summary.low < cfg.appConfig.tempCold) {
        formattedString += chatBlue(`${day.summary.low}°`)
      } else {
        formattedString += `${day.summary.low}°`
      }
      
      formattedString += ")"

      formattedData.push(cleanupString(formattedString))
    })

    return formattedData
  }

  formatUnfilteredForecastData(days) {
    let formattedData = []

    days.forEach(day => {
      // For DAILY resolution providers, use summary
      if (this.periodResolution === WX_PERIOD_RESOLUTION.DAILY) {
        formattedData.push(cleanupString(
          `${chatTeal(day.dayOfWeek)}: ${day.summary.description}`
        ))
      }
      // For MULTI_PERIOD providers, use periods
      else if (this.periodResolution === WX_PERIOD_RESOLUTION.TWELVE_HOUR) {
        // Sort periods to ensure 'day' comes before 'night'
        const sortedPeriods = [...day.periods].sort((a, b) => 
          a.timeOfDay === 'night' ? 1 : -1
        )
        
        sortedPeriods.forEach(period => {
          const timePrefix = period.timeOfDay === 'night' ? 'Night' : ''
          const periodName = timePrefix ? `${day.dayOfWeek} ${timePrefix}` : day.dayOfWeek
          formattedData.push(cleanupString(
            `${chatTeal(periodName)}: ${period.conditions.description}`
          ))
        })
      }
      // For HOURLY providers, group by day parts
      else if (this.periodResolution === WX_PERIOD_RESOLUTION.HOURLY) {
        const dayParts = {
          morning: day.periods.filter(p => {
            const hour = new Date(p.startTime).getHours()
            return hour >= 6 && hour < 12
          }),
          afternoon: day.periods.filter(p => {
            const hour = new Date(p.startTime).getHours()
            return hour >= 12 && hour < 18
          }),
          evening: day.periods.filter(p => {
            const hour = new Date(p.startTime).getHours()
            return hour >= 18 && hour < 24
          }),
          night: day.periods.filter(p => {
            const hour = new Date(p.startTime).getHours()
            return hour >= 0 && hour < 6
          })
        }

        Object.entries(dayParts).forEach(([partName, periods]) => {
          if (periods.length > 0) {
            formattedData.push(this.formatHourlyForecast(
              periods,
              `${day.dayOfWeek} ${partName.charAt(0).toUpperCase() + partName.slice(1)}`
            ))
          }
        })
      }
    })

    return formattedData.flat()
  }

}

  async function handleWeatherAlerts(chat, wxChatUser, qualified_msg) {
    logFunctionName()
    // Handle weather alerts requests
    if (qualified_msg.msg_subject.toLowerCase() === "wxalerts" && qualified_msg.isValid) {
      const wxaUserData = await wxBotProviderMap.activeProvider.getwxAlertsData(wxChatUser)

      if (wxaUserData.isValid) {
        let formattedResponse = []

        // Default formatting for alerts
        debugLog("Default formatting for alerts")
        formattedResponse = await processUserRequest(wxaUserData.wxaData, qualified_msg)

        preMsg =
          "Weather for " +
          chatTeal(wxChatUser.location.label) +
          (wxChatUser.location.label !== wxChatUser.location.value ? "(" + wxChatUser.location.value + ")" : "")

        await sendChats(chat, wxChatUser, formattedResponse, cleanupString(preMsg))

        // provider returned invalid dataset for some reason
      } else {
        preMsg = `Your current location is set to: Label=${wxChatUser.location.label} (Location=${wxChatUser.location.value})`
        await sendMessage(chat, wxChatUser, "I'm sorry, I couldn't retrieve the weather alert data for your location.", preMsg)
      }
    } //end of weather alerts related activity
    return
  } //end of handleWeatherAlerts

  async function handleWeatherForecast(chat, wxChatUser, qualified_msg) {
    logFunctionName()
    console.log('DEBUG: Starting handleWeatherForecast with:', {
      subject: qualified_msg.msg_subject,
      criteria: qualified_msg.msg_criteria,
      param: qualified_msg.qualifiedParameter
    })

    const wxfUserData = await wxBotProviderMap.activeProvider.getProvForecastData(wxChatUser)
    console.log('DEBUG: Provider returned data structure:', {
      isValid: wxfUserData.isValid,
      providerType: wxfUserData.wxfData?.providerType,
      periodResolution: wxfUserData.wxfData?.periodResolution,
      daysCount: wxfUserData.wxfData?.wxfData?.length,
      firstDay: JSON.stringify(wxfUserData.wxfData?.wxfData?.[0])
    })

    // Handle weather forecast requests
    if (["temp", "rain", "wind", "badweather", "wxforecasts"].includes(qualified_msg.msg_subject.toLowerCase()) && qualified_msg.isValid) {
      const userLocation = wxChatUser.location

      if (!userLocation) {
        await sendMessage(chat, wxChatUser, "Please set your location first before requesting weather information.")
        return //exits switch and exits function
      }

      if (wxfUserData.isValid) {
        let formattedResponse = []
        
        // Create processor instance
        const processor = new WxDataProcessor(
          wxfUserData.wxfData.providerType, 
          wxfUserData.wxfData.periodResolution
        )

        // Add debug logging before processing
        console.log('DEBUG: Processing with:', {
          providerType: wxfUserData.wxfData.providerType,
          periodResolution: wxfUserData.wxfData.periodResolution,
          dataLength: wxfUserData.wxfData.wxfData.length
        })

        // New logic block for formatting temp and wxforecasts data
        if (
          (qualified_msg.msg_subject.toLowerCase() === "temp" || 
           qualified_msg.msg_subject.toLowerCase() === "wxforecasts") &&
          (qualified_msg.qualifiedParameter === undefined ||
           qualified_msg.qualifiedParameter === null ||
           qualified_msg.qualifiedParameter === "")
        ) {
          // Pass the array of normalized days
          if (qualified_msg.msg_subject.toLowerCase() === "temp") {
            formattedResponse = await processor.formatUnfilteredTempData(wxfUserData.wxfData.wxfData)
          } else if (qualified_msg.msg_subject.toLowerCase() === "wxforecasts") {
            formattedResponse = await processor.formatUnfilteredForecastData(wxfUserData.wxfData.wxfData)
          }
        } else {
          // Default formatting for other subjects or when qualifiedParameter is not empty
          debugLog("Default formatting for other subjects or when qualifiedParameter is not empty")
          formattedResponse = await processor.findThisKindOfWeather(wxfUserData.wxfData.wxfData, qualified_msg)
        }

        preMsg =
          "Weather for " +
          chatTeal(wxChatUser.location.label) +
          (wxChatUser.location.label !== wxChatUser.location.value ? "(" + wxChatUser.location.value + ")" : "")

        await sendChats(chat, wxChatUser, formattedResponse, cleanupString(preMsg))

        debugLog("wxfUserData.wxfData: " + JSON.stringify(wxfUserData.wxfData, null, 3))

      } else {
        preMsg = `Your current location is set to: Label=${wxChatUser.location.label} (Location=${wxChatUser.location.value})`
        await sendMessage(chat, wxChatUser, "I'm sorry, I couldn't retrieve the weather data for your location.", preMsg)
      }
    } else if (!qualified_msg.isValid) {
      await sendMessage(chat, wxChatUser, qualified_msg.inValidReason || "I'm sorry, I didn't understand that request.")
    }
    return
  } //end of handleWeatherForecast

  async function handleHelpRequest(chat, wxChatUser, qualified_msg) {
    debugLog("in handleHelpRequest function...")
    // Handle help requests
    if (qualified_msg.msg_subject === "help" && qualified_msg.isValid) {
      if (qualified_msg.msg_criteria === "examples") {
        await sendMessage(chat, wxChatUser, HELP_EXAMPLES_MSG)
      } else if (qualified_msg.msg_criteria === "location") {
        await sendMessage(chat, wxChatUser, HELP_LOCATION_MSG)
      } else if (qualified_msg.msg_criteria === "shortcuts") {
        await sendMessage(chat, wxChatUser, HELP_SHORTCUTS_MSG)
      } else if (qualified_msg.msg_criteria === "adminhost" && (wxChatUser.chattyType === "host" || wxChatUser.chattyType === "admin")) {
        await sendMessage(chat, wxChatUser, HELP_ADMINHOST_MSG)
      } else {
        await sendMessage(chat, wxChatUser, "Lets's start from the beginning...\n\n" + WELCOME_MSG)
      }
      return
    }
  }

  async function adminListUsers(chat, wxUsers, wxChatUser, qualified_msg) {
    logFunctionName()
    let userList = []

    for (const userId in wxUsers) {
      const user = wxUsers[userId]
      const userInfo =
        `User ID: ${user.wxUserId}, ` +
        `Type: ${user.chattyType}, ` +
        `Name: ${user.displayName}, ` +
        `Location: ${user.location.label} (${user.location.value}), ` +
        `Status: ${user.isDisabled ? "Disabled" : "Enabled"}` +
        `${user.isDisabled ? ", Reason: " + user.disabledReason : ""}`
      userList.push({info: userInfo, user: user})
    }

    // Sort the userList by isDisabled (disabled first), then by chattyType, then by displayName
    userList.sort((a, b) => {
      if (a.user.isDisabled !== b.user.isDisabled) {
        return b.user.isDisabled ? -1 : 1 // Disabled users first
      }
      if (a.user.chattyType !== b.user.chattyType) {
        return a.user.chattyType.localeCompare(b.user.chattyType)
      }
      return a.user.displayName.toLowerCase().localeCompare(b.user.displayName.toLowerCase())
    })

    // Extract just the info strings after sorting
    const sortedInfoList = userList.map((item) => item.info)

    // Add headers to group the users
    let formattedList = ["User List:"]
    let currentStatus = null
    let currentType = null

    sortedInfoList.forEach((info) => {
      const status = info.includes("Status: Disabled") ? "Disabled" : "Enabled"
      const type = info.split("Type: ")[1].split(",")[0]

      if (status !== currentStatus) {
        formattedList.push(`\n${status} Users:`)
        currentStatus = status
        currentType = null
      }

      if (type !== currentType) {
        formattedList.push(`\n  ${type}:`)
        currentType = type
      }

      formattedList.push(`    ${info}`)
    })

    // Call sendChats to send the user list
    await sendChats(chat, wxChatUser, formattedList)
  }

  async function handleHostFunction(chat, wxUsers, wxChatUser, qualified_msg) {
    logFunctionName()
    const {action, secLevel, ...params} = qualified_msg.qualifiedParameter
    const lowerCaseAction = action.toLowerCase()
    debugLog("in handleHostFunction function at beginning....lowerCaseAction= " + JSON.stringify(qualified_msg, null, 3))

    // Security check
    let hasPermission = false
    if (secLevel === "admin") {
      hasPermission = wxChatUser.chattyType === "host" || wxChatUser.chattyType === "admin"
    } else if (secLevel === "host") {
      hasPermission = wxChatUser.chattyType === "host"
    }

    if (!hasPermission) {
      debugLog("in handleHostFunction function....hasPermission= " + hasPermission)
      debugLog("in handleHostFunction function....wxChatUser.chattyType= " + wxChatUser.chattyType)
      await sendMessage(chat, wxChatUser, "You don't have permission to perform this action.")
      return
    }

    debugLog(`User is a ${wxChatUser.chattyType}, processing ${secLevel} function: ${lowerCaseAction}`)

    switch (lowerCaseAction) {
      case "adduser":
        // Implement add user logic
        break
      case "removeuser":
        // Implement remove user logic
        break
      case "userstatus":
        // Implement enable user logic
        debugLog("in handleHostFunction case userstatus")
        await adminUserStatus(chat, wxUsers, wxChatUser, qualified_msg)
        break
      case "changegroup":
        // Implement disable user logic
        debugLog("in handleHostFunction case changegroup")
        await hostChangeGroup(chat, wxUsers, wxChatUser, qualified_msg)
        break
      case "listusers":
        // Implement list users logic
        debugLog("in handleHostFunction case listusers")
        await adminListUsers(chat, wxUsers, wxChatUser, qualified_msg)
        break
      case "updatevariable":
        // Implement update variable logic
        break
      case "listvariables":
        // Implement list variables logic
        break
      // Add cases for other host functions as needed
      default:
        await sendMessage(chat, wxChatUser, "Unknown host function.")
    }
    return
  }

  async function adminUserStatus(chat, wxUsers, wxChatUser, qualified_msg) {
    logFunctionName()
    const {action, secLevel, ...params} = qualified_msg.qualifiedParameter
    const lowerCaseAction = action.toLowerCase()
    debugLog("in adminUserStatus function....lowerCaseAction= " + lowerCaseAction)
    if (lowerCaseAction === "userstatus") {
      if (params.status === "enable") {
        debugLog("in adminUserStatus function....params.status= " + params.status)
        await userManagement.enableUser(wxUsers, params.userID)
      } else if (params.status === "disable") {
        debugLog("in adminUserStatus function....params.status= " + params.status)
        await userManagement.disableUser(wxUsers, params.userID, params.reason)
      }
    }

    return
  }

  async function hostChangeGroup(chat, wxUsers, wxChatUser, qualified_msg) {
    logFunctionName()
    const {action, secLevel, ...params} = qualified_msg.qualifiedParameter
    const lowerCaseAction = action.toLowerCase()
    debugLog("in hostChangeGroup function....lowerCaseAction= " + lowerCaseAction)
    await userManagement.setUserGroup(wxUsers, params.userID, params.group)

    return
  }

  async function sendMessage(chat, wxChatUser, message, preMsg = null) {
    if (preMsg) {
      await chat.apiSendTextMessage(wxChatUser.apiSendInfo.Type, wxChatUser.apiSendInfo.ID, preMsg)
    }
    await chat.apiSendTextMessage(wxChatUser.apiSendInfo.Type, wxChatUser.apiSendInfo.ID, message)
  }

  async function sendChats(chat, wxChatUser, arr, preMsg = null) {
    debugLog("in sendChats function....")
    debugLog("arr length= " + arr.length)

    if (preMsg) {
      await chat.apiSendTextMessage(wxChatUser.apiSendInfo.Type, wxChatUser.apiSendInfo.ID, preMsg)
    }

    if (arr.length == 0) {
      await chat.apiSendTextMessage(
        wxChatUser.apiSendInfo.Type,
        wxChatUser.apiSendInfo.ID,
        "Sorry, your request found nothing to report, try /h if you need command syntax help"
      )
    } else {
      for (var i = 0; i < arr.length; i++) {
        await chat.apiSendTextMessage(wxChatUser.apiSendInfo.Type, wxChatUser.apiSendInfo.ID, arr[i])
      }
    }
    return
  }

  module.exports = {
    HELP_LOCATION_MSG,
    WELCOME_MSG,
    adminListUsers,
    cleanupString,
    chatTeal,
    chatBlue,
    chatYellow,
    debugLog,
    processUserRequest,
    handleLocationUpdate,
    handleWeatherForecast,
    handleWeatherAlerts,
    handleHelpRequest,
    handleHostFunction,
    evaluateMessage,
    sendMessage,
    sendChats,
    WxDataProcessor
  }
