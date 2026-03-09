# Sometime.Chat

See when everyone's free. A scheduling tool that finds common free time across multiple people's calendars.

Paste scheduling links from Calendly, Cal.com, Google Calendar, or Notion Calendar — or add availability manually — and instantly see when everyone overlaps.

## Features

- **Multiple input methods** — paste a scheduling link, select times on a calendar, enter slots manually, or connect Google Calendar directly
- **Smart parsing** — automatically extracts availability from Calendly, Cal.com, Google ICS, and Notion Calendar links
- **Timezone awareness** — detects participant timezones, shows local times, and highlights comfortable meeting windows
- **Overlap detection** — finds common free slots with level indicators (e.g. "3 of 4 free")
- **Week calendar view** — visualise availability and results on a drag-to-select weekly grid
- **Mac OS X Aqua design** — nostalgic Jaguar-era interface with gel buttons, pinstripe textures, and traffic-light window chrome

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to get started.

## Tech Stack

- **Framework**: Next.js (App Router)
- **UI**: React, Framer Motion, Sonner
- **Database**: Drizzle ORM + libSQL
- **Auth**: Google OAuth (for calendar import)
- **Styling**: Tailwind CSS v4

## Author

Built by [Krathish](http://krathish.com).
