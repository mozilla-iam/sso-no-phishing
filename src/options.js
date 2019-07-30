async function showOptions() {
  var defaultSettings = {
    "sso_urls": "https://auth-dev.mozilla.auth0.com/*,https://auth.mozilla.auth0.com/*,https://auth.allizom.org/*,https://auth.mozilla.com/*,https://passwordreset.mozilla.org/*",
    "credentials_url": "https://auth.mozilla.auth0.com/usernamepassword/login",
    "autoblock": true
  }

  function setCurrentChoice(result) {
    document.querySelector("#sso_urls").value = result.sso_urls || defaultSettings.sso_urls;
    document.querySelector("#credentials_url").value = result.credentials_url || defaultSettings.credentials_url;
    if (result.autoblock !== undefined) {
      document.querySelector("#autoblock").checked = result.autoblock;
    } else {
      document.querySelector("#autoblock").checked = defaultSettings.autoblock;
    }
  }

  function onError(error) {
    console.log(`Error: ${error}`);
  }
  var getting = browser.storage.sync.get(["sso_urls", "credentials_url", "autoblock"]);
  getting.then(setCurrentChoice, onError);
}

function saveOptions(e) {
  e.preventDefault();
  browser.storage.sync.set({
    "sso_urls": document.querySelector("#sso_urls").value,
    "credentials_url": document.querySelector("#credentials_url").value,
    "autoblock": document.querySelector("#autoblock").checked
  });
}

document.addEventListener("DOMContentLoaded", showOptions);
document.querySelector("form").addEventListener("submit", saveOptions);
