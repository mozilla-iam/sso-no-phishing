#  SSO No Phishing

**Status:** **POC**

## How does it work?

This extension detects your logins to the genuine Mozilla IAM SSO and records a hash representation of your credentials (not
the actual credentials).
Every time you post data to a website, the extension verifies that it does not contain your Mozilla IAM SSO credentials.
If it does and does not match the genuine Mozilla IAM SSO domains, it will warn you that this is probably a phishing
attack before continuing (you can choose to ignore the warning at your own risk)

## Testing

- Browse to <about:debugging>
- Enable add-on debugging if you want to
- Click "Load temporary add-on" and select the `manifest.json` file
- You can also remove or reload or debug the add-on from here.


See <https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API> for a reference.
