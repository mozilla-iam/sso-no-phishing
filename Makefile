zip: lint
	cd src && zip -r -FS ../sso-no-phishing.zip *

lint:
	web-ext -s src lint
install:
	bower install js-sha256
	cp bower_components/js-sha256/src/sha256.js src/sha256.js

.PHONY: lint zip
