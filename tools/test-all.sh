#!/usr/bin/env bash

. ~/.nvm/nvm.sh

nvm use 0.6
make test

nvm use 0.8
make test

nvm use 0.10
make test
