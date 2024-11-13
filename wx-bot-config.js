const YAML = require("yaml")
const fs = require("fs").promises
const path = require("path")

const currentMonth = new Date().getMonth() + 1 // getMonth() returns 0-11, so we add 1

let appConfig = {
  isDebug: false, // default values
  tempHot: 75,
  tempCold: 50,
  simplexChatPort: 5225,
  shareBotAddress: false,
  initHostUser: "",
  paths: {
    userHome: "",
    appHost: "",
    appHome: "",
    yamlPath: "",
    dataPath: "",
  },
}

// Initialize function
async function initializeConfigs() {
  try {
    // Read weatherbot yaml first
    wxbotyaml = await readConfig("wx-bot-weatherbot.yaml")

    // Set paths
    appConfig.paths.userHome = wxbotyaml.getIn(["data", "user-home", "value"])
    appConfig.paths.appHost = wxbotyaml.getIn(["data", "app-host", "value"])
    appConfig.paths.appHome = wxbotyaml.getIn(["data", "app-home", "value"])
    appConfig.paths.yamlPath = wxbotyaml.getIn(["data", "yamls-path", "value"])
    appConfig.paths.dataPath = wxbotyaml.getIn(["data", "data-path", "value"])

    console.log(`appConfig.paths.userHome: ${appConfig.paths.userHome}`)
    console.log(`appConfig.paths.yamlPath: ${appConfig.paths.yamlPath}`)
    console.log(`appConfig.paths.dataPath: ${appConfig.paths.dataPath}`)
    // Read config yaml using paths
    configyaml = await readConfig(path.join(appConfig.paths.yamlPath, "config.yaml"))

    // Set config values
    appConfig.simplexChatPort = configyaml.get("simplex-chat-port") || 5225
    appConfig.shareBotAddress = configyaml.get("share-bot-address") === true
    appConfig.initHostUser = configyaml.get("init-host-user") || ""
    appConfig.isDebug = configyaml.get("debug-mode") === true
    appConfig.botDisplayName = configyaml.get("bot-display-name") || "wxBot"
    appConfig.wxProviderApiKey = configyaml.get("weather-provider-api-key") || ""
    appConfig.wxProviderId = configyaml.get("weather-provider-id") || "weather.gov"

    // Set temperature thresholds
    appConfig.tempHot = currentMonth >= 6 && currentMonth <= 9 ? configyaml.get("summer-temp-hot") || 85 : configyaml.get("temp-hot") || 75

    appConfig.tempCold = configyaml.get("temp-cold") || 50

    return true
  } catch (error) {
    console.error("Failed to initialize configurations:", error)
    process.exit(1)
  }
}

// Reading the full structure
async function readConfig(filename) {
  try {
    const file = await fs.readFile(filename, "utf8")
    const config = YAML.parseDocument(file) // Use parseDocument to preserve formatting
    //console.log(`readConfig: ${config}`);
    return config
  } catch (error) {
    console.error(`Error reading yaml file ${filename}:`, error)
    throw error
  }
}

// Update a specific value while preserving structure
async function updateConfigValue(filename, key, newValue) {
  try {
    const doc = await readConfig(filename)
    doc.set(`${key}`, newValue)
    await fs.writeFile(filename, doc.toString())
  } catch (error) {
    console.error(`Error updating config value in ${filename}:`, error)
    throw error
  }
}

async function updateStatsValue(filename, key, newValue) {
  try {
    const doc = await readConfig(filename)
    // Use getIn to verify the path exists
    const node = doc.getIn(["data", key])
    if (node) {
      // Update just the value field while preserving structure
      node.set("value", newValue)
      await fs.writeFile(filename, doc.toString())
    } else {
      throw new Error(`Key path data.${key} not found in ${filename}`)
    }
  } catch (error) {
    console.error(`Error updating stats value in ${filename}:`, error)
    throw error
  }
}

module.exports = {
  appConfig,
  initializeConfigs,
  readConfig,
  updateConfigValue,
  updateStatsValue,
}
