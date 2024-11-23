/*
weatherBot chat client - version 1.4 - Uses SimpleX Chat frameworkto provide weather forecast reports to user messages
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

// sudo curl -L https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 -o /usr/bin/yq
// sudo chmod +x /usr/bin/yq

// npm install simplex-chat axios dotenv natural

//npm i simplex-chat
//npm i axios --save
//npm install yaml --save
//npm i natural --save

//npm run build

//running apps from 2 terminals
//=====================================
//1. simplex-chat -p 5225

//2. node wx-bot-dev.js

//=====================================

console.log("wx-bot-chat.js initializing...")
console.log(process.cwd())

const {ChatClient} = require("simplex-chat")
const {ChatType} = require("simplex-chat/dist/command")
const {ciContentText, ChatInfoType} = require("simplex-chat/dist/response")

const wxBotFramework = require("./wx-bot-framework")
const userManagement = require("./wx-bot-usermgmt")
const cfg = require("./wx-bot-config")
const path = require("path")

let wxUsers = {}

async function run() {
  // Initialize when module loads
  await cfg.initializeConfigs()
  //await wxBotFramework.setActiveProvider()
  //console.log(`Active provider: ${wxBotFramework.activeProviderName}`)

  const assignedHostUser = cfg.appConfig.initHostUser !== "" // true if initHostUser has a value

  const chat = await ChatClient.create(`ws://localhost:${cfg.appConfig.simplexChatPort}`)
  const user = await chat.apiGetActiveUser()

  if (!user) {
    console.log("SimpleX Chat: No user profile")
    return
  }

  console.log(`SimpleX Chat: Bot profile: ${user.profile.displayName} (${user.profile.fullName})`)

  const address = (await chat.apiGetUserAddress()) || (await chat.apiCreateUserAddress())
  wxBotFramework.debugLog(`apiGetUserAddress (or apiCreateUserAddress): Bot address: ${address}`)

  await cfg.updateStatsValue(path.join(cfg.appConfig.paths.yamlPath, "stats.yaml"), "wxbot-address", address)
  console.log(`Updated stats.yaml file with address: "${address}"`)

  await chat.enableAddressAutoAccept()

  if (cfg.appConfig.shareBotAddress) {
    try {
      await chat.sendChatCmdStr(`/_profile_address ${user.userId} on`)
    } catch (error) {
      console.error("Error sharing bot address:", error)
    }
  }

  if (cfg.appConfig.botDisplayName) {
    try {
      await chat.sendChatCmdStr(`/p ${cfg.appConfig.botDisplayName}`)
    } catch (error) {
      console.error("Error setting bot display name:", error)
    }
  }

  if (assignedHostUser && cfg.appConfig.initHostUser !== "") {
    try {
      let resp = await chat.sendChatCmdStr(`/connect ${cfg.appConfig.initHostUser}`)
      wxBotFramework.debugLog("Host user connection response:", JSON.stringify(resp, null, 3))

      if (resp.chatError) {
        wxBotFramework.debugLog("Error connecting host user:", resp.chatError)
        let existingUserId = null
        if (resp.chatError.errorType.connectionPlan.contactAddressPlan.type == "known") {
          existingUserId = resp.chatError.errorType.connectionPlan.contactAddressPlan.contact.contactId + ".1"
        } else if (resp.chatError.errorType.connectionPlan.contactAddressPlan.groupId) {
          existingUserId = resp.chatError.errorType.connectionPlan.contactAddressPlan.groupId + ".2"
        } else {
          existingUserId = null // or handle the case where neither is present
        }
        // if existingUserId is in wxUsers, then we need to update and forceHost = true
        if (existingUserId && wxUsers[existingUserId]) {
          try {
            wxUsers[existingUserId].chattyType = "host"
          } catch (error) {
            wxBotFramework.debugLog("Error updating wxUsers to forceHost:", error)
          }
        }
        console.log("Host User already connected as :", existingUserId)
      }
    } catch (error) {
      let existingUserId = null
      if (error.chatError.errorType.connectionPlan.contactAddressPlan.type == "known") {
        existingUserId = error.chatError.errorType.connectionPlan.contactAddressPlan.contact.contactId + ".1"
      } else if (error.chatError.errorType.connectionPlan.contactAddressPlan.groupId) {
        existingUserId = error.chatError.errorType.connectionPlan.contactAddressPlan.groupId + ".2"
      } else {
        existingUserId = null // or handle the case where neither is present
      }
      // if existingUserId is in wxUsers, then we need to update and forceHost = true
      if (existingUserId && wxUsers[existingUserId]) {
        try {
          wxUsers[existingUserId].chattyType = "host"
        } catch (error) {
          console.error("Error updating wxUsers to forceHost:", error)
        }
      }
      console.log("Host User already connected as :", existingUserId)
    }
  }
  console.log("weatherBot version:", cfg.appConfig.version)
  await processMessages(chat)
}

async function processMessages(chat) {
  for await (const r of chat.msgQ) {
    const resp = r instanceof Promise ? await r : r

    switch (resp.type) {
      case "contactConnected":
        try {
          await handleNewContact(chat, resp.contact)
        } catch (error) {
          console.error("Error processing new contact:", error)
          console.error("Failed contact:", JSON.stringify(resp.contact, null, 2))
        }
        break
      case "newChatItem":
      case "newChatItems":
        const chatItems = resp.type === "newChatItem" ? [resp.chatItem] : resp.chatItems
        for (const chatItem of chatItems) {
          try {
            await handleNewMessage(chat, chatItem)
          } catch (error) {
            console.error("Error processing message:", error)
            console.error("Failed chatItem:", JSON.stringify(chatItem, null, 2))
            if (chatItem.chatItem.content.type === "sndMsgContent") {
              console.error("Message content:", ciContentText(chatItem.chatItem.content))
            }
          }
        }
        break
    }
  }
}

async function handleNewContact(chat, contact) {
  console.log(`${contact.profile.displayName} (${contact.contactId}) connected`)

  await chat.apiSendTextMessage(ChatType.Direct, contact.contactId, wxBotFramework.WELCOME_MSG)
}

async function handleNewMessage(chat, chatItem) {
  const {chatInfo} = chatItem
  const msg = ciContentText(chatItem.chatItem.content)

  wxBotFramework.debugLog("new message, contact info: " + JSON.stringify(chatItem, null, 3))

  await userManagement.updateWxUsers(wxUsers, chatInfo)
  let wxUserId = await userManagement.getUserById(chatInfo)
  let wxChatUser = wxUsers[wxUserId]
  wxBotFramework.debugLog("wxChatUser: " + JSON.stringify(wxChatUser, null, 3))

  // evaluate the message
  // if msg is undefined or null or empty string, skip evaluation
  if (msg == undefined || msg == null || msg == "") {
    wxBotFramework.debugLog("empty message, skipping evaluation")
    return
  }

  //check if the user is disabled
  if (wxChatUser.isDisabled) {
    console.log("user is disabled, skipping evaluation")
    return
  }

  //evaluate the message
  const qualified_msg = await wxBotFramework.evaluateMessage(wxChatUser, msg)
  wxBotFramework.debugLog("Evaluated Msg: " + JSON.stringify(qualified_msg, null, 3))

  if (cfg.appConfig.isDebug && (wxChatUser.chattyType === "host" || wxChatUser.chattyType === "admin")) {
    await wxBotFramework.sendMessage(chat, wxChatUser, "Evaluated Msg: " + JSON.stringify(qualified_msg, null, 3))
  }

  switch (qualified_msg.msg_subject.toLowerCase()) {
    case "help":
      await wxBotFramework.handleHelpRequest(chat, wxChatUser, qualified_msg)
      break //end of help related activity

    case "location":
      await wxBotFramework.handleLocationUpdate(chat, wxUsers, wxUserId, wxChatUser, qualified_msg)
      break

    case "wxalerts": // Handle weather alerts requests
      await wxBotFramework.handleWeatherAlerts(chat, wxChatUser, qualified_msg)
      break

    case "temp":
    case "rain":
    case "wind":
    case "badweather":
    case "wxforecasts":
      await wxBotFramework.handleWeatherForecast(chat, wxChatUser, qualified_msg)
      break //end of weather forecast related activity

    case "hostfunction":
      if (wxChatUser.chattyType === "host" || wxChatUser.chattyType === "admin") {
        await wxBotFramework.handleHostFunction(chat, wxUsers, wxChatUser, qualified_msg)
      } else {
        await wxBotFramework.sendMessage(chat, wxChatUser, "You don't have permission to perform this action.")
      }
      break //end of host function related activity

    default:
      await wxBotFramework.sendMessage(chat, wxChatUser, "I'm sorry, I didn't understand that request.")
  } //end of switch
} //end of handleNewMessage

run().catch(console.error)
