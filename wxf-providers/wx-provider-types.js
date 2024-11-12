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

module.exports = {
  WX_DATA_TYPES,
  WX_PERIOD_RESOLUTION,
  WX_CAPABILITIES
} 