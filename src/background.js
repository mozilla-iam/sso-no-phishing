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
var browserInfo;

var SSO_DOMAINS = [];
var settings = {
  "sso_urls": "https://auth-dev.mozilla.auth0.com/*,https://auth.mozilla.auth0.com/*,https://auth.allizom.org/*,https://auth.mozilla.com/*,https://passwordreset.mozilla.org/*",
  "credentials_url": "https://auth.mozilla.auth0.com/usernamepassword/login",
  "autoblock": true
};

async function noError( test ) {
    try {
        if(typeof test === "function") return test();
        else return test || null;
    } catch (e) {
        return null;
    }
};

async function loadSettings() {
  tmp = await browser.storage.sync.get(["sso_urls", "credentials_url", "autoblock"]);
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
  if (await hasGreenSSO(curTab) === true) {
    makeGreenSSO(curTab);
  } else {
    restoreTheme(curTab);
  }
}

/*
 * requires permission management
 *
async function checkThemeInstalled() {
  let extensions = await browser.management.getAll();
  for (let extension of extensions) {
    if (extension.type === 'theme' && extension.enabled) {
      return true;
    }
  }
  return false;
}
*/

// Restore theme to browser default
// Note this is a workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1415267
// Trying to re-enabled existing user theme addons also fails (race condition?) even if you wait for them to be
// re-applied for some reason
async function restoreTheme(tab) {
  if ((userDefaultTheme !== undefined) && (Object.keys(userDefaultTheme).length > 0)) {
    browser.theme.update(tab.windowId, userDefaultTheme);
  } else {
    // While MDN says FF58+ supports all the theme stuff, in 67 at least it definitely doesnt work.
    // FF 69 (nightly atm) has it working. So in the mean time, detect what you run and adjust accordingly
    let version = browserInfo.version.match(/\d+/)[0];
    if (version < 69) {
      let current = await browser.theme.getCurrent();
      if (current.sso_no_phishing !== undefined) {
        console.log("WARNING: Firefox < 69 does not let us figure out which theme you're running correctly, so we're going to reset to the default instead. If you weren't running default, sorry!");
        browser.theme.reset();
      }
    }
  }
  // If the theme is lost for any other reason we're done here
  // because of bug 1415267 we can't call browser.theme.reset()
  // and because of another issue during addon install we also can't detect/grab the theme at install time if the user
  // check "allow addon in private window". Erm.
}

// This function takes the opportunity that it's checking you domain already
// in order to re-recording the current default theme, in case you do not support the onUpdated() listener for themes
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
  if (tab === undefined) {
    var q = await browser.tabs.query({active: true, windowId: browser.windows.WINDOW_ID_CURRENT});
    var tab = await browser.tabs.get(q[0].id);
  }
  var tmp = await browser.theme.getCurrent(tab.windowId);
  if (tmp.sso_no_phishing === undefined) {
    userDefaultTheme = tmp;
  }
  // This will generate the error "An unexpected property was found in the WebExtension manifest." but won't actually do
  // anything wrong. That's because the manifest schema validation is computed together with the browser theme and we're
  // adding a value that doesn't normally exist. In reality, it's handled like a warning.
  browser.theme.update(tab.windowId, theme);
}

// Callback from listener to detect SSO logins
async function detectSSO (options) {
  let parsedUrl = new URL(options.url);
  // Capture credentials hash
  if (settings.autoblock && options.method == "POST" && (parsedUrl.origin+parsedUrl.pathname) == settings.credentials_url) {
    let postData = JSON.parse(decodeURIComponent(String.fromCharCode.apply(null,
      new Uint8Array(options.requestBody.raw[0].bytes))));
    let salt = btoa(window.crypto.getRandomValues(new Uint32Array(6)).toString());
    let credentials_hash = sha256(postData.password + salt);
    localStorage.setItem('credentials_salt', salt);
    localStorage.setItem('credentials_hash', credentials_hash);
    localStorage.setItem('credentials_login', postData.username);
    delete postData.password
    delete postData
    console.log('Stored new genuine credential hash for user');
  }
  colorContainer();
}

// Callback from listener to detect phishing
// Performance critical (takes all urls, blocking mode, so it gotta be fast)
async function detectPhishing (options) {
  loadSettings();
  // autoblock deactivated?
  if (settings.autoblock === false) {
    return
  }
  colorContainer();
  if ((options.method == "POST") && (options.requestBody !== null)) {
    let parsedUrl = new URL(options.url);
    for (i in SSO_DOMAINS) {
      if ((SSO_DOMAINS[i] == parsedUrl.origin+'/*') && (parsedUrl.origin+parsedUrl.pathname) == settings.credentials_url) {
        // This is our genuine domain, don't block this
        return
      }
    }
    var creds = localStorage.getItem('credentials_hash');
    var salt = localStorage.getItem('credentials_salt');
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
    var blocked = false;
    for (index in postData) {
      if ((sha256(postData[index] + salt) == creds) || (sha256(index + salt) == creds)) {
        blocked = true;
        console.log("WARNING: Credentials found in untrusted POST - cancelling request for", options.url);
        var q = await browser.tabs.query({active: true, windowId: browser.windows.WINDOW_ID_CURRENT});
        browser.tabs.update(q[0].id, {active: true, url: "/warning.html"});
      }
    }
  }
  return { cancel: blocked};
}

async function themeUpdated(info) {
  // This allow us to record when someone else/user changed the theme so that we re-apply their theme after we put ours
  // Part of the workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1415267
  if ((info.theme.sso_no_phishing === undefined) && (Object.keys(info.theme).length > 0)) {
    userDefaultTheme = info.theme;
  }
}

(async function init () {
  await loadSettings();
  // See https://bugzilla.mozilla.org/show_bug.cgi?id=1415267 on why we're saving the "default" theme (which is not
  // necessarily the default but it's whatever the user has
  // userDefaultTheme = await browser.theme.getCurrent();
  browserInfo = await browser.runtime.getBrowserInfo();
  browser.webRequest.onBeforeRequest.addListener(detectSSO, {urls: SSO_DOMAINS}, ["blocking", "requestBody"]);
  browser.webRequest.onBeforeRequest.addListener(detectPhishing, {urls: ["<all_urls>"]}, ["blocking", "requestBody"]);
  browser.theme.onUpdated.addListener(themeUpdated);
  browser.tabs.onActivated.addListener(colorContainer);
  browser.windows.onFocusChanged.addListener(colorContainer);
})();
