# Docker Runner - Docker Integration for VSC

Please note this is an early alpha version, so it may have bugs and missing features.
However I think it can be already very useful.
I am still experimenting a lot and I am planning to add much more features in the future. 

## How to start?

Press **Alt+Ctrl+D** to activate.

## What this extension can do for you now?

- Search and pull Docker images from Docker Hub
- Easily manage local images
- Manage local containers
- Easily copy files between local filesystem and container file system
- Pin your favourite containers to the main menu

## Search and pull images from Docker Hub

You can directly search images in Docker Hub by using **Search Images** option from the main menu.

![Search Results](images/search-results.png)

If you choose **Pull & Pin to the menu** option image will appear in the main menu. Default command line parameters are stored in **config.js** file. You can edit this file by selecting **Edit Configuration** option. Edit following line to change any required options:

      "run": "-i -t --rm --name $default-name -v $workspace:$src ubuntu sh"





## Browsing local images

Currently available operations:

- pull
- push
- remove
- history

![Search Results](images/images.png)

## Browsing local containers

Currently available operations:

- start / restart / stop / pause
- rename
- remove
- diff
- logs
- browse filesystem


![Search Results](images/containers.png)

## Browsing container filesystem

Currently available operations:

- copy files between container and local filesystem
- delete files in container and local filesystem
- more to come...

![Search Results](images/files.png)
