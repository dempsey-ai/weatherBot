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

// npm install simplex-chat axios dotenv natural

//npm i simplex-chat
//npm i axios
//npm i dotenv
//npm i natural

//npm run build

//running apps from 2 terminals
//=====================================
//1. simplex-chat -p 5225

//2. node wx-bot-dev.js

//=====================================

console.log(process.cwd());

const fs = require('fs');
const {ChatClient} = require("simplex-chat")
const {ChatType} = require("simplex-chat/dist/command")  
const {ciContentText, ChatInfoType} = require("simplex-chat/dist/response")

const wxBotFramework = require("./wx-bot-framework")
const userManagement = require("./wx-bot-usermgmt")
const envPath = fs.existsSync('./config/my.env') ? './config/my.env' : './weatherBot.env';
require('dotenv').config({ path: envPath });


const IS_DEBUG = process.env.DEBUG_MODE === 'false';
const APP_DATA = (process.env.APP_DATA || "./wx-bot-appdata").replace(/\/+$/, "");
const SIMPLEX_CHAT_PORT = process.env.SIMPLEX_CHAT_PORT || 5225;

const SHARE_BOT_ADDRESS = process.env.shareBotAddress === 'true';
const INIT_HOST_USER = process.env.initHostUser ? process.env.initHostUser.replace(/^['"]|['"]$/g, '') : '';
const assignedHostUser = INIT_HOST_USER !== ''; // true if INIT_HOST_USER has a value
// "/_profile_address 2 on"


let wxUsers = {};


async function run() {
  const chat = await ChatClient.create(`ws://localhost:${SIMPLEX_CHAT_PORT}`);
  const user = await chat.apiGetActiveUser();
  
  if (!user) {
    console.log("No user profile");
    return;
  }
  
  console.log(`Bot profile: ${user.profile.displayName} (${user.profile.fullName})`);
  
  const address = (await chat.apiGetUserAddress()) || (await chat.apiCreateUserAddress());
  //console.log(`Bot address: ${address}`);
  
  // Update WXBOT environment variable with bot address
  process.env.WXBOT = address;
  // Write to a volume-mounted file with quotes around the address value
  fs.writeFileSync(`${APP_DATA}/wxbot.env`, `WXBOT="${address}"`);
  console.log(`Updated WXBOT address in shared volume: "${address}"`);
  
  
  await chat.enableAddressAutoAccept();

  if (SHARE_BOT_ADDRESS) {
    try {
      await chat.sendChatCmdStr(`/_profile_address ${user.userId} on`);
    } catch (error) {
      console.error("Error sharing bot address:", error);
    }
  }

  if (assignedHostUser && INIT_HOST_USER !== '') {
    try {
      let resp = await chat.sendChatCmdStr(`/connect ${INIT_HOST_USER}`);
      //console.log("Host user connection response:", JSON.stringify(resp, null, 3));

      if (resp.chatError) {
        console.error("Error connecting host user:", resp.chatError);
        let existingUserId = null;
        if (resp.chatError.errorType.connectionPlan.contactAddressPlan.type == 'known') {
          existingUserId = resp.chatError.errorType.connectionPlan.contactAddressPlan.contact.contactId + '.1';
        } else if (resp.chatError.errorType.connectionPlan.contactAddressPlan.groupId) {
          existingUserId = resp.chatError.errorType.connectionPlan.contactAddressPlan.groupId + '.2';
        } else {
          existingUserId = null; // or handle the case where neither is present
        }
        // if existingUserId is in wxUsers, then we need to update and forceHost = true
        if (existingUserId && wxUsers[existingUserId]) {
          try {
              wxUsers[existingUserId].chattyType = 'host';
          } catch (error) {
            console.error("Error updating wxUsers to forceHost:", error);
          }
        }
        console.log("Host User already connected as :", existingUserId);
      }
    } catch (error) {
      let existingUserId = null;
      if (error.chatError.errorType.connectionPlan.contactAddressPlan.type == 'known') {
        existingUserId = error.chatError.errorType.connectionPlan.contactAddressPlan.contact.contactId + '.1';
      } else if (error.chatError.errorType.connectionPlan.contactAddressPlan.groupId) {
        existingUserId = error.chatError.errorType.connectionPlan.contactAddressPlan.groupId + '.2';
      } else {
        existingUserId = null; // or handle the case where neither is present
      }
      // if existingUserId is in wxUsers, then we need to update and forceHost = true
      if (existingUserId && wxUsers[existingUserId]) {
        try {
            wxUsers[existingUserId].chattyType = 'host';
        } catch (error) {
          console.error("Error updating wxUsers to forceHost:", error);
        }
      }
      console.log("Host User already connected as :", existingUserId);
    }
  }

  //let xxx = await chat.sendChatCommand({type: "listUsers"});
  //console.log("xxx= " + JSON.stringify(xxx, null, 3));
  
  await processMessages(chat);
}

async function processMessages(chat) {
  for await (const r of chat.msgQ) {
    const resp = r instanceof Promise ? await r : r;
    
    switch (resp.type) {
      case "contactConnected":
        try {
          await handleNewContact(chat, resp.contact);
        } catch (error) {
          console.error("Error processing new contact:", error);
          console.error("Failed contact:", JSON.stringify(resp.contact, null, 2));
        }
        break;
      case "newChatItem":
      case "newChatItems":
        const chatItems = resp.type === "newChatItem" ? [resp.chatItem] : resp.chatItems;
        for (const chatItem of chatItems) {
          try {
            await handleNewMessage(chat, chatItem);
          } catch (error) {
            console.error("Error processing message:", error);
            console.error("Failed chatItem:", JSON.stringify(chatItem, null, 2));
            if (chatItem.chatItem.content.type === 'sndMsgContent') {
              console.error("Message content:", ciContentText(chatItem.chatItem.content));
            }
          }
        }
        break;
    }
  }
}



async function handleNewContact(chat, contact) {
  console.log(`${contact.profile.displayName} (${contact.contactId}) connected`);
  //console.log("new contact: " + JSON.stringify(contact, null, 3));

  await chat.apiSendTextMessage(ChatType.Direct, contact.contactId, wxBotFramework.WELCOME_MSG);
}




async function handleNewMessage(chat, chatItem) {
  const { chatInfo } = chatItem;
  const msg = ciContentText(chatItem.chatItem.content);
  
  if (IS_DEBUG ) {
    console.log("new message, contact info: " + JSON.stringify(chatItem, null, 3));
  } 


  await userManagement.updateWxUsers(wxUsers, chatInfo);
  let wxUserId = await userManagement.getUserById(chatInfo);
  let wxChatUser = wxUsers[wxUserId];
  //console.log("wxUsers: " + JSON.stringify(wxUsers, null, 3));
  console.log("wxChatUser: " + JSON.stringify(wxChatUser, null, 3));

    // evaluate the message
    // if msg is undefined or null or empty string, skip evaluation
    if (msg  == undefined || msg == null || msg == '') {
      console.log("empty message, skipping evaluation");
      return;
    }
  
    //check if the user is disabled
    if (wxChatUser.isDisabled) {
      console.log("user is disabled, skipping evaluation");
      return;
    }

    //evaluate the message
    const qualified_msg = await wxBotFramework.evaluateMessage(wxChatUser, msg);
    console.log("Evaluated Msg: " + JSON.stringify(qualified_msg, null, 3));

    if (IS_DEBUG && (wxChatUser.chattyType === "host" || wxChatUser.chattyType === "admin")) {
      await wxBotFramework.sendMessage(chat, wxChatUser, "Evaluated Msg: " + JSON.stringify(qualified_msg, null, 3));
    } 

    switch (qualified_msg.msg_subject.toLowerCase()) {
      case 'help':
        await wxBotFramework.handleHelpRequest(chat, wxChatUser, qualified_msg);
        break;  //end of help related activity
  
      case 'location':
        await wxBotFramework.handleLocationUpdate(chat, wxUsers, wxUserId, wxChatUser, qualified_msg);
        break;
  
      case 'wxalerts':  // Handle weather alerts requests
        await wxBotFramework.handleWeatherAlerts(chat,wxChatUser, qualified_msg);
        break;
  
      case 'temp':
      case 'rain':
      case 'wind':
      case 'badweather':
      case 'wxforecasts':
        await wxBotFramework.handleWeatherForecast(chat, wxChatUser, qualified_msg);
        break;  //end of weather forecast related activity
  
      case 'hostfunction':
        if (wxChatUser.chattyType === "host" || wxChatUser.chattyType === "admin") {
          await wxBotFramework.handleHostFunction(chat, wxUsers, wxChatUser, qualified_msg);
        } else {
          await wxBotFramework.sendMessage(chat, wxChatUser, "You don't have permission to perform this action.");
        }
        break;  //end of host function related activity
  
      default:
        await wxBotFramework.sendMessage(chat, wxChatUser, "I'm sorry, I didn't understand that request.");
    }  //end of switch


}  //end of handleNewMessage



run().catch(console.error);
