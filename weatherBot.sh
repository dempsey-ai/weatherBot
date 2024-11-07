#!/bin/bash
: <<'COMMENT'
weatherBot chat client - version 1.2 - Uses SimpleX Chat framework to provide weather forecast reports to user messages
    Copyright (C) 2024  Scott Dempsey

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
COMMENT


set -a

if [ -f ~/.bashrc ]; then
    source ~/.bashrc
fi

echo $SHELL
echo $HOME

# use yq and get data.app-host.value
# bash, docker, or start9
APP_HOST=$(yq e '.data.app-host.value' "wx-bot-weatherbot.yaml")
YAML_DATA=$(yq e '.data.yamls-path.value' "wx-bot-weatherbot.yaml")
APP_DATA=$(yq e '.data.data-path.value' "wx-bot-weatherbot.yaml")
USER_HOME=$(yq e '.data.user-home.value' "wx-bot-weatherbot.yaml")
APP_HOME=$(yq e '.data.app-home.value' "wx-bot-weatherbot.yaml")

if [ "$APP_HOST" == "start9" ]; then
    printf "Running in Start9...\n"
    HOME=$USER_HOME
    CLI_HOME=$USER_HOME/cli
    START9_HOME="${START9_HOME:-/root/start9}"
    if [ ! -d $START9_HOME ]; then
        printf "start9 home directory not found, creating\n"
        mkdir -p $START9_HOME
    fi

elif [ "$APP_HOST" == "docker" ]; then
    # dockerfiles will update the existing weatherbot.yaml with custom values to use below
    printf "Running in Docker, relying on clean system\n"
    HOME=$USER_HOME
    CLI_HOME=$USER_HOME/cli
    printf "Node.js found at: $(which node)\n"
    #whereis node
else 
    printf "assuming bash environment, setting up nvm\n"
    CLI_HOME=$HOME/.local/bin
    # use or comment the following lines if you need to use nvm to set the node version for your specific environment install
    source ~/.nvm/nvm.sh
    nvm use 20.9.0  # Ensure the correct version is used
fi



printf "Current OS user: $(whoami)\n"
# Get current username and change directory
CURRENT_USER=$(whoami)

cd $APP_HOME

# openssl issue was due to bug in Simplex Chat install.sh logic
# whereis libcrypto.so.1.1



# check if the stats.yaml file exists, if not, copy the default one
if [ ! -f "$YAML_DATA/stats.yaml" ]; then
    printf "stats.yaml not found, copying default\n"
    cp -f "$APP_HOME/wx-bot-stats.yaml" "$YAML_DATA/stats.yaml"
else
    printf "Using existing stats.yaml from $YAML_DATA\n"    
fi
cat $YAML_DATA/stats.yaml
printf "\n"
echo "--------------------------------"

# check if the config.yaml file exists, if not, copy the default one
if [ ! -f "$YAML_DATA/config.yaml" ]; then
    printf "config.yaml not found, copying default\n"
    cp -f "$APP_HOME/wx-bot-config.yaml" "$YAML_DATA/config.yaml"
else
    printf "Using existing config.yaml from $YAML_DATA\n"    
fi
cat $YAML_DATA/config.yaml
printf "\n"
echo "--------------------------------"


SIMPLEX_CHAT_PORT=$(yq e '.simplex-chat-port' "$YAML_DATA/config.yaml")


if [ "$APP_HOST" == "docker" ]; then
    printf "\n"
    printf "Running in Docker, continuing...\n"
elif [ "$APP_HOST" == "start9" ]; then
    printf "Running in Start9, continuing...\n"
else
    printf "Running in bash, current directory: $(pwd)\n"
    read -p "Press [Enter] to continue..."
fi




# uncomment the while/done lines if you want to run the script in a loop to restart the applications if they exit

#while true; do
    # Load environment variables from weatherBot.env
    #export $(cat weatherBot.env | grep -v '^#' | xargs)
    printf "Listing files in $APP_DATA\n"
    ls -l $APP_DATA
    printf "\n"
    echo "--------------------------------"
    # Start the first application with piped input
    if [ ! -f $APP_DATA/initcli.flag ]; then
        printf "initcli.flag NOT found, starting wxBot first time\n"
        echo "wxBot" | $CLI_HOME/simplex-chat -l error -p ${SIMPLEX_CHAT_PORT:-5225} -d $APP_DATA/jed &
        FIRST_APP_PID=$!
        touch $APP_DATA/initcli.flag  # Create the flag file here
    else
        printf "Normal CLI start on port ${SIMPLEX_CHAT_PORT:-5225}\n"
        $CLI_HOME/simplex-chat -l error -p ${SIMPLEX_CHAT_PORT:-5225} -d $APP_DATA/jed &
        FIRST_APP_PID=$!
    fi

    printf "Starting wx-bot-chat.js\n"
    sleep 3
    # Try starting node application with retry
    MAX_RETRIES=2
    RETRY_COUNT=0
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        node wx-bot-chat.js &
        SECOND_APP_PID=$!
        
        # Wait a moment to see if it stays running
        sleep 10
        if kill -0 $SECOND_APP_PID 2>/dev/null; then
            printf "wx-bot-chat.js started successfully\n"
            break
        else
            printf "wx-bot-chat.js failed to start, retrying...\n"
            RETRY_COUNT=$((RETRY_COUNT + 1))
            [ $RETRY_COUNT -lt $MAX_RETRIES ] && sleep 10
        fi
    done

    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        printf "Failed to start wx-bot-chat.js after $MAX_RETRIES attempts\n"
        exit 1
    fi

    # Wait for either application to exit
    wait -n $FIRST_APP_PID $SECOND_APP_PID

    # If either application exits, kill the other and restart both
    if kill -0 $FIRST_APP_PID 2>/dev/null; then
        kill $SECOND_APP_PID
        sleep 2
    else
        kill $FIRST_APP_PID
        sleep 2
    fi
   

    if [ "$APP_HOST" == "docker" ]; then
	    printf "Exiting weatherBot\n"
    elif [ "$APP_HOST" == "start9" ]; then
        printf "Exiting weatherBot\n"
    else
        printf "Exiting weatherBot\n"
        # comment out the following line if you don't want to pause the script before exiting/restarting
	    read -p "Press [Enter] to continue..."
    fi
#done

