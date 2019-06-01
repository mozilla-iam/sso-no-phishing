zip:
	cd src && zip -r -FS ../sso-no-phishing.zip *

install:
	bower install js-sha256
	cp bower_components/js-sha256/src/sha256.js src/sha256.js
