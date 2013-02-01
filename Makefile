.PHONY: all
.DEFAULT: all

all:
	/usr/bin/env npm install

publish: all
	/usr/bin/env npm publish

lint:
	tools/lint.sh

check: test
tests: test
test: lint
	tools/test.sh
