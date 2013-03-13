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
test: all lint
	tools/test.sh

test-all:
	tools/test-all.sh
