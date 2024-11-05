// THIS FILE CONTAINS THE MAP OF THE WEATHER DATA PROVIDERS AND THE FUNCTIONS THAT FETCH THE WEATHER DATA FROM THE PROVIDERS FOR THE BOT FRAMEWORK

// THE PROVIDERS COULD BE:
// 1. weather.gov
// 2. openweathermap.org
// 3. wunderground.com
// 4. accuweather.com
// 5. weatherapi.com
// 6. weatherstack.com
// 7. weatherbit.io

// CURRENTLY IMPLEMENTED PROVIDERS:
// 1. weather.gov
// 2. openweathermap.org
const weatherGov = require("./wx-src-weathergov");
//const openWeatherMap = require("./wx-src-openweathermap");
//const openMeteo = require("./wx-src-openmeteo");

// MAP TOOL:
// https://www.keene.edu/campus/maps/tool/?coordinates=
// concatenate the coordinates (in reverse order) into a string with spaces between the coordinates
// then append to the url
// then open in browser

require('dotenv').config({ path: '../weatherBot.env' });
const IS_DEBUG = process.env.DEBUG_MODE === 'true';

const debugLog = (msg) => {
  if (IS_DEBUG) {
      console.log(msg);
  }
  return;
}

// PROVIDER MAP TEMPLATE:
const wxProviderFunctions = {


  wxfTemplate: [{
    geoID: '', 
    geoType: '',
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
        refBadFlag: {} 
      }
    ]  
  }],

  provGeoData:  weatherGov.provWeatherGov.provGeoData,
  provCacheData: weatherGov.provWeatherGov.provCacheData,



  
  getProvForecastData: async (wxChatUser) => {
    debugLog("getProvForecastsData function called...")
    // Implement logic to get forecast data from the appropriate provider
    let result = false;

    // TODO: ADD LOGIC TO GET TEMPERATURE DATA FROM THE APPROPRIATE PROVIDER
        // Extract location information from wxChatUser
        const userLocation = wxChatUser.location;
        if (!userLocation) {
          debugLog("No location information available for user");
          return null;
        }
    
        const { label, type, value } = userLocation;
        const locLabel = label || `${type}:${value}`; // Use label if available, otherwise construct it
        const locID = value;  // the label can be a user assigned description, but value is the actual location ID of the original location set by the user

        // Check if location already exists in provGeoData
        const existingLocation = wxProviderFunctions.provGeoData.find(loc => loc.geoID === locID);
       
        

    const getWXF_result = await weatherGov.provWeatherGov.getWXF(existingLocation.forecast, false, true);
    if (getWXF_result.isValid) {
      result = true;    // replace with actual logic
      return {isValid: result, wxfData: getWXF_result.wxfData};
    }

    // call the provider specific getData function (ex. weathergov) to get the raw data
    // call the provider specific cleanDatafunction (ex. weathergov) to clean the data to match the template structure
    // return cleaned data
      
    return {isValid: result, wxfData: undefined};
  },
  


  
  getProvPolyMapURL: async (wxChatUser) => {
    debugLog("getProvPolyMapURL function called...")
    let result = false;

        // Extract location information from wxChatUser
        const userLocation = wxChatUser.location;
        if (!userLocation) {
          debugLog("No location information available for user");
          return null;
        }
    
        const { label, type, value } = userLocation;
        const locLabel = label || `${type}:${value}`; // Use label if available, otherwise construct it
        const locID = value;  // the label can be a user assigned description, but value is the actual location ID of the original location set by the user

        // Check if location already exists in provGeoData
        const existingLocation = wxProviderFunctions.provGeoData.find(loc => loc.geoID === locID);

    const getPolyMapURL_result = await weatherGov.provWeatherGov.getPolyMapURL(existingLocation.forecast, true, true);

    if (getPolyMapURL_result.isValid) {
      result = true;    // replace with actual logic
      return {isValid: result, polyURL: getPolyMapURL_result.polyURL};
    }

    // call the provider specific getData function (ex. weathergov) to get the raw data
    // call the provider specific cleanDatafunction (ex. weathergov) to clean the data to match the template structure
    // return cleaned data
      
    return {isValid: result, polyURL: undefined};
  },
  


  
  getwxAlertsData: async (wxChatUser) => {
    // Implement logic to get weather alert data from the appropriate provider
    let result = false;
        // Extract location information from wxChatUser
        const userLocation = wxChatUser.location;
        if (!userLocation) {
          debugLog("No location information available for user");
          return null;
        }
    
        const { label, type, value } = userLocation;
        const locLabel = label || `${type}:${value}`; // Use label if available, otherwise construct it
        const locID = value;  // the label can be a user assigned description, but value is the actual location ID of the original location set by the user

        // Check if location already exists in provGeoData
        const existingLocation = wxProviderFunctions.provGeoData.find(loc => loc.geoID === locID);
       
        
    // call the provider specific cleanDatafunction (ex. weathergov) to clean the data to match the template structure

    const getWXA_result = await weatherGov.provWeatherGov.getWXA(existingLocation.alert, true);
    if (getWXA_result.isValid) {
      result = true;    // replace with actual logic
    // return cleaned data
    return {isValid: result, wxaData: getWXA_result.wxaData};
    }
      
    return {isValid: result, wxaData: undefined};
  },



  createProvGeoLoc: async (wxChatUser) => {
    // Implement logic to convert the user saved location into the appropriate provider specific location
    let result = false;
    
    // TODO: extract the location from the wxChatUser
    let userLocation = wxChatUser.location;
    // TODO: ADD LOGIC TO GET TEMPERATURE DATA FROM THE APPROPRIATE PROVIDER
    let newGeoData = await weatherGov.provWeatherGov.createGeoData (userLocation.label, userLocation.type, userLocation.value) 
  
    debugLog("newGeoData: " + JSON.stringify(newGeoData, null, 3))
  
    // add the newGeoData to the global list of geoData
  
    result = true;    // replace with actual logic
    return {isValid: result};
    },
  

  updateProvGeoData: async function(wxChatUser) {
    // Extract location information from wxChatUser
    const userLocation = wxChatUser.location;
    if (!userLocation) {
      debugLog("No location information available for user");
      return null;
    }

    const { label, type, value } = userLocation;
    const locLabel = label || `${type}:${value}`; // Use label if available, otherwise construct it
    const locID = value;  // the label can be a user assigned description, but value is the actual location ID of the original location set by the user

    // Check if location already exists in provGeoData
    const existingLocation = wxProviderFunctions.provGeoData.find(loc => loc.geoID === locID);
if (existingLocation) {
      debugLog(`Location ${locID} already exists in provGeoData`);
      return existingLocation;
    }

    // If location doesn't exist, create new entry
    try {
      const newGeoData = await weatherGov.provWeatherGov.createGeoData(locLabel, type, value);
      if (newGeoData.isValid) {
        wxProviderFunctions.provGeoData.push(newGeoData.newGeoID);
        console.log(`Added new location ${locLabel} to provGeoData`);
        return newGeoData.newGeoID;
      } else {
        console.log(`Failed to create geo data for ${locLabel}`);
        return null;
      }
    } catch (error) {
      console.error(`Error creating geo data for ${locLabel}:`, error);
      return null;
    }



  }

  

};

// ADDITIONAL PROVIDERS:
// TODO: ADD THE OPENWEATHERMAP PROVIDER MAP ENTRY HERE




// CURRENT ACTIVE PROVIDER:
const activeProvider = wxProviderFunctions;
// TODO: USE TEMPLATE TO ADD PROVIDER MAPPINGS




module.exports = {activeProvider};
