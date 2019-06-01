async function showOptions() {
  var defaultSettings = {
    "sso_urls": "https://auth-dev.mozilla.auth0.com/*,https://auth.mozilla.auth0.com/*,https://auth.allizom.org/*,https://auth.mozilla.com/*,https://passwordreset.mozilla.org/*",
    "credentials_url": "https://auth.mozilla.auth0.com/usernamepassword/login",
    "warning_msg": "Phishing has been detected!"
  }

  function setCurrentChoice(result) {
    document.querySelector("#sso_urls").value = result.sso_urls || defaultSettings.sso_urls;
    document.querySelector("#credentials_url").value = result.credentials_url || defaultSettings.credentials_url;
    document.querySelector("#warning_msg").value = result.warning_msg || defaultSettings.warning_msg;
  }

  function onError(error) {
    console.log(`Error: ${error}`);
  }
  var getting = browser.storage.sync.get(["sso_urls", "credentials_url", "warning_msg"]);
  getting.then(setCurrentChoice, onError);
}

function saveOptions(e) {
  e.preventDefault();
  browser.storage.sync.set({
    "sso_urls": document.querySelector("#sso_urls").value,
    "credentials_url": document.querySelector("#credentials_url").value,
    "warning_msg": document.querySelector("#warning_msg").value
  });
}

document.addEventListener("DOMContentLoaded", showOptions);
document.querySelector("form").addEventListener("submit", saveOptions);
