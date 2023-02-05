#!/bin/sh
APPROOT=/opt/legion_whip
. $APPROOT/prod_secrets.env

export PATH=$PATH:/nix/store/zarkkci85li75a3rk1ssalcr3zvpn2j1-nodejs-18.9.1/bin
$APPROOT/node_modules/.bin/tsx $APPROOT/src/main.ts
