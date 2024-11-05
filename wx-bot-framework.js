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


const fs = require('fs');
const path = require('path');
const natural = require('natural');

const userManagement = require("./wx-bot-usermgmt")
const wxBotProviderMap = require("./wxf-providers/wx-bot-provider-map")

require('dotenv').config({ path: './weatherBot.env' });
const IS_DEBUG = process.env.DEBUG_MODE === 'true';

const chatTeal = (someString) => {
  return (someString = " !5 " + someString + "! ")
}

const chatBlue = (someString) => {
  return (someString = " !3 " + someString + "! ")
}
const chatYellow = (someString) => {
  return (someString = " !4 " + someString + "! ")
}

const WELCOME_MSG = "Welcome to the weather bot! Before I can provide weather information, I need to know your"+chatYellow('location')+". \n\nYou can easily set your location by sending me a message like,"+chatYellow('my location is 80809')+" or,"+chatYellow('my location is pikes peak,co')+" or"+chatYellow('location 38.8408655,-105.0441532')+" etc.  \n\nFor GPS coordinates, you also can assign a label to the location with an additional message like"+chatYellow('location label \"pikes peak\"')+"\nTo get help later on location setup, send a message with"+chatTeal('help location')+"\n\nAfter setting your location start with a simple message like"+chatTeal('temps')+" or "+chatTeal('any rain this week')+"\n\nFor a good list of examples, send a message with"+chatTeal('help examples');
const HELP_LOCATION_MSG = "\nHere are some examples of messages you can send to set your location:\n\n"+chatYellow('my location is 80809')+"\n"+chatYellow('my location is pikes peak,co')+"\n"+chatYellow('location 38.8408655,-105.0441532')+"\n"+chatYellow('location label \"pikes peak\"')
const HELP_EXAMPLES_MSG = "\nHere are some examples of messages you can send to get weather information for your current location:\n\n"+chatYellow('temps')+"\n"+chatTeal('any')+chatYellow('rain')+chatTeal('this week')+"\n"+chatTeal('any')+chatYellow('windy')+chatTeal('days')+"\n"+chatTeal('any')+chatYellow('bad weather')+chatTeal('this week')+"\n"+chatTeal('rain over 50%')+"\n"+chatTeal('no rain')+"\n"+chatTeal('no wind')+"\n"+chatTeal('wind over 10 mph')+"\n"+chatTeal('weather next 2 days')+"\n"+chatTeal('weather this')+chatYellow('weekend')+"\n"+chatYellow('find cloudy')+chatTeal('days')+"\n"+chatYellow('find sunny')+chatTeal('days')+"\n"+chatTeal('weather on wed')+"\n"+chatTeal('tomorrow')+"\n"+chatTeal('today')+"\n"+chatTeal('tonight')+"\n\nFor a good list of SHORTCUT examples, send a message with"+chatYellow('help shortcuts');
const HELP_SHORTCUTS_MSG = "\nHere are some good SHORTCUT examples of messages you can send to get weather information for your current location:\n\n"
+chatYellow('?')+" (weekly summary of daily temps)\n"
+chatYellow('?>90')+" (find days hotter than 90, use your own number)\n"
+chatYellow('?<35')+" (find days colder than 35, use your own number)\n"
+chatYellow('freeze')+" (find days or nights colder than 32)\n"
+chatYellow('cool')+" or"+chatYellow('chilly')+" (find daytime temps cooler than 60)\n"
+chatYellow('bad weather')+" (searches forecast for bad weather related keywords)\n"
+chatYellow('hot')+" (find daytime temps hotter than 85)\n"

const HELP_ADMINHOST_MSG = "\nHere are some Admin/Host examples of messages you can send to manage the bot:\n\n"
+chatYellow('show users')+" (lists all users)\n"
+chatYellow('disable user [ID] for [reason]')+" (disables a user)\n"
+chatYellow('enable user [ID]')+" (enables a user)\n"
+chatYellow('add admin to [ID]')+" (adds user to admin group)\n"
+chatYellow('remove admin from [ID]')+" (removes user from admin group)\n"

const currentMonth = new Date().getMonth() + 1; // getMonth() returns 0-11, so we add 1
// If it's June (6), July (7), August (8), or September (9), use summerTempHot
// Otherwise, use tempHot
const tempHot = (currentMonth >= 6 && currentMonth <= 9) 
  ? (process.env.summerTempHot || 85)
  : (process.env.tempHot || 75);
  const tempCold = process.env.tempCold || 50;


const debugLog = (msg) => {
    if (IS_DEBUG) {
        console.log(msg);
    }
    return;
  }


const cleanupString = (str) => {
  // First, replace two or more spaces with a single space
  let cleanStr = str.replace(/\s{2,}/g, ' ');
  
  // Then, remove leading spaces
  cleanStr = cleanStr.replace(/^\s+/, '');
  
  return cleanStr;
}


const logFunctionName = () => {
  const stack = new Error().stack;
  const callerName = stack.split('\n')[2].trim().split(' ')[1];
  debugLog(`Currently inside function: ${callerName}`);
};

// Load word lists
const weatherTopics = {
  topic_badWeather: JSON.parse(fs.readFileSync(path.join(__dirname, 'wx-bot-wordlists', 'bad_weather.json'), 'utf8')),
  topic_wxAlerts: JSON.parse(fs.readFileSync(path.join(__dirname, 'wx-bot-wordlists', 'weather_alerts.json'), 'utf8')),
  topic_temps: JSON.parse(fs.readFileSync(path.join(__dirname, 'wx-bot-wordlists', 'temperature.json'), 'utf8')),
  topic_rain: JSON.parse(fs.readFileSync(path.join(__dirname, 'wx-bot-wordlists', 'rain.json'), 'utf8')),
  topic_wind: JSON.parse(fs.readFileSync(path.join(__dirname, 'wx-bot-wordlists', 'wind.json'), 'utf8')),
  topic_wxForecasts: JSON.parse(fs.readFileSync(path.join(__dirname, 'wx-bot-wordlists', 'forecasts.json'), 'utf8')),
  topic_location: JSON.parse(fs.readFileSync(path.join(__dirname, 'wx-bot-wordlists', 'location.json'), 'utf8')),
  topic_hostFunctions: JSON.parse(fs.readFileSync(path.join(__dirname, 'wx-bot-wordlists', 'host_functions.json'), 'utf8'))

};

// Function to find the best matching topic
const findBestMatchingTopic = async (input, topics) => {
  const tokenizer = new natural.WordTokenizer();
  const inputWords = tokenizer.tokenize(input);
  let bestMatch = { topic: null, score: 0 };

  inputWords.forEach(inputWord => {
    for (const [topic, wordsObj] of Object.entries(topics)) {
      wordsObj.generalWords.forEach(word => {
        const score = natural.JaroWinklerDistance(inputWord, word.toLowerCase()); // Convert word to lowercase
        if (score > bestMatch.score) {
          bestMatch = { topic, score };
        }
      });
    }
  });

  return bestMatch.topic;
};



// Function to evaluate the message
const evaluateMessage = async (wxChatUser, msg) => {
  const lowercaseMsg = msg.toLowerCase();

  // First thing to check is if the user is asking for help
  if (lowercaseMsg.includes("help")) {
    let helpType = 'general';
    
    if (lowercaseMsg.includes("example") || lowercaseMsg.includes("examples")) {
      helpType = 'examples';
    } else if (lowercaseMsg.includes("location")) {
      helpType = 'location';
    } else if (lowercaseMsg.includes("shortcuts")) {
      helpType = 'shortcuts';
    } else if (lowercaseMsg.includes("admin") || lowercaseMsg.includes("host") || lowercaseMsg.includes("user") || lowercaseMsg.includes("system") || lowercaseMsg.includes("functions") || lowercaseMsg.includes("commands")) {
      helpType = 'adminhost';
    }

    return {
      isValid: true,
      msg_subject: 'help',
      msg_criteria: helpType,
  };
  }


  let bestMatchingTopic = await findBestMatchingTopic(lowercaseMsg, weatherTopics);
  debugLog(`Best matching topic: ${bestMatchingTopic}`);

  if (bestMatchingTopic == undefined || bestMatchingTopic == null) {
    // double check for special temp short hand that word compare won't catch
    let special_match = (lowercaseMsg === "?" || 
      lowercaseMsg.match("\\?\\<\\s*(\\d+)") || 
        lowercaseMsg.match("^\\<\\s*(\\d+)") || 
        lowercaseMsg.match("^\\>\\s*(\\d+)") || 
      lowercaseMsg.match("\\?\\>\\s*(\\d+)")    );

      debugLog('regex <35...' + lowercaseMsg.match("^\\<\\s*(\\d+)"))

    if (special_match) {
      debugLog("found special_match, setting topic")
      bestMatchingTopic = 'topic_temps';
    }
  }

  let msg_subject = "unknown";
  let msg_criteria = msg_subject;
  let ret_isValid = false;
  let ret_qualifiedParameter = undefined;
  let ret_inValidReason = "Couldn't determine weather subject. Please try rephrasing your request, using different key words.  ex. 'rain?' or 'weather saturday?' or 'cool temps?'"

  let eval_result = {
    isValid: ret_isValid,
    msg_subject: "unknown",
    msg_criteria: msg_subject,
    qualifiedParameter: undefined,
    inValidReason: ret_inValidReason
  };

  // Evaluate the result with a switch statement
  switch (bestMatchingTopic) {
    case 'topic_hostFunctions':
      console.log("The topic is related to hostFunctions.");
      if (wxChatUser.chattyType === "host" || wxChatUser.chattyType === "admin") {
        console.log(`User is a ${wxChatUser.chattyType}, processing host/admin functions`);
        // Process host-specific commands
        for (const criteria of weatherTopics.topic_hostFunctions.specificCriteria) {
          const regex = new RegExp(criteria.regex, 'i');
          const match = lowercaseMsg.match(regex);
          debugLog("match=" + JSON.stringify(match));
          if (match) {
            ret_isValid = true;
            msg_subject = 'hostfunction';
            msg_criteria = criteria.label;
            ret_qualifiedParameter = criteria.parameter;

              // If there's a captured group, add it to the parameter
                if (criteria.parameter.action === "userStatus") {
                  if (match[1]) {
                    ret_qualifiedParameter.userID = parseFloat(match[1]);
                  }
                  if (match[2]) {
                    ret_qualifiedParameter.reason = match[2];
                  } else {
                    ret_qualifiedParameter.reason = "No reason provided";
                  }
                } else if (criteria.parameter.action === "changeGroup") {
                  if (match[1]) {
                    ret_qualifiedParameter.userID = parseFloat(match[1]);
                  }
                }

            break;
          }
        }

      } else {
        console.log("user is not a host, setting ret_isValid to false");
        ret_isValid = false;
        ret_inValidReason = "You don't have permission to perform this action.";
      }
      eval_result = {
        isValid: ret_isValid,
        msg_subject,
        msg_criteria: msg_criteria,
        qualifiedParameter: ret_qualifiedParameter,
        inValidReason: ret_isValid ? '' : ret_inValidReason
      };
      break;
     
    case 'topic_location':
      debugLog("The topic is related to location.");
      // Add your logic for location here
      ret_isValid = false;
      ret_qualifiedParameter = undefined;
      ret_inValidReason = '';
      msg_subject = 'location'
      
      // Check for specific location criteria
      for (const criteria of weatherTopics.topic_location.specificCriteria) {
        const regex = new RegExp(criteria.regex, 'i');
        const match = lowercaseMsg.match(regex);
        if (match) {debugLog("in forloop...match="+match[1]); }
        
        if (match) {
          ret_isValid = true;
          debugLog("in forloop...ret_isValid="+ret_isValid);
          ret_qualifiedParameter = criteria.parameter;
          msg_criteria = criteria.label
      
          // If there's a captured group, process it
          if (match[1]) {
            // Check if it's a GPS coordinate
            if (ret_qualifiedParameter.startsWith("loc-gps:")) {
            // For GPS, we need to capture both coordinates
            if (match[2]) {
              ret_qualifiedParameter += match[1] + "," + match[2];
              } else {
              console.warn("GPS coordinate is incomplete. Missing longitude.");
              ret_qualifiedParameter += match[1];
              }
            } else {
            // For non-GPS parameters, just add the first captured group
            ret_qualifiedParameter += match[1];
            }
          }      
          break;
        }
      }

      ret_isValid = true;
      eval_result = {
        isValid: ret_isValid,
        msg_subject,
        msg_criteria: msg_criteria,
        qualifiedParameter: ret_qualifiedParameter,
        inValidReason: ret_isValid ? '' : ret_inValidReason
      };
      
      break;

      case 'topic_badWeather':
        debugLog("The topic is related to badWeather.");
      // Add your logic for badWeather here
      ret_isValid = false;
      ret_qualifiedParameter = undefined;
      ret_inValidReason = '';
      msg_subject = 'badWeather'
      

      // pass the list of bad weather words to search for in wxfData forecasts
        ret_isValid = true;
        ret_qualifiedParameter = weatherTopics.topic_badWeather.specificCriteria[0].parameter; 
        debugLog("bad words list: " + ret_qualifiedParameter)
     
      eval_result = {
        isValid: ret_isValid,
        msg_subject,
        msg_criteria: "bad weather",
        qualifiedParameter: ret_qualifiedParameter,
        inValidReason: ret_isValid ? '' : ret_inValidReason
      };
      
      break;
      
    case 'topic_wxAlerts':
      debugLog("The topic is related to wxAlerts.");
      // Add your logic for wxAlerts here
      ret_isValid = false;
      ret_qualifiedParameter = undefined;
      ret_inValidReason = '';
      msg_subject = 'wxAlerts'
      
      
      // Check for any active weather advisories
      ret_isValid = true;
      ret_qualifiedParameter = ""; 
  
      eval_result = {
        isValid: ret_isValid,
        msg_subject,
        msg_criteria: "active Alerts",
        qualifiedParameter: ret_qualifiedParameter,
        inValidReason: ret_isValid ? '' : ret_inValidReason
      };
      
      break;
      
    case 'topic_temps':
      debugLog("The topic is related to temp.");
      // Add your logic for temp here
      ret_isValid = false;
      ret_qualifiedParameter = undefined;
      ret_inValidReason = '';
      msg_subject = 'temp'
      
      // Check for specific temp criteria
      for (const criteria of weatherTopics.topic_temps.specificCriteria) {
        const regex = new RegExp(criteria.regex, 'i');
        const match = lowercaseMsg.match(regex);
        if (match) {debugLog("in forloop...match="+match[1]); }
        
        if (match) {
          ret_isValid = true;
          debugLog("in forloop...ret_isValid="+JSON.stringify(match));
          ret_qualifiedParameter = criteria.parameter;
          msg_criteria = criteria.label
      
          // If there's a captured group (temp), add it to the parameter
          if (match[1]) {
            ret_qualifiedParameter += match[1];
          }
      
          break;
        }
      }

      ret_isValid = true;
      eval_result = {
        isValid: ret_isValid,
        msg_subject,
        msg_criteria: msg_criteria,
        qualifiedParameter: ret_qualifiedParameter,
        inValidReason: ret_isValid ? '' : ret_inValidReason
      };
      
      break;
      
    case 'topic_rain':
      debugLog("The topic is related to rain.");
      // Add your logic for rain here
      ret_isValid = false;
      ret_qualifiedParameter = undefined;
      ret_inValidReason = '';
      msg_subject = 'rain'

      // Check for specific rain criteria
      for (const criteria of weatherTopics.topic_rain.specificCriteria) {
        const regex = new RegExp(criteria.regex, 'i');
        const match = lowercaseMsg.match(regex);

        if (match) {
          ret_isValid = true;
          ret_qualifiedParameter = criteria.parameter;
          msg_criteria = criteria.label

          // If there's a captured group (percentage), add it to the parameter
          if (match[1]) {
            ret_qualifiedParameter += match[1];
          }

          break;
        }
      }

      // If no specific criteria matched, check for general rain mention
      if (!ret_isValid && weatherTopics.topic_rain.generalWords.some(word => lowercaseMsg.includes(word))) {
        ret_isValid = true;
        ret_qualifiedParameter = 'r>0'; // Default to any chance of rain
      }

      eval_result = {
        isValid: ret_isValid,
        msg_subject,
        msg_criteria : msg_criteria ,
        qualifiedParameter: ret_qualifiedParameter,
        inValidReason: ret_isValid ? '' : ret_inValidReason
      };

      break;
    case 'topic_wind':
      debugLog("The topic is related to wind.");
      // Add your logic for wind here
      ret_isValid = false;
      ret_qualifiedParameter = undefined;
      ret_inValidReason = '';
      msg_subject = 'wind'
      
      // Check for specific wind criteria
      for (const criteria of weatherTopics.topic_wind.specificCriteria) {
        const regex = new RegExp(criteria.regex, 'i');
        const match = lowercaseMsg.match(regex);
      
        if (match) {
          ret_isValid = true;
          ret_qualifiedParameter = criteria.parameter;
          msg_criteria = criteria.label
      
          // If there's a captured group (wind speed), add it to the parameter
          if (match[1]) {
            ret_qualifiedParameter += match[1];
          }
      
          break;
        }
      }
      
      // If no specific criteria matched, check for general wind mention
      if (!ret_isValid && weatherTopics.topic_wind.generalWords.some(word => lowercaseMsg.includes(word))) {
        ret_isValid = true;
        ret_qualifiedParameter = 'wmin>5'; // Default to any chance of wind
      }
      
      eval_result = {
        isValid: ret_isValid,
        msg_subject,
        msg_criteria : msg_criteria,
        qualifiedParameter: ret_qualifiedParameter,
        inValidReason: ret_isValid ? '' : ret_inValidReason
      };
      
      break;
      
    case 'topic_wxForecasts':
      debugLog("The topic is related to wxForecasts.");
      // Add your logic for wxForecasts here
      ret_isValid = false;
      ret_qualifiedParameter = undefined;
      ret_inValidReason = '';
      msg_subject = 'wxForecasts'
      
      // Check for specific wxForecasts criteria
      for (const criteria of weatherTopics.topic_wxForecasts.specificCriteria) {
        const regex = new RegExp(criteria.regex, 'i');
        const match = lowercaseMsg.match(regex);
      
        if (match) {  // This condition was missing
          ret_isValid = true;
          ret_qualifiedParameter = criteria.parameter;

          // If there's a captured group (search term), add it to the parameter
          if (match[1]) {
            if (ret_qualifiedParameter.action.toLowerCase() === "ndays") {
              debugLog("nDays match:", match);
              ret_qualifiedParameter.numOfDays = parseInt(match[1]);
            } else if (ret_qualifiedParameter.action.toLowerCase() === "search") {
              debugLog("search match:", match);
              ret_qualifiedParameter.searchValue = match[1].trim();
            }
          }

          break;  // This break is now properly inside the if (match) block
        }
      }
      
      // If no specific criteria matched, check for general wxForecasts mention
      if (!ret_isValid && weatherTopics.topic_wxForecasts.generalWords.some(word => lowercaseMsg.includes(word))) {
        ret_isValid = true;
        ret_qualifiedParameter = '';  //just return all forecasts
      }
      
      eval_result = {
        isValid: ret_isValid,
        msg_subject,
        msg_criteria : "Daily Forecasts",
        qualifiedParameter: ret_qualifiedParameter,
        inValidReason: ret_isValid ? '' : ret_inValidReason
      };
      
      break;
      
    default:
      debugLog("The topic is unknown, returned unknown subject message");
      // Add your logic for unknown topics here
      break;
  }  // end of switch statement

  return eval_result;
};



const handleLocationUpdate = async (chat, wxUsers, wxUserId, wxChatUser, qualified_msg) => {
  logFunctionName();

    // Handle location updates - updates to wxUsers should be made here, not in the framework
    if (qualified_msg.msg_subject === 'location' && 
      qualified_msg.isValid && 
      qualified_msg.msg_criteria !== "unknown" && 
      qualified_msg.qualifiedParameter) 
    {
      const [paramType, paramValue] = qualified_msg.qualifiedParameter.split(':');
      let [locationLabel, locationType, locationValue] = ['', '', ''];


      if (['loc-city', 'loc-zip', 'loc-gps', 'loc-label'].includes(paramType))  {

        if (paramType === 'loc-label') {

          locationLabel = paramValue;
          // Use the current location type and value
          //wedebug- wxChatUser = wxUsers[wxUserId];
          locationType = wxChatUser.location.type;
          locationValue = wxChatUser.location.value;

          // Update user's location information
          //wxUsers = await userManagement.updateUserLocation(wxUsers, wxUserId, locationLabel, locationType, locationValue);
          //wedebug- wxChatUser = wxUsers[wxUserId];
          await userManagement.updateUserLocation(wxUsers, wxUserId, wxChatUser, locationLabel, locationType, locationValue);
          const currentLocationInfo = `Your current location is set to: Label=${wxChatUser.location.label} (Location=${wxChatUser.location.value})`;
          await sendMessage(chat, wxChatUser, currentLocationInfo);
        }  //end of if paramType is loc-label
          else {
          // For other location types, use the location value as the label
          locationLabel = paramValue;
          locationType = paramType;
          locationValue = paramValue;

            // Update user's location information
          await userManagement.updateUserLocation(wxUsers, wxUserId, wxChatUser, locationLabel, locationType, locationValue);
          // creates needed provider specific geo data format from user's common reference
          let newGeoData = await wxBotProviderMap.activeProvider.updateProvGeoData(wxChatUser);
          debugLog("newGeoData: " + JSON.stringify(newGeoData, null, 3));

          // Confirm the location update to the user
          const currentLocationInfo = `Your current location is set to: Label=${locationLabel} (Location=${locationValue})`;
          await sendMessage(chat, wxChatUser, currentLocationInfo);

          // prime the weather forecast data cache with this new location id
          let xxx = await wxBotProviderMap.activeProvider.getProvForecastData(wxChatUser);

          // get the polygon URL
          let polyURL = await wxBotProviderMap.activeProvider.getProvPolyMapURL (wxChatUser);
          debugLog("polyURL: " + JSON.stringify(polyURL, null, 3));
          
    
          // update the geoData with the polyURL
          wxBotProviderMap.activeProvider.provGeoData.find(loc => loc.geoID === locationValue).polyMapURL = polyURL;

        } //end of else paramType is not loc-label
        
        // things were updated, log the wxChatUser
        debugLog("wxChatUser: " + JSON.stringify(wxChatUser, null, 3));
      } else if (wxChatUser.locationValue) {
        // If no valid parameter but a location is set, send current location info
        const currentLocationInfo = `Your current location is set to: Label=${wxChatUser.location.label} (Location=${wxChatUser.location.value})`;
        await sendMessage(chat, wxChatUser, currentLocationInfo);
        } else {
          // If no valid parameter and no location is set
          await sendMessage(chat, wxChatUser, "No location is currently set. Please provide a valid location.");
        }

     return;
   } else if (qualified_msg.msg_subject === 'location' && qualified_msg.isValid && qualified_msg.msg_criteria == "unknown") 
      {
        if (wxChatUser.location) { 
          debugLog("wxChatUser.location: " + JSON.stringify(wxChatUser.location, null, 3));
          // If no valid parameter but a location is set, send current location info
        const currentLocationInfo = `Your current location is set to: Label=${wxChatUser.location.label} (Location=${wxChatUser.location.value})`;
        await sendMessage(chat, wxChatUser, currentLocationInfo);
        return;
      } 
      else {
        debugLog("No location is set...");
        const currentLocationInfo = "No location is set...\n"+HELP_LOCATION_MSG
        await sendMessage(chat, wxChatUser, currentLocationInfo);
        return;
      } //end of else no location is set

    }  //end of location related activity

  return;
} //end of handleLocationUpdate










const processUserRequest = async (wxData, qualMsg) => {
  logFunctionName();
  debugLog("wxData= " + JSON.stringify(wxData, null, 3) + " qualMsg= " + JSON.stringify(qualMsg, null, 3));
  let formattedData = [];

  switch (qualMsg.msg_subject.toLowerCase()) {
    case 'rain':
      formattedData = await formatRainData(wxData, qualMsg);
      break;
    case 'wind':
      formattedData = await formatWindData(wxData, qualMsg);
      break;
    case 'temp':
      formattedData = await formatTempData(wxData, qualMsg);
      break;
    case 'wxforecasts':
      formattedData = await formatSearchData(wxData, qualMsg);
      break;
    case 'badweather':
      formattedData = await formatBadWeatherData(wxData, qualMsg);
      break;
    case 'wxalerts':
      formattedData = await formatWeatherAlerts(wxData, qualMsg);
      break;
    default:
      formattedData.push("I'm sorry, I don't know how to process that type of weather data.");
  }

  return formattedData;
};


const formatRainData = async (wxData, qualMsg) => {
  logFunctionName();
  let formattedData = [];

  // Extract the comparison operator and value from qualifiedParameter
  const match = qualMsg.qualifiedParameter.match(/r([<>])(\d+)/);
  if (!match) {
    formattedData.push("Invalid rain parameter format. Please use 'r>X' or 'r<X' where X is a percentage.");
    return formattedData;
  }

  const [, operator, value] = match;
  const threshold = parseInt(value);

  wxData.wxfPeriod.forEach(period => {
    const rainProbability = period.refRainPrecip;
    let meetsCondition = false;

    if (operator === '>' && rainProbability > threshold) {
      meetsCondition = true;
    } else if (operator === '<' && rainProbability < threshold) {
      meetsCondition = true;
    }
    
    if (meetsCondition) {
      const formattedString = `${chatTeal(period.refDayName)}: ${chatYellow(`${rainProbability}% chance of rain`)}. ${period.wxfDescr}`;
      formattedData.push(cleanupString(formattedString));
    }
  });

  if (formattedData.length === 0) {
    formattedData.push(`No periods found with rain probability ${operator} ${threshold}%.`);
  }

  return formattedData;
};


const formatWindData = async (wxData, qualMsg) => {
  logFunctionName();
  let formattedData = [];

  // Extract the comparison operator and value from qualifiedParameter
  const match = qualMsg.qualifiedParameter.match(/(wmin|wmax|gmin)([<>])(\d+)/);
  if (!match) {
    formattedData.push("Invalid wind parameter format. Please use 'wmin>X', 'wmin<X', 'wmax>X', 'wmax<X', or 'gmin>X' where X is in mph.");
    return formattedData;
  }

  const [, paramType, operator, value] = match;
  const threshold = parseInt(value);

  wxData.wxfPeriod.forEach(period => {
    const windSpeed = period.refWindSpeed;
    const gustSpeed = period.refGustSpeedMax;
    let meetsCondition = false;

    switch(paramType) {
      case 'wmin':
        if (operator === '>') {
          meetsCondition = (windSpeed > threshold || gustSpeed > threshold);
        } else if (operator === '<') {
          meetsCondition = (windSpeed < threshold && gustSpeed < threshold);
        }
        break;
      case 'wmax':
        if (operator === '>') {
          meetsCondition = (windSpeed > threshold || gustSpeed > threshold);
        } else if (operator === '<') {
          meetsCondition = (windSpeed < threshold && gustSpeed < threshold);
        }
        break;
      case 'gmin':
        if (operator === '>') {
          meetsCondition = (gustSpeed > threshold);
        }
        break;
    }

    if (meetsCondition) {
      let windInfo = `Wind: ${windSpeed} mph`;
      if (gustSpeed > 0 && gustSpeed !== windSpeed) {
        windInfo += `, gusts up to ${gustSpeed} mph`;
      }
      const formattedString = `${chatTeal(period.refDayName)}: ${chatYellow(windInfo)}. ${period.wxfDescr}`;
      formattedData.push(cleanupString(formattedString));
    }
  });

  if (formattedData.length === 0) {
    formattedData.push(`No periods found with ${paramType === 'gmin' ? 'gust' : 'wind'} speeds ${operator} ${threshold} mph.`);
  }

  return formattedData;
};

const formatTempData = async (wxData, qualMsg) => {
  logFunctionName();
  let formattedData = [];

  // Extract the comparison operator and value from qualifiedParameter
  const match = qualMsg.qualifiedParameter.match(/(hilo|hi|lo)([<>])(\d+)/);
  if (!match) {
    formattedData.push("Invalid temperature parameter format. Please use 'hilo<>X' or 'hi<>X' or 'lo<>X' where X is a temperature.");
    return formattedData;
  }

  const [, tempType, operator, value] = match;
  const threshold = parseInt(value);

  wxData.wxfPeriod.forEach(period => {
    const temp = period.wxfTemp;
    let meetsCondition = false;

    switch(tempType) {
      case 'hilo':
        meetsCondition = (operator === '>' && temp > threshold) || (operator === '<' && temp < threshold);
        break;
      case 'hi':
        meetsCondition = period.wxfIsDaytime && ((operator === '>' && temp > threshold) || (operator === '<' && temp < threshold));
        break;
      case 'lo':
        meetsCondition = !period.wxfIsDaytime && ((operator === '>' && temp > threshold) || (operator === '<' && temp < threshold));
        break;
    }

    if (meetsCondition) {
      const tempInfo = `${period.wxfIsDaytime ? 'High' : 'Low'}: ${temp}°F`;
      const formattedString = `${chatTeal(period.refDayName)}: ${chatYellow(tempInfo)}. ${period.wxfDescr}`;
      formattedData.push(cleanupString(formattedString));
    }
  });

  if (formattedData.length === 0) {
    formattedData.push(`No periods found with ${tempType === 'hilo' ? 'temperatures' : tempType === 'hi' ? 'high temperatures' : 'low temperatures'} ${operator} ${threshold}°F.`);
  }

  return formattedData;
};



const formatBadWeatherData = async (wxData, qualMsg) => {
  logFunctionName();
  let formattedData = [];

  // Assuming qualMsg.qualifiedParameter contains the array of words to highlight
  const wordsToHighlight = qualMsg.qualifiedParameter || [];

  for (const period of wxData.wxfPeriod) {
    if (period.refBadFlag === true) {
      // Format the period
      let formattedPeriod = await formatPeriod(period);

      // Highlight specific words in the description
      wordsToHighlight.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        formattedPeriod = formattedPeriod.replace(regex, match => chatYellow(match));
      });

      formattedData.push(formattedPeriod);
    }
  }

  if (formattedData.length === 0) {
    formattedData.push("No periods with bad weather found in the forecast.");
  }

  return formattedData;
}


const formatWeatherAlerts = async (wxaData, qualMsg) => {
  logFunctionName();
  let formattedData = [];

  // Iterate over each alert in wxaData
  wxaData.forEach(alert => {
    // Check if this alert should be reported
    if (alert.doReport === true) {
      // If so, push its formatted message to formattedData
      formattedData.push(alert.formatted);
    }
  });

  // If no alerts were added to formattedData, add the "Good news" message
  if (formattedData.length === 0) {
    formattedData.push("Good news! No active location alerts found.");
  }

  return formattedData;
}



const formatSearchData = async (wxData, qualMsg) => {
  logFunctionName();
  let formattedData = [];

  // Parse the qualifiedParameter as a JSON object
  let params;
  if (typeof qualMsg.qualifiedParameter === 'string') {
    try {
      params = JSON.parse(qualMsg.qualifiedParameter);
    } catch (error) {
      console.error("Error parsing qualifiedParameter:", error);
      params = {}; // Set a default empty object
    }
  } else if (typeof qualMsg.qualifiedParameter === 'object' && qualMsg.qualifiedParameter !== null) {
    params = qualMsg.qualifiedParameter;
  } else {
    console.error("Invalid qualifiedParameter type:", typeof qualMsg.qualifiedParameter);
    params = {}; // Set a default empty object
  }

  // Now you can use params safely
  debugLog("Parsed params:", params);

  switch (params.action) {
    case 'nDays':
      formattedData = await handleNumOfDaysCriteria(wxData, params.numOfDays);
      break;
    case 'day':
      formattedData = await handleDayCriteria(wxData, params.dayValue);
      break;
    case 'search':
      formattedData = await handleSearchCriteria(wxData, params.searchValue);
      break;
    case "today":
      // Always include the first period (index 0)
      formattedData.push(await formatPeriod(wxData.wxfPeriod[0]));
      
      // Check if there's a second period and if it's nighttime
      if (wxData.wxfPeriod.length > 1 && !wxData.wxfPeriod[1].wxfIsDaytime) {
        formattedData.push(await formatPeriod(wxData.wxfPeriod[1]));
      }
      break;
      case "tonight":
        let tonightPeriod;
        if (!wxData.wxfPeriod[0].wxfIsDaytime) {
          // If the first period is nighttime, use it
          tonightPeriod = wxData.wxfPeriod[0];
        } else if (wxData.wxfPeriod.length > 1 && !wxData.wxfPeriod[1].wxfIsDaytime) {
          // If the second period exists and is nighttime, use it
          tonightPeriod = wxData.wxfPeriod[1];
        }
      
        if (tonightPeriod) {
          formattedData.push(await formatPeriod(tonightPeriod));
        } else {
          formattedData.push("No nighttime forecast available for tonight.");
        }
        break;
    case "tomorrow":
      // Get the next day period and the following night period
      const tomorrowDayIndex = wxData.wxfPeriod.findIndex((period, index) => index > 0 && period.wxfIsDaytime);
      if (tomorrowDayIndex !== -1) {
        formattedData.push(await formatPeriod(wxData.wxfPeriod[tomorrowDayIndex]));
        if (tomorrowDayIndex + 1 < wxData.wxfPeriod.length) {
          formattedData.push(await formatPeriod(wxData.wxfPeriod[tomorrowDayIndex + 1]));
        }
      }
        break;
    default:
      formattedData.push("Invalid search criteria");
  }

  if (formattedData.length === 0) {
    formattedData.push("No matching forecast periods found.");
  }

  return formattedData;
};



// Helper function to format a single period
const formatPeriod = async (period) => {
  return await cleanupString(`${chatTeal(period.refDayName)}: ${period.wxfDescr}`);
};



const handleNumOfDaysCriteria = async (wxData, numOfDays) => {
  logFunctionName();
  const startIndex = 0;
  let endIndex = Math.min(startIndex + numOfDays * 2, wxData.wxfPeriod.length);

  // Check if the last period is a daytime period
  if (endIndex < wxData.wxfPeriod.length && wxData.wxfPeriod[endIndex - 1].wxfIsDaytime) {
    // If so, include the next period (night period)
    endIndex = Math.min(endIndex + 1, wxData.wxfPeriod.length);
  }

  const selectedPeriods = wxData.wxfPeriod.slice(startIndex, endIndex);

  const formattedData = [];
  for (const period of selectedPeriods) {
    formattedData.push(await formatPeriod(period));
  }

  return formattedData;
}

const handleDayCriteria = async (wxData, dayValue) => {
  logFunctionName();
  const filteredPeriods = wxData.wxfPeriod.filter(period => {
    if (dayValue.toLowerCase() === 'wknd') {
      return ['Saturday', 'Sunday'].includes(period.refDOW);
    } else {
      return period.refDOW.toLowerCase().startsWith(dayValue.toLowerCase()) || 
             period.refDOW_int.toString() === dayValue;
    }
  });

  const formattedData = [];
  for (const period of filteredPeriods) {
    formattedData.push(await formatPeriod(period));
  }

  return formattedData;
}

const handleSearchCriteria = async (wxData, searchValue) => {
  logFunctionName();

  const searchTerm = searchValue.toLowerCase();
  const filteredPeriods = wxData.wxfPeriod.filter(period => 
    period.wxfDescr.toLowerCase().includes(searchTerm)
  );

  const formattedData = [];
  for (const period of filteredPeriods) {
    formattedData.push(await formatPeriod(period));
  }

  return formattedData;
}



const formatUnfilteredTempData = async (wxData) => {
  let formattedData = [];
  let currentDay = null;

  for (let i = 0; i < wxData.wxfPeriod.length; i++) {
    const period = wxData.wxfPeriod[i];
    
    if (period.wxfIsDaytime) {
      currentDay = {
        name: period.refDayName,
        highTemp: period.wxfTemp,
        lowTemp: null
      };
      
      // Look ahead for the nighttime temperature
      if (i + 1 < wxData.wxfPeriod.length && !wxData.wxfPeriod[i + 1].wxfIsDaytime) {
        currentDay.lowTemp = wxData.wxfPeriod[i + 1].wxfTemp;
      }

      // Format the string with color coding
      let formattedString = `${chatTeal(currentDay.name)} (hi: `;
      
      // Add color to high temperature if it exceeds tempHot
      if (currentDay.highTemp > tempHot) {
        formattedString += chatYellow(`${currentDay.highTemp}°`);
      } else {
        formattedString += `${currentDay.highTemp}°`;
      }

      if (currentDay.lowTemp !== null) {
        formattedString += `, night: `;
        // Add color to low temperature if it's below tempCold
        if (currentDay.lowTemp < tempCold) {
          formattedString += chatBlue(`${currentDay.lowTemp}°`);
        } else {
          formattedString += `${currentDay.lowTemp}°`;
        }
      }
      formattedString += ')';
      
      formattedData.push(cleanupString(formattedString));

    }
  }

  return formattedData;
};

const formatUnfilteredForecastData = async (wxData) => {
  logFunctionName();

  let formattedData = [];

  for (let i = 0; i < wxData.wxfPeriod.length; i++) {
    const period = wxData.wxfPeriod[i];
    
    // Format the string
    let formattedString = `${chatTeal(period.refDayName)}: ${period.wxfDescr}`;
    formattedData.push(cleanupString(formattedString));

  }

  return formattedData;
}; // end of formatUnfilteredForecastData



const handleWeatherAlerts = async (chat,wxChatUser, qualified_msg) => {
  logFunctionName();
        // Handle weather alerts requests
        if (qualified_msg.msg_subject.toLowerCase() === 'wxalerts' && qualified_msg.isValid) {
          const wxaUserData = await wxBotProviderMap.activeProvider.getwxAlertsData(wxChatUser);

          if (wxaUserData.isValid) {
            let formattedResponse = [];

            // Default formatting for alerts
            debugLog("Default formatting for alerts")
            formattedResponse = await processUserRequest(wxaUserData.wxaData, qualified_msg);
        
      
            preMsg = "Weather for " + chatTeal(wxChatUser.location.label) + ((wxChatUser.location.label !== wxChatUser.location.value) ? 
              "(" + wxChatUser.location.value + ")" : "") ;

            await sendChats(chat, wxChatUser, formattedResponse, cleanupString(preMsg));
            
            // provider returned invalid dataset for some reason
          } else {
            preMsg = `Your current location is set to: Label=${wxChatUser.location.label} (Location=${wxChatUser.location.value})`;
            await sendMessage(chat, wxChatUser, "I'm sorry, I couldn't retrieve the weather alert data for your location.", preMsg);
            }

        }  //end of weather alerts related activity
        return;
} //end of handleWeatherAlerts



const handleWeatherForecast = async (chat,wxChatUser, qualified_msg) => {
  logFunctionName();
        // Handle weather forecast requests
        if (['temp', 'rain', 'wind', 'badweather', 'wxforecasts'].includes(qualified_msg.msg_subject.toLowerCase()) && qualified_msg.isValid) {
          const userLocation = wxChatUser.location;

          if (!userLocation) {
            await sendMessage(chat, wxChatUser, "Please set your location first before requesting weather information.");
            return;  //exits switch and exits function
          }
   
          //const wxfUserData = await wxBotProviderMap.activeProvider[`get${qualified_msg.msg_subject.charAt(0).toUpperCase() + qualified_msg.msg_subject.slice(1)}Data`](wxChatUser, qualified_msg.qualifiedParameter);
          const wxfUserData = await wxBotProviderMap.activeProvider.getProvForecastData(wxChatUser);


          if (wxfUserData.isValid) {
            let formattedResponse = [];
            // New logic block for formatting temp and wxforecasts data
            if ((qualified_msg.msg_subject.toLowerCase() === 'temp' || qualified_msg.msg_subject.toLowerCase() === 'wxforecasts') && 
              (qualified_msg.qualifiedParameter === undefined || 
              qualified_msg.qualifiedParameter === null || 
              qualified_msg.qualifiedParameter === '')) {
          
                if (qualified_msg.msg_subject.toLowerCase() === 'temp') {
                  formattedResponse = await formatUnfilteredTempData(wxfUserData.wxfData);
                } else if (qualified_msg.msg_subject.toLowerCase() === 'wxforecasts') {
                  formattedResponse = await formatUnfilteredForecastData(wxfUserData.wxfData);
                }
                } else {
                  // Default formatting for other subjects or when qualifiedParameter is not empty
                  debugLog("Default formatting for other subjects or when qualifiedParameter is not empty")
                  formattedResponse = await processUserRequest(wxfUserData.wxfData, qualified_msg);
                  //formattedResponse = formatWeatherData(wxfUserData.wxfData, qualified_msg.msg_subject.toLowerCase());
                  }
      
                preMsg = "Weather for " + chatTeal(wxChatUser.location.label) + ((wxChatUser.location.label !== wxChatUser.location.value) ? 
                  "(" + wxChatUser.location.value + ")" : "") ;

                await sendChats(chat, wxChatUser, formattedResponse, cleanupString(preMsg));

                debugLog("wxfUserData.wxfData: " + JSON.stringify(wxfUserData.wxfData, null, 3));
                
              
            // provider returned invalid dataset for some reason
          } else {
            preMsg = `Your current location is set to: Label=${wxChatUser.location.label} (Location=${wxChatUser.location.value})`;
            await sendMessage(chat, wxChatUser, "I'm sorry, I couldn't retrieve the weather data for your location.", preMsg);
            }
    
        } else if (!qualified_msg.isValid) {
            await sendMessage(chat, wxChatUser, qualified_msg.inValidReason || "I'm sorry, I didn't understand that request.");
          }
          return;
        } //end of handleWeatherForecast
        










const handleHelpRequest = async (chat, wxChatUser, qualified_msg) => {
  debugLog("in handleHelpRequest function....qualified_msg= " + JSON.stringify(qualified_msg, null, 3));
    // Handle help requests
    if (qualified_msg.msg_subject === 'help' && qualified_msg.isValid) {
      if (qualified_msg.msg_criteria === 'examples') {
        await sendMessage(chat, wxChatUser, HELP_EXAMPLES_MSG);
      } else if (qualified_msg.msg_criteria === 'location') {
        await sendMessage(chat, wxChatUser, HELP_LOCATION_MSG);
      } else if (qualified_msg.msg_criteria === 'shortcuts') {
        await sendMessage(chat, wxChatUser, HELP_SHORTCUTS_MSG);
      } else if (qualified_msg.msg_criteria === 'adminhost' && (wxChatUser.chattyType === "host" || wxChatUser.chattyType === "admin")) {
        await sendMessage(chat, wxChatUser, HELP_ADMINHOST_MSG);
      } else {
      await sendMessage(chat, wxChatUser, "Lets's start from the beginning...\n\n"+WELCOME_MSG);
      }
      return;
    }
  }


async function adminListUsers(chat, wxUsers, wxChatUser, qualified_msg) {
  logFunctionName();
  let userList = [];

  for (const userId in wxUsers) {
    const user = wxUsers[userId];
    const userInfo = `User ID: ${user.wxUserId}, ` +
                     `Type: ${user.chattyType}, ` +
                     `Name: ${user.displayName}, ` +
                     `Location: ${user.location.label} (${user.location.value}), ` +
                     `Status: ${user.isDisabled ? 'Disabled' : 'Enabled'}` +
                     `${user.isDisabled ? ', Reason: ' + user.disabledReason : ''}`;
    userList.push({ info: userInfo, user: user });
  }

  // Sort the userList by isDisabled (disabled first), then by chattyType, then by displayName
  userList.sort((a, b) => {
    if (a.user.isDisabled !== b.user.isDisabled) {
      return b.user.isDisabled ? -1 : 1; // Disabled users first
    }
    if (a.user.chattyType !== b.user.chattyType) {
      return a.user.chattyType.localeCompare(b.user.chattyType);
    }
    return a.user.displayName.toLowerCase().localeCompare(b.user.displayName.toLowerCase());
  });

  // Extract just the info strings after sorting
  const sortedInfoList = userList.map(item => item.info);

  // Add headers to group the users
  let formattedList = ["User List:"];
  let currentStatus = null;
  let currentType = null;

  sortedInfoList.forEach(info => {
    const status = info.includes("Status: Disabled") ? "Disabled" : "Enabled";
    const type = info.split("Type: ")[1].split(",")[0];

    if (status !== currentStatus) {
      formattedList.push(`\n${status} Users:`);
      currentStatus = status;
      currentType = null;
    }

    if (type !== currentType) {
      formattedList.push(`\n  ${type}:`);
      currentType = type;
    }

    formattedList.push(`    ${info}`);
  });

  // Call sendChats to send the user list
  await sendChats(chat, wxChatUser, formattedList);
}






  async function handleHostFunction(chat, wxUsers, wxChatUser, qualified_msg) {
    logFunctionName();
    const { action, secLevel, ...params } = qualified_msg.qualifiedParameter;
    const lowerCaseAction = action.toLowerCase();
    debugLog("in handleHostFunction function at beginning....lowerCaseAction= " + JSON.stringify(qualified_msg, null, 3));

    // Security check
    let hasPermission = false;
    if (secLevel === "admin") {
      hasPermission = wxChatUser.chattyType === "host" || wxChatUser.chattyType === "admin";
    } else if (secLevel === "host") {
      hasPermission = wxChatUser.chattyType === "host";
    }

    if (!hasPermission) {
      debugLog("in handleHostFunction function....hasPermission= " + hasPermission);
      debugLog("in handleHostFunction function....wxChatUser.chattyType= " + wxChatUser.chattyType);
      await sendMessage(chat, wxChatUser, "You don't have permission to perform this action.");
      return;
    }

    debugLog(`User is a ${wxChatUser.chattyType}, processing ${secLevel} function: ${lowerCaseAction}`);


    switch (lowerCaseAction) {
      case 'adduser':
        // Implement add user logic
        break;
      case 'removeuser':
        // Implement remove user logic
        break;
      case 'userstatus':
        // Implement enable user logic
        debugLog("in handleHostFunction case userstatus");
        await adminUserStatus(chat, wxUsers, wxChatUser, qualified_msg);
        break;
      case 'changegroup':
        // Implement disable user logic
        debugLog("in handleHostFunction case changegroup");
        await hostChangeGroup(chat, wxUsers, wxChatUser, qualified_msg);
        break;
      case 'listusers':
        // Implement list users logic
        debugLog("in handleHostFunction case listusers");
        await adminListUsers(chat, wxUsers, wxChatUser, qualified_msg);
        break;
      case 'updatevariable':
        // Implement update variable logic
        break;
      case 'listvariables':
        // Implement list variables logic
        break;
      // Add cases for other host functions as needed
      default:
        await sendMessage(chat, wxChatUser, "Unknown host function.");
    }
    return;
  }

const adminUserStatus = async (chat, wxUsers, wxChatUser, qualified_msg) => {
  logFunctionName();
  const { action, secLevel, ...params } = qualified_msg.qualifiedParameter;
  const lowerCaseAction = action.toLowerCase();
  debugLog("in adminUserStatus function....lowerCaseAction= " + lowerCaseAction);
  if (lowerCaseAction === 'userstatus') {
    if (params.status === 'enable') {
      debugLog("in adminUserStatus function....params.status= " + params.status);
      await userManagement.enableUser(wxUsers, params.userID);
    } else if (params.status === 'disable') {
      debugLog("in adminUserStatus function....params.status= " + params.status);
      await userManagement.disableUser(wxUsers, params.userID, params.reason);
    }
  }


  return;
}



const hostChangeGroup = async (chat, wxUsers, wxChatUser, qualified_msg) => {
  logFunctionName();
  const { action, secLevel, ...params } = qualified_msg.qualifiedParameter;
  const lowerCaseAction = action.toLowerCase();
  debugLog("in hostChangeGroup function....lowerCaseAction= " + lowerCaseAction);
  await userManagement.setUserGroup (wxUsers, params.userID, params.group);


  return;
}



const sendMessage = async (chat, wxChatUser, message, preMsg = null) => {
  if (preMsg) {
    await chat.apiSendTextMessage(
      wxChatUser.apiSendInfo.Type, 
      wxChatUser.apiSendInfo.ID,
      preMsg
    );
  }
  await chat.apiSendTextMessage(
    wxChatUser.apiSendInfo.Type, 
    wxChatUser.apiSendInfo.ID,
    message
  );
}



const sendChats = async (chat, wxChatUser, arr, preMsg = null) => {
  debugLog("in sendChats function....");
  debugLog("arr length= " + arr.length);

  if (preMsg) {
    await chat.apiSendTextMessage(
      wxChatUser.apiSendInfo.Type, 
      wxChatUser.apiSendInfo.ID,
      preMsg
    );
  }

  if (arr.length == 0) {
    await chat.apiSendTextMessage(
      wxChatUser.apiSendInfo.Type, 
      wxChatUser.apiSendInfo.ID,
      "Sorry, your request found nothing to report, try /h if you need command syntax help"
    );
  } else {
    for (var i = 0; i < arr.length; i++) {
      await chat.apiSendTextMessage(
        wxChatUser.apiSendInfo.Type, 
        wxChatUser.apiSendInfo.ID, 
        arr[i]
      );
    }
  }
  return;
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
  formatRainData,
  formatWindData,
  formatSearchData,
  formatUnfilteredTempData,
  formatUnfilteredForecastData,
  handleLocationUpdate,
  handleWeatherForecast,
  handleWeatherAlerts,
  handleHelpRequest,
  handleHostFunction,
  evaluateMessage,
  sendMessage,
  sendChats
  
};

