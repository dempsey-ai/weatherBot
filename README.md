# SimpleX Chat weatherBot as a service


This is a personal weather chat bot service that is built on the SimpleX Chat framework.  It communicates with the SimpleX Chat server using the WebSocket API client from [SimpleX Chat terminal CLI](https://github.com/simplex-chat/simplex-chat/blob/stable/docs/CLI.md).  The weatherBot service is a `node.js` application utilizing their `Simplex Typescript SDK` to accept connection requests from users, get messages from SimpleX SMP servers, and send messages back to the users.  

**Note:** This weatherBot service is a personal project of mine that started as an example of a chat bot service built on the SimpleX Chat framework.  It has since evolved into a project that was completely rewriten using the [Cursor AI IDE](https://www.cursor.com/) to explore using AI integrated development tools.  The resulting rewrite was about 1/3 less lines of code, increased functionality through advanced use of the same underlying code technology, increased flexibility of underlying service provider integration, and ultimately further down the application roadmap in less time.  It has been an eye opening experience and I am encouraged by this first hand experience and what it should mean to every single organization that uses software solutions both internally and as delivered products.  This codebase is not meant to be an example of any particular code solution, best practices, styles, etc, of software engineering.  However, the delivery of a working example is the proof itself of using AI IDE integration from start to finish.  Further, the use of Cursor AI surpassed the initial laptop running, prototype capability into a functioning, delivered [Docker Hub image](https://hub.docker.com/r/dempsey0ai/weatherbot/tags) build as well as a custom [Start9os installable application](https://marketplace.start9.com/?%2Fmedia=communcations) to host the weatherBot service on a dedicated cloud appliance. The best way to describe having AI IDE is to say it is **relentlessly helpful** and you are only limited by your willingness to keep working the solution.  AI is that friend that always takes your phone call, always knows the subject matter, never passes you off to someone else, never pretends to be busy, and always has time to work endlessly on your issue with no hard stops.


The weatherBot service takes a user's chat messages, interprets the user's intent, and then fetches the weather data from a weather service provider.  The daily weather forecast data is then converted to a simple, concise format and returned to the user in a SimpleX chat message reply.  

The goal of the weatherBot is to provide a useful, working example demonstrating a method to interact with an underlying product service provider (in this case, a weather service) through a chat bot service which provides a layer of abstraction between the user and the product service provider.  Instead of the user being the product consumed by the service provider, the user is the consumer of the chat bot service which then consumes the product of the service provider.  Using SimpleX Chat's SMP server framework provides the ultimate example of privacy and security by separating the user's identity from the product service provider.  The weatherBot service is a simple example of a chat bot service that can be extended and customized to provide a wide variety of services to SimpleX Chat users.  


## weatherBot features

- weatherBot: a chat bot that provides localized weather information to SimpleX Chat users
- provider framework: supports adding additional, free or paid weather service providers to the weatherBot
- private: separation of user identifiable information, via SimpleX Chat, from weather service providers
- focused: weatherBot provides simplified, succinct information void of adverts and other distractions meant to monetize the user's attention

Enjoy having fun with weatherBot!  


## weatherBot chat examples

The purpose of using a chat bot style interaction is to support natural language, simple chats from the user.  The following examples are not meant to dictate a strict syntax format, but examples of keys words that the weatherBot will understand and respond.  The user may or may not use punctuation or more or less words than the examples.  In my experience, the chats will trend towards fewer words, but hopefully catch the user's intention during their early interactions of learning the weatherBot's capabilities.

- location 80809 (set's the user's location for the weatherBot to a specific zipcode)
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

### 1. Download the weatherBot code locally and change into the weatherBot directory from Terminal.

### 2. Install yq (can use wget instead of curl)

```
sudo curl -L https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 -o /usr/bin/yq
sudo chmod +x /usr/bin/yq
```

### 3. Install node.js

### 4. Install the following npm packages:

```
npm i simplex-chat --save
npm i axios --save
npm install yaml --save
npm i natural --save
```

### 4. Install the SimpleX Chat CLI:

**Note:** Install the SimpleX Chat CLI via `corrected` [install-simplex-cli.sh](./install-simplex-cli.sh) script.   

> **The Simplex Chat install.sh script (as of Oct 2024) still had a bug that installs an older CLI version that is meant for older Ubuntu versions prior to v22.04 that used an older SSL 1.1 library.  My install script pulls the ubuntu-22_04-x86-64 CLI version from the SimpleX Chat GitHub releases.**



```
bash install-simplex-cli.sh
```

### 5. Build the project:

``` 
npm run build
```

## Customizing weatherBot

You can customize the websocket port number by editing the `simplex-chat` command in the following `Running` steps and also editing the `.env` file to set the `SIMPLEX_CHAT_PORT` variable to the match what you will use in the `simplex-chat` command.  

**Note:** Additional customization options are available and documented in the `.env` file.
> weatherBot uses word list files to determine what the user is asking for in their chat messages.  You can customize the word lists to change how the weatherBot interprets the user's chat messages.  They are technical in nature and require a good understanding of the weatherBot's code and specifically regex syntax.  However, the simplest change would be to add words to the `generalWords` array in the word list files which is what initially tells weatherBot what is primary weather subject to provide forecast data.  For example, if you want to use the word "wet" instead of "rain", you could edit the `rain.json` file to replace "rain" with "wet".  

## Running weatherBot

There are two ways to run weatherBot:

1. Manual Method (using default port 5225)
2. Using the Automated Script, **weatherBot.sh**



**Manual Method**

Start `simplex-chat` as a server on port 5225: from terminal 1:

```
simplex-chat -p 5225
```

Run `weatherBot`: from terminal 2:

```
node wx-bot-chat.js
```

**Using the Automated Script**

The `weatherBot.sh` script handles launching both applications automatically:
> **Note:** May need to configure the script permissions to execute via file manager or by running `chmod +x weatherBot.sh`

```
./weatherBot.sh
```

#### Configuration

The script supports two configuration methods:

1. **Custom Configuration**: 
   - Within the `config` folder in the application directory
   - Copy `wx-bot-config.yaml` from weatherBot folderto `wx-bot-config/config.yaml`
   - Edit `config.yaml` with your desired settings
   - Be sure to add your SimpleX user address as the Host/Admin user to the `init-host-user` field
   - You don't have to do any customization, the app will use default values.

2. **Default Configuration**:
   - If no custom configuration exists, the script will copy `wx-bot-config.yaml` to  `wx-bot-config/config.yaml`

    Example configuration:
```
HOST_CONTACT="simplex://...."  # Your SimpleX address here (in quotes)
CHAT_PORT=5225                 # Default SimpleX chat port
# ... other settings
```

The script will automatically:
- Use your custom configuration if `wx-bot-config/config.yaml` exists
- Fall back to `wx-bot-config.yaml` if no custom configuration is found
- Launch both the SimpleX chat server and the weatherBot application




### 6. Connect to `weatherBot` via SimpleX Chat client using the address of the `wxBot` profile
> **Note:** After starting the `weatherBot`, you can find the chatbot's address in the terminal output.  Copy the address and paste it into the SimpleX Chat client for a new chat connection.  The `weatherBot` will auto accept the connection and you are ready to chat!  Additionally, the chatbot's address will be displayed in the `wx-bot-config/stats.yaml` file under the `wxbot-address`, 'value' field.



## License

[AGPL v3](./LICENSE)
