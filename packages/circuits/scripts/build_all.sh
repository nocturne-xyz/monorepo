#!/bin/bash

set -e

DIR=$(dirname "$0")
$DIR/spend2/build.sh
$DIR/joinsplit/build.sh
$DIR/subtreeupdate/build.sh