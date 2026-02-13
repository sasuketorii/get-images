# Privacy Policy - すしの手 (Sushi no Te)

Last updated: 2026-02-13

## Overview

「すしの手」(Sushi no Te) is a Chrome extension that detects images on web pages and allows users to download selected images in bulk. This privacy policy explains how the extension handles user data.

## Data Collection

This extension does **not** collect, store, transmit, or share any personal data or user information.

Specifically, this extension:

- Does **not** collect personally identifiable information
- Does **not** collect health information
- Does **not** collect financial or payment information
- Does **not** collect authentication information
- Does **not** collect personal communications
- Does **not** collect location information
- Does **not** collect web browsing history
- Does **not** collect user activity data
- Does **not** collect website content

## How the Extension Works

1. **Image Detection**: When the user clicks the "Scan" button, the extension injects a content script into the active tab to detect image elements (e.g., `<img>`, CSS `background-image`). This data is processed locally in the browser and is never transmitted to any external server.

2. **Image Download**: Selected images are downloaded directly from their original URLs to the user's local device using Chrome's built-in download API. No data passes through any intermediary server.

3. **Local Storage**: The extension uses `localStorage` only to persist the user's theme preference (light/dark mode). No other data is stored.

## Permissions

The extension requires the following permissions:

| Permission | Purpose |
|-----------|---------|
| `activeTab` | Access the active tab to detect images |
| `scripting` | Inject content script for image detection |
| `downloads` | Save selected images to the user's device |
| `sidePanel` | Display the extension's UI in Chrome's side panel |
| `tabs` | Communicate with the active tab |
| Host permissions | Access any web page for image detection and download |

## Third-Party Services

This extension does not use any third-party services, analytics, or tracking tools.

## Data Security

All processing occurs locally within the user's browser. No data is transmitted to external servers.

## Changes to This Policy

Any updates to this privacy policy will be reflected on this page with an updated date.

## Contact

If you have questions about this privacy policy, please open an issue at:
https://github.com/sasuketorii/get-images/issues
