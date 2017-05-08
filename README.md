# Docker Runner - Docker Integration for VSC

Please note this is an early alpha version, so it may have bugs and missing features.
However I think it can be already very useful.
I am still experimenting a lot and I am planning to add much more features in the future. 

## How to start?

Press **Alt+Ctrl+D** to activate.

Make sure your local drive is shared, as the extension will attempt to map current directory to the containers.

![Shared Drives](images/shared-drives.png)

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
- edit files
- more to come...

![Search Results](images/files.png)

Detailed information is [here](file-browser.md).

## Configuration File

Main menu configuration can be changed manually by editing **config.js** file. Choose **Edit Configuration** option from main menu.

More information is available [here](config-file.md).

## Extending

Extension provides an API which can be used by other extensions.

More information is available [here](extensing.md).
