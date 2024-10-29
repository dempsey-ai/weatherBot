#!/bin/bash
source ~/.bashrc


# use or comment the following lines if you need to use nvm to set the node version for your specific environment install
source ~/.nvm/nvm.sh
nvm use 20.9.0  # Ensure the correct version is used

# which node
# whereis node

echo Current Ubuntu user: $(whoami)


# openssl issue was due to bug in Simplex Chat install.sh logic
# whereis libcrypto.so.1.1

# following line is when using this script as a docker container entry point script
# Change to the application directory
# cd /home/user/app/weatherbot
echo "current directory: $(pwd)"
# read -p "Press [Enter] to continue..."



# uncomment the while/done lines if you want to run the script in a loop to restart the applications if they exit

#while true; do
    # Load environment variables from weatherBot.env
    export $(cat weatherBot.env | grep -v '^#' | xargs)

    # Start the first application with piped input
    if [ ! -f ./initcli.flag ]; then
        echo "initcli.flag NOT found, starting wxBot first time"
        echo "wxBot" | simplex-chat -p ${SIMPLEX_CHAT_PORT:-5225} &
        FIRST_APP_PID=$!
        touch ./initcli.flag  # Create the flag file here
    else
        echo "Normal CLI start on port ${SIMPLEX_CHAT_PORT:-5225}"
        simplex-chat -p ${SIMPLEX_CHAT_PORT:-5225} &
        FIRST_APP_PID=$!
    fi

    # Wait for a few seconds
    sleep 3

    # Start the second application
    node wx-bot-chat.js &
    SECOND_APP_PID=$!

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

    echo "Exiting wxBot"
    # Optionally, you can log the restart
    #echo "Restarting applications..."
    
    # comment out the following line if you don't want to pause the script before exiting/restarting
    read -p "Press [Enter] to continue..."
#done
