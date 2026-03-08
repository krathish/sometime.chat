# Notion Calendar Booking Page - API Analysis

## Summary

The Notion Calendar booking page (`https://calendar.notion.so/meet/krathish/fxld54ofe`) makes a single primary API call to fetch all availability data. The time slots displayed in the calendar are calculated client-side from the availability ranges returned by this API.

---

## Primary API Endpoint: Get Hold/Availability Data

### Endpoint
```
POST https://calendar-api.notion.so/v2/getHold
```

### Query Parameters
- `ver`: Version string (e.g., `1.132.0+7e44a584c-1772811627`)
- `client`: Platform identifier (`web`)
- `tz`: Timezone (e.g., `America/New_York`)
- `locale`: Language locale (e.g., `en-US`)

### Request Method
**POST**

### Request Headers (Key Headers)
```json
{
  "content-type": "application/json",
  "x-timezone": "America/New_York",
  "x-notion-authenticated": "false",
  "x-client-type": "web",
  "x-client-os": "mac",
  "x-client-platform": "web",
  "origin": "https://calendar.notion.so",
  "referer": "https://calendar.notion.so/",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site"
}
```

### Request Body
```json
{
  "username": "krathish",
  "alias": "fxld54ofe",
  "timeMin": 1772341200000,
  "timeMax": 1777607999999
}
```

**Parameters:**
- `username`: The username of the calendar owner
- `alias`: The unique booking page alias/slug
- `timeMin`: Start of date range (Unix timestamp in milliseconds)
- `timeMax`: End of date range (Unix timestamp in milliseconds)

### Response Structure
```json
{
  "hold": {
    "shortId": "fxld54ofe",
    "status": "activeBookable",
    "userPrimaryTimeZone": "America/New_York",
    "timeZone": "America/New_York",
    "duration": 30,
    "timeRanges": [
      {
        "id": "AGDrq_AJE",
        "startDate": "2026-03-12T13:45:00Z",
        "endDate": "2026-03-12T14:30:00Z"
      },
      {
        "id": "4OiBO2K0jz",
        "startDate": "2026-03-12T19:00:00Z",
        "endDate": "2026-03-12T20:15:00Z"
      },
      {
        "id": "482vigbRI6",
        "startDate": "2026-03-13T14:00:00Z",
        "endDate": "2026-03-13T22:45:00Z"
      }
    ],
    "title": "Meeting with Krathish Prakash",
    "conferencingProviderName": "googleMeet",
    "senderDisplayName": "Krathish Prakash",
    "senderEmail": "krathishprakash01@gmail.com",
    "senderProfilePhotoURL": "https://lh3.googleusercontent.com/a/AEdFTp41QFIcWKgOFH2bsp-OlV2oTUwy2YW2GAIJ6fKF5sQ=s96-c",
    "customFields": [],
    "format24HourTime": true
  }
}
```

**Response Fields:**
- `shortId`: Unique identifier for the booking page
- `status`: Booking page status (`activeBookable`)
- `userPrimaryTimeZone`: Owner's primary timezone
- `timeZone`: Timezone for the booking page
- `duration`: Meeting duration in minutes
- `timeRanges`: Array of available time blocks
  - `id`: Unique identifier for the time range
  - `startDate`: Start time (ISO 8601 format, UTC)
  - `endDate`: End time (ISO 8601 format, UTC)
- `title`: Meeting title
- `conferencingProviderName`: Video conferencing provider
- `senderDisplayName`: Owner's display name
- `senderEmail`: Owner's email
- `senderProfilePhotoURL`: Owner's profile photo URL
- `customFields`: Array of custom form fields
- `format24HourTime`: Whether to use 24-hour time format

---

## How Time Slots Are Generated

**Important Finding:** Clicking on individual dates in the calendar does NOT trigger additional API calls. 

The client-side JavaScript:
1. Receives large time ranges from the `getHold` API (e.g., a 45-minute block from 13:45-14:30)
2. Breaks these ranges into smaller slots based on the `duration` field (30 minutes)
3. Displays available slots for each date in the calendar UI

For example, a time range from `14:00:00Z` to `22:45:00Z` with a 30-minute duration would be split into multiple 30-minute slots:
- 14:00 - 14:30
- 14:30 - 15:00
- 15:00 - 15:30
- ... and so on

---

## Other API Calls

### 1. Feature Gates / Experiments
```
POST https://exp.notion.so/v1/initialize
```
Used for A/B testing and feature flags (Statsig integration)

### 2. Analytics Events
```
POST https://exp.notion.so/v1/rgstr
```
Logs user events and feature gate exposures

### 3. Analytics Tracking
```
POST https://calendar-te.notion.so/2/httpapi
```
Amplitude analytics for page views and user interactions

---

## Key Insights

1. **Single API Call**: All availability data is fetched in one request when the page loads
2. **Client-Side Calculation**: Time slots are calculated on the client from the `timeRanges` array
3. **No Per-Date Requests**: Clicking on dates doesn't trigger new API calls
4. **Time Range Format**: The API returns large availability blocks, not individual slots
5. **Authentication**: The booking page is public (`x-notion-authenticated: false`)
6. **CORS Setup**: Uses `same-site` CORS with proper headers

---

## How to Replicate This API Call

### Using cURL
```bash
curl -X POST 'https://calendar-api.notion.so/v2/getHold?ver=1.132.0%2B7e44a584c-1772811627&client=web&tz=America%2FNew_York&locale=en-US' \
  -H 'content-type: application/json' \
  -H 'x-timezone: America/New_York' \
  -H 'x-notion-authenticated: false' \
  -H 'x-client-type: web' \
  -H 'x-client-os: mac' \
  -H 'x-client-platform: web' \
  -H 'origin: https://calendar.notion.so' \
  -H 'referer: https://calendar.notion.so/' \
  --data-raw '{"username":"krathish","alias":"fxld54ofe","timeMin":1772341200000,"timeMax":1777607999999}'
```

### Using JavaScript (Fetch API)
```javascript
const response = await fetch(
  'https://calendar-api.notion.so/v2/getHold?ver=1.132.0%2B7e44a584c-1772811627&client=web&tz=America%2FNew_York&locale=en-US',
  {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-timezone': 'America/New_York',
      'x-notion-authenticated': 'false',
      'x-client-type': 'web',
      'x-client-os': 'mac',
      'x-client-platform': 'web',
      'origin': 'https://calendar.notion.so',
      'referer': 'https://calendar.notion.so/'
    },
    body: JSON.stringify({
      username: 'krathish',
      alias: 'fxld54ofe',
      timeMin: 1772341200000,
      timeMax: 1777607999999
    })
  }
);

const data = await response.json();
console.log(data);
```

### Using Python (requests)
```python
import requests
import json

url = 'https://calendar-api.notion.so/v2/getHold'
params = {
    'ver': '1.132.0+7e44a584c-1772811627',
    'client': 'web',
    'tz': 'America/New_York',
    'locale': 'en-US'
}
headers = {
    'content-type': 'application/json',
    'x-timezone': 'America/New_York',
    'x-notion-authenticated': 'false',
    'x-client-type': 'web',
    'x-client-os': 'mac',
    'x-client-platform': 'web',
    'origin': 'https://calendar.notion.so',
    'referer': 'https://calendar.notion.so/'
}
body = {
    'username': 'krathish',
    'alias': 'fxld54ofe',
    'timeMin': 1772341200000,
    'timeMax': 1777607999999
}

response = requests.post(url, params=params, headers=headers, json=body)
data = response.json()
print(json.dumps(data, indent=2))
```

---

## Notes

- The `ver` parameter appears to be the app version and build timestamp
- The `timeMin` and `timeMax` parameters define the date range for availability lookup
- The API is public and doesn't require authentication for viewing availability
- The response includes all necessary information to render the booking page (title, duration, conferencing provider, etc.)
