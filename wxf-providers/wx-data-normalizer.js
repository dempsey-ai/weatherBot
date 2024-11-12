const { WX_DATA_TYPES, WX_PERIOD_RESOLUTION } = require('./wx-provider-types')
const badWeatherData = require('../wx-bot-wordlists/bad_weather.json')

// Represents a single day's forecast, potentially containing multiple periods
class WxDay {
  constructor(data) {
    this.date = data.date || new Date()
    this.dayOfWeek = data.dayOfWeek || "Unknown"
    this.summary = {
      high: data.highTemp || 0,
      low: data.lowTemp || 0,
      description: data.description || "No description available",
      precipitation: {
        probability: data.precipProb || 0,
        amount: data.precipAmount || 0
      },
      wind: {
        avgSpeed: data.windSpeed || 0,
        maxGust: data.windGust || 0,
        direction: data.windDir || ""
      }
    }
    this.periods = data.periods || []
    this.flags = {
      isBadWeather: data.isBadWeather || false,
      hasAlerts: data.hasAlerts || false
    }
  }

  // Helper method to get temperature for a specific time
  getTemperature(timeOfDay) {
    if (this.periods.length === 0) {
      return timeOfDay === 'day' ? this.summary.high : this.summary.low
    }
    const period = this.periods.find(p => p.timeOfDay === timeOfDay)
    return period ? period.temperature : null
  }

  // Helper method to get conditions for a specific time
  getConditions(timeOfDay) {
    if (this.periods.length === 0) {
      return this.summary
    }
    const period = this.periods.find(p => p.timeOfDay === timeOfDay)
    return period ? period.conditions : null
  }
}

class WxPeriod {
  constructor(data) {
    this.timeOfDay = data.timeOfDay || 'day'
    this.startTime = data.startTime || new Date().toISOString()
    this.endTime = data.endTime || new Date().toISOString()
    this.temperature = data.temp || 0
    this.conditions = {
      description: data.description || "No description available",
      precipitation: {
        probability: data.precip || 0,
        amount: data.precipAmount || 0
      },
      wind: {
        speed: data.wind?.speed || 0,
        gust: data.wind?.gust || 0,
        direction: data.wind?.direction || ""
      },
      clouds: data.clouds || 0,
      visibility: data.visibility || 0
    }
  }
}

class WxDataNormalizer {
  static normalize(rawData, providerType, periodResolution) {
    switch(providerType) {
      case WX_DATA_TYPES.DAILY:
        return WxDataNormalizer.normalizeDaily(rawData)
      case WX_DATA_TYPES.MULTI_PERIOD:
        return WxDataNormalizer.normalizeMultiPeriod(rawData, periodResolution)
      default:
        throw new Error(`Unknown provider type: ${providerType}`)
    }
  }

  static checkForBadWeather(description) {
    const badWeatherWords = badWeatherData.specificCriteria[0].parameter
    return badWeatherWords.some(word => 
      description.toLowerCase().includes(word.toLowerCase())
    )
  }

  // Add helper method for day name formatting
  static getAdjustedDayName(date, currentDate = new Date()) {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    const dayName = dayNames[date.getDay()]
    
    // Set currentDate to midnight for clean comparison
    currentDate.setHours(0, 0, 0, 0)

    // Calculate the end of the current week (next Saturday)
    const endOfCurrentWeek = new Date(currentDate)
    endOfCurrentWeek.setDate(currentDate.getDate() + (7 - currentDate.getDay()))
    endOfCurrentWeek.setHours(23, 59, 59, 999)

    // Calculate the start of the next week (next Sunday)
    const startOfNextWeek = new Date(endOfCurrentWeek)
    startOfNextWeek.setDate(endOfCurrentWeek.getDate() + 1)
    startOfNextWeek.setHours(0, 0, 0, 0)

    // Calculate the end of the next week (next Saturday after next Sunday)
    const endOfNextWeek = new Date(startOfNextWeek)
    endOfNextWeek.setDate(startOfNextWeek.getDate() + 6)
    endOfNextWeek.setHours(23, 59, 59, 999)

    // If the date is in the current week
    if (date <= endOfCurrentWeek) {
      return dayName
    }

    // If the date is in the next week
    if (date >= startOfNextWeek && date <= endOfNextWeek) {
      return "Next " + dayName
    }

    // For dates beyond the next week, show with date
    return `${dayName} the ${date.getDate()}${this.getDaySuffix(date.getDate())}`
  }

  // Helper function for date suffixes
  static getDaySuffix(day) {
    if (day >= 11 && day <= 13) return 'th'
    switch (day % 10) {
      case 1: return 'st'
      case 2: return 'nd'
      case 3: return 'rd'
      default: return 'th'
    }
  }

  // For providers that give one forecast per day (like weatherbit.io)
  static normalizeDaily(rawData) {
    const description = rawData.weather.description
    const forecastDate = new Date(rawData.valid_date)
    const adjustedDayName = WxDataNormalizer.getAdjustedDayName(forecastDate)

    // Extract time of day from the timestamp
    const hours = new Date(rawData.ts * 1000).getHours()
    const isDaytime = hours >= 6 && hours < 18 // Basic 6am-6pm check

    return new WxDay({
      date: forecastDate,
      dayOfWeek: adjustedDayName,
      highTemp: rawData.high_temp,
      lowTemp: rawData.low_temp,
      description: description,
      precipProb: rawData.pop,
      precipAmount: rawData.precip,
      windSpeed: rawData.wind_spd,
      windGust: rawData.wind_gust_spd, // Use direct gust speed
      windDir: rawData.wind_cdir_full,
      isBadWeather: WxDataNormalizer.checkForBadWeather(description),
      periods: [{
        timeOfDay: 'day',
        startTime: forecastDate.setHours(6, 0, 0, 0),
        endTime: forecastDate.setHours(18, 0, 0, 0),
        temp: rawData.high_temp,
        description: description,
        precip: rawData.pop,
        wind: {
          speed: rawData.wind_spd,
          gust: rawData.wind_gust_spd,
          direction: rawData.wind_cdir_full
        }
      }]
    })
  }

  // For providers with multiple periods per day (like weather.gov)
  static normalizeMultiPeriod(rawData, resolution) {
    console.log('debug- normalizeMultiPeriod - resolution:', resolution)
    const currentDate = new Date()
    
    // Helper function to determine period type based on resolution
    const getPeriodType = (period, resolution) => {
      switch(resolution) {
        case WX_PERIOD_RESOLUTION.TWELVE_HOUR:
          // Use isDaytime flag if available, otherwise use time
          return 'isDaytime' in period ? 
            (period.isDaytime ? 'day' : 'night') :
            (new Date(period.startTime).getHours() >= 6 && 
             new Date(period.startTime).getHours() < 18 ? 'day' : 'night')
        
        case WX_PERIOD_RESOLUTION.HOURLY:
          // For hourly data, store the hour number
          return `hour_${new Date(period.startTime).getHours()}`
        
        default:
          // For unknown resolutions, use timestamp
          return new Date(period.startTime).toISOString()
      }
    }

    // Group periods by day first
    const dayPeriods = rawData.properties.periods.reduce((days, period) => {
      const date = new Date(period.startTime)
      const dayKey = date.toISOString().split('T')[0]
      
      if (!days[dayKey]) {
        days[dayKey] = {
          periods: [],
          high: -Infinity,
          low: Infinity,
          date: date,
          periodResolution: resolution
        }
      }

      // Add period with resolution-specific timeOfDay
      days[dayKey].periods.push(new WxPeriod({
        timeOfDay: getPeriodType(period, resolution),
        startTime: period.startTime,
        endTime: period.endTime,
        temp: period.temperature,
        description: period.detailedForecast || period.description,
        precip: period.probabilityOfPrecipitation?.value ?? 0,
        precipAmount: period.precipAmount ?? 0,
        wind: {
          speed: this.extractWindSpeed(period.windSpeed),
          gust: this.extractGustSpeed(period.detailedForecast),
          direction: period.windDirection
        },
        clouds: period.clouds ?? 0,
        visibility: period.visibility ?? 0
      }))

      // Update high/low based on resolution
      if (resolution === WX_PERIOD_RESOLUTION.TWELVE_HOUR) {
        // For 12-hour, use day/night logic
        if (getPeriodType(period, resolution) === 'day') {
          days[dayKey].high = Math.max(days[dayKey].high, period.temperature)
        } else {
          days[dayKey].low = Math.min(days[dayKey].low, period.temperature)
        }
      } else {
        // For other resolutions, track all temperatures
        days[dayKey].high = Math.max(days[dayKey].high, period.temperature)
        days[dayKey].low = Math.min(days[dayKey].low, period.temperature)
      }

      return days
    }, {})

    // Convert each day's data into WxDay objects
    return Object.entries(dayPeriods).map(([dateKey, data]) => {
      const description = data.periods[0].conditions.description
      const adjustedDayName = WxDataNormalizer.getAdjustedDayName(data.date, currentDate)
      console.log('debug- normalizeMultiPeriod - data.date, Current Date:', data.date, currentDate)

      return new WxDay({
        date: data.date,
        dayOfWeek: adjustedDayName,
        highTemp: data.high === -Infinity ? 0 : data.high,
        lowTemp: data.low === Infinity ? 0 : data.low,
        description: description,
        precipProb: Math.max(...data.periods.map(p => p.conditions.precipitation.probability)),
        precipAmount: data.periods.reduce((sum, p) => sum + p.conditions.precipitation.amount, 0),
        windSpeed: Math.max(...data.periods.map(p => p.conditions.wind.speed)),
        windGust: Math.max(...data.periods.map(p => p.conditions.wind.gust)),
        windDir: data.periods[0].conditions.wind.direction,
        periods: data.periods,
        isBadWeather: WxDataNormalizer.checkForBadWeather(description)
      })
    })
  }

  // Helper methods for wind speed parsing
  static extractWindSpeed(windSpeedStr) {
    if (!windSpeedStr) return 0
    const matches = windSpeedStr.match(/\d+/g)
    if (!matches) return 0
    // If range like "15 to 20", take the higher number
    return Math.max(...matches.map(Number))
  }

  static extractGustSpeed(detailedForecast) {
    if (!detailedForecast) return 0
    const gustMatch = detailedForecast.match(/gusts? (?:up )?to (\d+)/i)
    return gustMatch ? parseInt(gustMatch[1]) : 0
  }
}

module.exports = { WxDay, WxPeriod, WxDataNormalizer } 