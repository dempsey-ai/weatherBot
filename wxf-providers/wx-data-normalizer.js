const badWeatherData = require('../wx-bot-wordlists/bad_weather.json');
const badWeatherWords = badWeatherData.specificCriteria[0].parameter
const cfg = require("../wx-bot-config");

class WxDataNormalizer {
  // Helper to round numbers consistently
  static roundNumber(num, precision = 0) {
    if (num === undefined || num === null) return null;
    return Number(Number(num).toFixed(precision));
  }

  // Calculate day info for both day and period level
  static calculateDayInfo(dateStr, currentDate = new Date(), isDaytime = true, isNightPeriod = false) {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    // Parse the ISO date string explicitly
    const targetDate = new Date(dateStr + 'T00:00:00');
    const baseDate = new Date(currentDate);
    baseDate.setHours(0, 0, 0, 0);
    
    // Calculate end of current week, sunday
    const endOfCurrentWeek = new Date(baseDate);
    endOfCurrentWeek.setDate(baseDate.getDate() + (7 - baseDate.getDay()));
    endOfCurrentWeek.setHours(23, 59, 59, 999);

    // Get local day based on the time zone
    const localDay = targetDate.getDay();
    const baseName = dayNames[localDay];
    
    // Calculate days difference using local dates
    const targetLocal = new Date(targetDate);
    targetLocal.setHours(12, 0, 0, 0);
    const baseLocal = new Date(baseDate);
    const diffTime = targetLocal.getTime() - baseLocal.getTime();
    const diffFromToday = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Check if this is the first occurrence after today
    const isNextOccurrence = targetDate <= endOfCurrentWeek
    // Calculate one week after end of current week
    const oneWeekAfterEnd = new Date(endOfCurrentWeek);
    oneWeekAfterEnd.setDate(endOfCurrentWeek.getDate() + 7);

    console.log(`
      Debug getAdjustedDayName:
      Param dateStr: ${dateStr}
      Param currentDate: ${currentDate}
      Key- Parsed Target Date: ${targetDate}
      Key- End of Current Week: ${endOfCurrentWeek}
      Key- One Week After End: ${oneWeekAfterEnd}
      Local Day: ${localDay}
      Key- Day Name via baseName: ${baseName}
      Diff Days: ${diffFromToday}
      Base Date: ${baseDate}
      Target Local: ${targetLocal}
    `)


    const isWithinWeek = diffFromToday < 7 && isNextOccurrence;
    const isWeekend = [0, 6].includes(localDay);

    // Handle period-specific naming
    let name = baseName;
    let enhancedName = baseName;

    if (isNightPeriod) {
      name = `${baseName} night`;
      if (diffFromToday === 0) {
        enhancedName = "Tonight";
      } else if (diffFromToday === 1) {
        enhancedName = "Tomorrow night";
      } else if (diffFromToday <= 7 && isNextOccurrence) {
        enhancedName = name;
      } else if (targetDate <= oneWeekAfterEnd) {
        enhancedName = `Next ${baseName} night`;
      } else {
        enhancedName = `${baseName} night the ${targetDate.getDate()}${this.getDaySuffix(targetDate.getDate())}`;
      }
    } else {
      if (diffFromToday === 0) {
        enhancedName = "Today";
      } else if (diffFromToday === 1) {
        enhancedName = "Tomorrow";
    } else if (diffFromToday <= 7 && isNextOccurrence) {
        enhancedName = baseName;
      } else if (targetDate <= oneWeekAfterEnd) {
        enhancedName = "Next " + baseName;
      } else {
        enhancedName = baseName + ' the ' + targetDate.getDate() + this.getDaySuffix(targetDate.getDate());
      }
    }

    if (cfg.appConfig.isDebug) {
      console.log(`
        Debug calculateDayInfo:
        Input dateStr: ${dateStr}
        Is Night Period: ${isNightPeriod}
        Name: ${name}
        Enhanced Name: ${enhancedName}
      `);
    }

    return {
      name,
      enhancedName,
      dayNumber: localDay,
      diffFromToday,
      isWeekend,
      isWithinWeek
    };
  }

  static getDaySuffix(day) {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  // Extract wind speed from description if not provided
  static extractWindFromDescription(description) {
    if (!description) return null;
    
    const patterns = [
      /wind(?:s|y)? (?:from|at|of) (\d+)/i,
      /(\d+)\s*mph wind/i,
      /wind speeds? (?:up to )?(\d+)/i
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }
    return null;
  }

  // Main normalization method
  static normalize(wxfProv) {
    const currentDate = new Date(wxfProv.periods[0].date + 'T00:00:00');

    // Group periods by date first
    const dayMap = new Map();
    
    wxfProv.periods.forEach(period => {
      const date = period.date;
      if (!dayMap.has(date)) {
        dayMap.set(date, {
          periods: [],
          high: -Infinity,
          low: Infinity
        });
      }
      
      const dayData = dayMap.get(date);
      dayData.periods.push(period);
      
      // Track high/low temps
      if (period.temperature.value !== undefined) {
        dayData.high = Math.max(dayData.high, period.temperature.value);
      }
      if (period.temperature.low !== undefined) {
        dayData.low = Math.min(dayData.low, period.temperature.low);
      }
    });

    // Convert to wxfFinal format
    const days = Array.from(dayMap.entries()).map(([date, dayData]) => ({
      date,
      dayInfo: this.calculateDayInfo(date, currentDate),
      temperatures: {
        high: this.roundNumber(dayData.high),
        low: this.roundNumber(dayData.low)
      },
      periods: dayData.periods.map(period => {
        const isNightPeriod = !period.isDaytime;
        const provDescription = wxfProv.metadata.provider.capabilities.useEnhancedDescription && 
                                period.conditions.enhancedDescription ? 
                                period.conditions.enhancedDescription : 
                                period.conditions.description
        
        return {
          date: period.date,
          dayInfo: this.calculateDayInfo(period.date, currentDate, period.isDaytime, isNightPeriod),
          isDaytime: period.isDaytime,
          startTime: period.startTime,
          endTime: period.endTime,
          temperature: this.roundNumber(period.temperature.value),
          description: provDescription,
          conditions: {
            precipitation: {
              probability: this.roundNumber(period.conditions.precipitation.probability),
              amount: period.conditions.precipitation.amount ? 
                      this.roundNumber(period.conditions.precipitation.amount, 2) : undefined,
              type: period.conditions.precipitation.type
            },
            wind: {
              speed: this.roundNumber(period.conditions.wind.speed) || 
                     this.extractWindFromDescription(period.conditions.description),
              gust: period.conditions.wind.gust ? 
                    this.roundNumber(period.conditions.wind.gust) : undefined,
              direction: period.conditions.wind.direction
            },
            atmospheric: period.conditions.atmospheric ? {
              visibility: this.roundNumber(period.conditions.atmospheric.visibility),
              humidity: this.roundNumber(period.conditions.atmospheric.humidity),
              pressure: this.roundNumber(period.conditions.atmospheric.pressure),
              dewpoint: this.roundNumber(period.conditions.atmospheric.dewpoint),
              uvIndex: this.roundNumber(period.conditions.atmospheric.uvIndex)
            } : undefined
          },
          astronomy: {
            sunrise: period.astronomy?.sunrise,
            sunset: period.astronomy?.sunset,
            moonPhase: period.astronomy?.moonPhase
          },
          flags: {
            isBadWeather: (
              badWeatherWords.some(word => provDescription.toLowerCase().includes(word.toLowerCase())) || 
              (wxfProv.metadata.provider.capabilities.hasCodesForBadFlag && 
               wxfProv.metadata.provider.capabilities.badWeatherCodes.includes(Number(period.conditions.codes.code)))
            )
          }
        };
      })
    }));

    return {
      isValid: true,
      wxfData: {
        metadata: {
          providerName: wxfProv.metadata.provider.name,
        providerType: wxfProv.metadata.provider.type,
        periodResolution: wxfProv.metadata.provider.periodResolution,
        location: {
          timezone: wxfProv.metadata.location.timezone,
          wxfURL: wxfProv.metadata.location.wxfURL
        },
        generated: wxfProv.metadata.generated.timestamp
        },
        forecast: { days }
      }
    };
  }
}

module.exports = { WxDataNormalizer }; 