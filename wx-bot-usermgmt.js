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

const {ChatInfoType} = require("simplex-chat/dist/response")
const {ChatType} = require("simplex-chat/dist/command")

let wxUsers = {}

const updateWxUsers = async (wxUsers, chatInfo, forceHost = false) => {
  let userId = chatInfo.type === ChatInfoType.Direct ? chatInfo.contact?.contactId : chatInfo.groupInfo?.groupId ?? ""

  let chatTypeAsDec = chatInfo.type == ChatInfoType.Direct ? 0.1 : 0.2

  let wxUserId = userId + chatTypeAsDec

  if (!wxUsers[wxUserId]) {
    let displayName = ""
    let fullName = ""
    let chatType = chatInfo.type == ChatInfoType.Direct ? ChatType.Direct : ChatType.Group

    if (chatInfo.type == ChatInfoType.Direct) {
      displayName = chatInfo.contact?.profile?.displayName || ""
      fullName = chatInfo.contact?.profile?.fullName || ""
    } else if (chatInfo.type == ChatInfoType.Group) {
      displayName = chatInfo.groupInfo?.groupProfile?.displayName || ""
      fullName = chatInfo.groupInfo?.groupProfile?.fullName || ""
    }

    wxUsers[wxUserId] = {
      wxUserId: wxUserId,
      chattyType: forceHost || Object.keys(wxUsers).length === 0 ? "host" : "user",
      chatType: chatInfo.type,
      displayName,
      fullName,
      ID: userId,
      apiSendInfo: {
        Type: chatType,
        ID: userId,
      },
      isDisabled: false,
      disabledReason: "",
    }
  }

  return
}

const getUserById = (chatInfo) => {
  const userId = chatInfo.type === ChatInfoType.Direct ? chatInfo.contact?.contactId : chatInfo.groupInfo?.groupId ?? ""

  const chatTypeAsDec = chatInfo.type == ChatInfoType.Direct ? 0.1 : 0.2
  const wxUserId = userId + chatTypeAsDec

  return wxUserId
}

const setUserGroup = async (wxUsers, wxUserId, group) => {
  console.log("setUserGroup:" + wxUserId + " group:" + group)
  if (wxUsers[wxUserId] && ["host", "admin", "user"].includes(group)) {
    wxUsers[wxUserId].chattyType = group
    return true
  } else {
    console.log("setUserGroup:" + wxUserId + " group:" + group + " not found")
  }
  return false
}

const disableUser = async (wxUsers, wxUserId, reason) => {
  console.log("disableUser:" + wxUserId + " reason:" + reason)
  if (wxUsers[wxUserId]) {
    wxUsers[wxUserId].isDisabled = true
    wxUsers[wxUserId].disabledReason = reason
    return true
  } else {
    console.log("disableUser:" + wxUserId + " not found")
  }
  return false
}

const enableUser = async (wxUsers, wxUserId) => {
  if (wxUsers[wxUserId]) {
    wxUsers[wxUserId].isDisabled = false
    wxUsers[wxUserId].disabledReason = ""
    return true
  }
  return false
}

const deleteUser = (wxUserId) => {
  if (wxUsers[wxUserId]) {
    delete wxUsers[wxUserId]
    return true
  }
  return false
}

const listDisabledUsers = () => {
  return Object.values(wxUserId).filter((user) => user.isDisabled)
}

const listAdminUsers = () => {
  return Object.values(wxUserId).filter((user) => user.chattyType === "admin")
}

const updateUserLocation = async (wxUsers, wxUserId, wxChatUser, locationLabel, locationType, locationValue) => {
  if (!wxUsers[wxUserId]) {
    wxUsers[wxUserId] = {}
  }
  wxUsers[wxUserId].location = {label: locationLabel, type: locationType, value: locationValue}
  wxChatUser = wxUsers[wxUserId]

  //return wxUsers;
  return
}

const getUserLocation = (wxUsers, wxUserId) => {
  return wxUsers[wxUserId] && wxUsers[wxUserId].location
}

module.exports = {
  updateWxUsers,
  getUserById,
  setUserGroup,
  disableUser,
  enableUser,
  deleteUser,
  listDisabledUsers,
  listAdminUsers,
  updateUserLocation,
  getUserLocation,
}
