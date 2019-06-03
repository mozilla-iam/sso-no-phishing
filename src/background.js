/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. 
 *
 * Author: kang@insecure.ws
 * */

const themes = {
  'green_sso': {
    sso_no_phishing: true,
    colors: {
     frame: 'LimeGreen',
    }
  },
  'red_sso': {
    sso_no_phishing: true,
    colors: {
     frame: 'OrangeRed',
    }
  },
};

var userDefaultTheme;

var SSO_DOMAINS = [];
var settings = {
  "sso_urls": "https://auth-dev.mozilla.auth0.com/*,https://auth.mozilla.auth0.com/*,https://auth.allizom.org/*,https://auth.mozilla.com/*,https://passwordreset.mozilla.org/*",
  "credentials_url": "https://auth.mozilla.auth0.com/usernamepassword/login",
  "warning_msg": "Phishing has been detected!"
};

async function loadSettings() {
  tmp = await browser.storage.sync.get(["sso_urls", "credentials_url", "warning_msg"]);
  // No prior settings? keep defaults
  if (Object.keys(tmp).length === 0) {
    tmp = settings
  } else {
    settings = tmp;
  }
  var new_sso_domains = tmp.sso_urls.split(",");
  if (JSON.stringify(SSO_DOMAINS) !== JSON.stringify(new_sso_domains)) {
    SSO_DOMAINS = new_sso_domains;
    // Reregister listener with new URLs
    browser.webRequest.onBeforeRequest.removeListener(detectSSO);
    browser.webRequest.onBeforeRequest.addListener(detectSSO, {urls: SSO_DOMAINS}, ["blocking", "requestBody"]);
  }
}

// Callback from listener when window/tab changed
// Should make this not await if possible
async function colorContainer() {
  var q = await browser.tabs.query({active: true, windowId: browser.windows.WINDOW_ID_CURRENT});
  var curTab = await browser.tabs.get(q[0].id);
  if (await this.hasGreenSSO(curTab) === true) {
    this.makeGreenSSO(curTab);
  } else {
    if (userDefaultTheme !== undefined) {
      browser.theme.update(curTab.windowId, userDefaultTheme);
    }
  }
}

async function hasGreenSSO(tab) {
  if (tab.url === undefined) {
    return false;
  }
  for (i in SSO_DOMAINS) {
    if (tab.url.startsWith(SSO_DOMAINS[i].slice(0, -2))) {
      return true;
    }
  }
  return false;
}

async function makeGreenSSO(tab, theme=themes['green_sso']) {
  var tmp = await browser.theme.getCurrent(tab.windowId);
  if (tmp.sso_no_phishing === undefined) {
    userDefaultTheme = tmp;
  }
  browser.theme.update(tab.windowId, theme);
}

// Callback from listener to detect SSO logins
async function detectSSO (options) {
  let parsedUrl = new URL(options.url);
  // Capture credentials hash
  if (options.method == "POST" && parsedUrl.pathname == settings.credentials_url) {
    let postData = JSON.parse(decodeURIComponent(String.fromCharCode.apply(null,
      new Uint8Array(options.requestBody.raw[0].bytes))));
    let credentials_hash = sha256(postData.password);
    localStorage.setItem('credentials_hash', credentials_hash);
    localStorage.setItem('credentials_login', postData.username);
    delete postData.password
    delete postData
    console.log('Stored new genuine credential hash for user');
  }
  // Make tab green
  var q = await browser.tabs.query({active: true, windowId: browser.windows.WINDOW_ID_CURRENT});
  var tab = await browser.tabs.get(q[0].id);
  // set this tab/window theme and record it
  // auto remove theme on other ones
  this.makeGreenSSO(tab);
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
  loadSettings();
  colorContainer();
  if ((options.method == "POST") && (options.requestBody !== null)) {
    let parsedUrl = new URL(options.url);
    for (i in SSO_DOMAINS) {
      if ((SSO_DOMAINS[i] == parsedUrl.origin+'/*') && parsedUrl.pathname == settings.credentials_url) {
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
      var q = await browser.tabs.query({active: true, windowId: browser.windows.WINDOW_ID_CURRENT});
      var tab = await browser.tabs.get(q[0].id);
      this.makeColoredContainer(tab, themes['red_sso']);
      browser.notifications.create('phishingDetected', {
        title: 'Phishing attack blocked',
        message: settings.warning_msg,
        type: 'basic'
      });
      return { cancel: true };
    } else {
    }
  }
}

async function onSuspend() {
  // Cleanup on extension unload
  // This is necessary as otherwise this value will be set to a default theme, and the tabs.onActivated listener will in
  // turn attempt to set the theme to what was saved. Most likely also related to https://bugzilla.mozilla.org/show_bug.cgi?id=1415267
  userDefaultTheme = undefined;
}

(async function init () {
  await loadSettings();
  // See https://bugzilla.mozilla.org/show_bug.cgi?id=1415267 on why we're saving the "default" theme (which is not
  // necessarily the default but it's whatever the user has
  userDefaultTheme = await browser.theme.getCurrent();
  browser.webRequest.onBeforeRequest.addListener(detectSSO, {urls: SSO_DOMAINS}, ["blocking", "requestBody"]);
  browser.webRequest.onBeforeRequest.addListener(detectPhishing, {urls: ["<all_urls>"]}, ["blocking", "requestBody"]);
  browser.tabs.onActivated.addListener(colorContainer);
  //browser.windows.onFocusChanged.addListener(colorContainer);
  browser.runtime.onSuspend.addListener(onSuspend)
})();
