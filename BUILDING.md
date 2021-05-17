# Buliding 

To rebuild the client files, you need at least Node v14.

The source of the client files are located in `./app/client/source`

`npm run build` will compile the source files there into `./app/client/public/`. This directory is considered to be volitile and is deleted every time `npm run build` is invoked. 

WebPack is used for building and the configuration is located in `./app/scripts`

If one wishes to make changes to the javascript, the html, or the css it should be done in `./app/client/source` and then complied using `npm run build`

For development purposes, you may also utilize `npm run builddev` which will not minimize the source and allow you to more easily troubleshoot while making customizations. 
