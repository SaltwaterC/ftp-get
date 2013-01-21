all:
	/usr/bin/env npm install

publish: all
	/usr/bin/env npm publish

lint:
	tools/lint.sh

test: lint
	tools/test.sh
