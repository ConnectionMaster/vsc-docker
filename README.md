# Docker Runner - Docker Integration for VSC

Docker Runner source available in [GitHub repository here](https://github.com/zikalino/vsc-docker). Any contributions are welcome!

You can find [detailed documentation here](https://github.com/zikalino/vsc-docker/wiki).

Please join [Visual Studio Code LinkedIn Group](https://www.linkedin.com/groups/6974311).

## How to start?

After extension is installed you will see two new categories in **EXPLORER** view.

![Search Results](images/explorer-view.png)

Click on selected container or image to display options. You can perform all the basic operations from here:

For images:



There's also a new **Docker** button available in the status bar, which you can click to display main **Docker Runner** menu.

## Search and pull images from Docker Hub

You can directly search images in Docker Hub by using **Search Images** option from the main menu.

![Search Results](images/search-results.png)

If you choose **Pull & Pin to the menu** option image will appear in the main menu. Default command line parameters are stored in **config.js** file. You can edit this file by selecting **Edit Configuration** option. Edit following line to change any required options:

      "run": "-i -t --rm --name $default-name -v $workspace:$src ubuntu sh"

## Adding Custom Menu Items

You can add most frequently used commands to the container menu.

Click on selected container and choose **Logs** from the context menu. You will see history for selected container. You can right click any command and add it to the menu.



## Configuration File

Main menu configuration can be changed manually by editing **config.js** file. Choose **Edit Configuration** option from main menu.

More information is available [here](https://github.com/zikalino/vsc-docker/wiki/Extending-Main-Menu).

## Extending

Extension provides an API which can be used by other extensions.

More information is available [here](https://github.com/zikalino/vsc-docker/wiki/Docker-Runner-API).

## Note

Please note this is an early alpha version, so it may have bugs and missing features.
However I think it can be already very useful.
I am still experimenting a lot and I am planning to add much more features in the future. 

Make sure your local drive is shared, as the extension will attempt to map current directory to the containers.

![Shared Drives](images/shared-drives.png)

