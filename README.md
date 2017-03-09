# VSC + Docker for IoT Extension

## Start working

After cloning this repo, go to the extension directory and run **npm install**


## Detecting compatible Docker containers

Extension searches DockerHub for compatible containers. Their names have to contain **xvsc** signature in their name.

## Container capabilities

Extension should be able to query container for capabilities by running following command:

  docker run <container-name> capabilities

Container should return a JSON formatted string contained capabilities definitions.

TBD: define container capabilities  
