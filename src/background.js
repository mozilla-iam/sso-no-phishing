const SSO_DOMAINS = [
  "https://auth-dev.mozilla.auth0.com/*",
  "https://auth.mozilla.auth0.com/*",
  "https://auth.allizom.org/*",
  "https://auth.mozilla.com/*"
];

const SSO_LDAP_CREDENTIALS_URL = "/usernamepassword/login";

// Callback from listener to detect SSO logins
async function detectSSO (options) {
  let parsedUrl = new URL(options.url);
  // Capture credentials hash
  if (options.method == "POST" && parsedUrl.pathname == SSO_LDAP_CREDENTIALS_URL) {
    let postData = JSON.parse(decodeURIComponent(String.fromCharCode.apply(null,
      new Uint8Array(options.requestBody.raw[0].bytes))));
    let credentials_hash = sha256(postData.password);
    localStorage.setItem('credentials_hash', credentials_hash);
    localStorage.setItem('credentials_login', postData.username);
    delete postData.password
    delete postData
    console.log('Stored new genuine credential hash for user');
  }
}

var traverse = function(o, fn) {
  for (var i in o) {
    fn.apply(this,[i,o[i]]);  
    if (o[i] !== null && typeof(o[i])=="object") {
      traverse(o[i], fn);
    }
  }
}

// Callback from listener to detect phishing
// Performance critical (takes all urls, blocking mode, so it gotta be fast)
async function detectPhishing (options) {
  if ((options.method == "POST") && (options.requestBody !== null)) {
    let parsedUrl = new URL(options.url);
    for (i in SSO_DOMAINS) {
      if ((SSO_DOMAINS[i] == parsedUrl.origin+'/*') && parsedUrl.pathname == SSO_LDAP_CREDENTIALS_URL) {
        // This is our genuine domain, don't block this
        return
      }
    }
    var creds = localStorage.getItem('credentials_hash');
    if (creds == null) {
      console.log("Did not record genuine credential hash yet, can't find phishing attacks yet");
      return
    }

    try {
      var postData = JSON.parse(decodeURIComponent(String.fromCharCode.apply(null,
        new Uint8Array(options.requestBody.raw[0].bytes))));
    } catch {
      var postData = options.requestBody.formData;
    }

    // Check for credentials data
    //var res = await checkForCredentials(postData);
    var res = false;
    traverse(postData, function(k,v) {
      if ((sha256(k) == creds) || (sha256(v) == creds)) { 
        console.log("WARNING: Credentials found in untrusted POST - cancelling request for", options.url);
        res = true;
      }
    // debug matches  console.log(sha256(k), sha256(v), creds);
    })

    if (res) {
      browser.notifications.create('phishingDetected', {
        title: 'Phishing attack blocked',
        message: 'A website that claims to be your genuine SSO website has attempted to gather your credentials. Please contact <a href="mailto:infosec@mozilla.com">infosec@mozilla.com</a> immediately. Thanks!',
        type: 'basic'
      }); // send this to mozdef automatically
      return { cancel: true };
    } else {
    }
  }
}

(async function init () {
  browser.webRequest.onBeforeRequest.addListener(detectSSO, {urls: SSO_DOMAINS}, ["blocking", "requestBody"]);
  browser.webRequest.onBeforeRequest.addListener(detectPhishing, {urls: ["<all_urls>"]}, ["blocking", "requestBody"]);
})();
