#  SSO No Phishing

**Status:** **POC**

## How does it work?

This extension detects your logins to the genuine SSO and records a hash representation of your credentials (not
the actual credentials).

Every time you post data to a website, the extension verifies that it does not contain your SSO credentials.

If it does match the genuine SSO domains then the tab will look green.
If it does NOT match, the tab will look red and a warning will be displayed. The request will also be canceled. If this
happen you should still change your credentials, just in case.


## Security considerations

This addon does NOT and CANNOT guarantee the prevention of credentials leak. An sophisticated attacker with knowledge of
this addon will be able to BYPASS the verification.

Nevertheless, this addon will catch all common cases. Additionally, there is no known attack that currently bypass this addon.
Note that all methods that I can think of, including registering keys as they're typed, can be bypassed by an attacker
in one way or another. The best protection is common sense and a password manager that only pre-fill passwords where
needed.

Note that this addon does store your credentials using a SHA256 hash (at this time).

Finally, DO NOT ENTER YOUR CREDENTIALS MANUALLY AND ESPECIALLY NOT IF THE TAB IS NOT GREEN ;-)

## Testing

- Browse to <about:debugging>
- Enable add-on debugging if you want to
- Click "Load temporary add-on" and select the `manifest.json` file
- You can also remove or reload or debug the add-on from here.


See <https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API> for a reference.
