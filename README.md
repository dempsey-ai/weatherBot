# SimpleX Chat weatherBot as a service

This is a weatherBot chat client that uses javascript WebSocket API client from [SimpleX Chat terminal CLI](https://github.com/simplex-chat/simplex-chat/blob/stable/docs/CLI.md) along with `node.js` to run the typescript package from `Simplex Chat SDK`



## weatherBot features

- weatherBot: a chat bot that provides localized weather information to SimpleX Chat users
- provider framework: supports adding additional, free or paid weather service providers to the weatherBot
- private: separation of user identifiable information, via SimpleX Chat, from weather service providers
- focused: weatherBot provides simplified, succinct information void of adverts and other distractions meant to monetize the user's attention

Enjoy having fun with weatherBot!  


## weatherBot chat examples

- location 29642 (set's the user's location for the weatherBot to a specific zipcode)
- location pikes peak,co (set's the user's location for the weatherBot to a specific city)
- location label "vacation" (assign's a label to the user's previously set location details)
- rain this week? (returns daily forecast when rain chance is over zero percent chance)
- rain over 50? (returns daily forecast when rain chance is over 50 percent)
- rain < 20 (returns daily forecast when rain chance is less than 20 percent)
- no rain? (returns daily forecast when rain chance is zero percent)
- windy days? (returns daily forecast when wind speed or gusting is over 0 mph)
- gusts over 15 (returns daily forecast when gusting is over 15 mph, ignoreing separate wind speeds)
- no wind, wind over/under, etc (similar to rain examples above)
- bad weather? (returns daily forecast that contains any of predefined key words, like "hail", "lightning", "tornado", "freezing", etc)
- alerts? (returns any active current weather alerts for the user's location)
- temps (returns a daily summary of the high and low temperatures)
- temp over/above/below/under (similar to rain and wind examples above, but for temperature)
- hot days? (returns daily forecast when the high temperature is over 85 degrees)
- cool or chilly days? (returns daily forecast when the high temperature is under 60 degrees)
- warm days? (returns daily forecast when the high temperature is over 70 degrees)
- freezing temps? (returns daily forecast when any temperature is under 32 degrees)
- bitter cold (returns daily forecast when any temperature is under 20 degrees)
- today (returns today's forecast)
- tonight (returns tonight's forecast)
- tomorrow (returns tomorrow's forecast)
- weekend (returns the Sat/Sun forecast)
- Tue (returns the forecast for Tuesday)
- next n days (returns the daily forecast for the next n days)
- search/find item (returns the daily forecast that contains the search item, ex: "fog")


## Quick setup for Ubuntu 22.04

1. Download the weatherBot code locally and change into the weatherBot directory from Terminal.
2. Install node.js
3. Install the following npm packages:

```
npm i simplex-chat
npm i axios
npm i dotenv
npm i natural
```

4. Install the SimpleX Chat CLI:

**Note:** Install the SimpleX Chat CLI via `corrected` [install-simplex-cli.sh](./install-simplex-cli.sh) script.   

> **The Simplex Chat install.sh script (as of Oct 2024) still had a bug that installs an older CLI version that is meant for older Ubuntu versions prior to v22.04 that used an older SSL 1.1 library.  My install script pulls the ubuntu-22_04-x86-64 CLI version from the SimpleX Chat GitHub releases.**



```
bash install-simplex-cli.sh
```

5. Build the project:

``` 
npm run build
```

## Customizing weatherBot

You can customize the websocket port number by editing the `simplex-chat` command in the following `Running` steps and also editing the `.env` file to set the `SIMPLEX_CHAT_PORT` variable to the match what you will use in the `simplex-chat` command.  

**Note:** Additional customization options are available and documented in the `.env` file.
> weatherBot uses word list files to determine what the user is asking for in their chat messages.  You can customize the word lists to change how the weatherBot interprets the user's chat messages.  They are technical in nature and require a good understanding of the weatherBot's code and specifically regex syntax.  However, the simplest change would be to add words to the `generalWords` array in the word list files which is what initially tells weatherBot what is primary weather subject to provide forecast data.  For example, if you want to use the word "wet" instead of "rain", you could edit the `rain.json` file to replace "rain" with "wet".  

## Running weatherBot (using default port 5225)

start `simplex-chat` as a server on port 5225: from terminal 1:
```
simplex-chat -p 5225
```

run `weatherBot`: from terminal 2:
```
node wx-bot-chat.js
```

6. Connect to `weatherBot` via SimpleX Chat client using the address of the `wxBot` profile
> **Note:** After starting the `weatherBot`, you can find the chatbot's address in the terminal output.  Copy the address and paste it into the SimpleX Chat client for a new chat connection.  The `weatherBot` will auto accept the connection and you are ready to chat!



## License

[AGPL v3](./LICENSE)
