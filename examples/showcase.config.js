/*
 * MMM-Seymour showcase configuration
 *
 * A self-contained public-safe example using MagicMirror's bundled modules,
 * MMM-pages, MMM-Seymour, and MMM-MessageCenter. Replace the coordinates with
 * your own. No personal services, credentials, or network listeners are used.
 */

var latitude = 40.7128;
var longitude = -74.006;

var config = {
  address: "localhost",
  port: 8080,
  basePath: "/",
  ipWhitelist: ["127.0.0.1", "::ffff:127.0.0.1", "::1"],
  useHttps: false,
  language: "en",
  locale: "en-US",
  timeFormat: 12,
  units: "imperial",

  modules: [
    {
      module: "alert"
    },
    {
      // Optional hardware bridge for the reference Seymour encoder wiring.
      // Requires MMM-GPIO-Notifications. Remove this block on non-Pi systems
      // or when the encoder is translated to keyboard events another way.
      module: "MMM-GPIO-Notifications",
      config: {
        "17": {
          delay: 250,
          notifications_high: [{ notification: "SEYMOUR_PRESS" }]
        },
        "22,27": {
          rotaryDelay: 80,
          delay_cw: 120,
          delay_ccw: 120,
          notifications_cw: [
            { notification: "SEYMOUR_ROTATE_LEFT" }
          ],
          notifications_ccw: [
            { notification: "SEYMOUR_ROTATE_RIGHT" }
          ]
        }
      }
    },
    {
      module: "MMM-Seymour",
      position: "fullscreen_above",
      config: {
        theme: "default",
        selectorSize: "medium",
        showLabels: true,
        enableKeyboard: true,
        enableTouch: true,
        showTouchLauncher: true,
        autoDismiss: true,
        autoDismissDelay: 4000,
        channels: [
          { label: "Clock", page: 0, thumbnail: "clock.png" },
          { label: "Calendar", page: 1, thumbnail: "calendar.png" },
          { label: "Weather", page: 2, thumbnail: "weather.png" },
          { label: "News", page: 3, thumbnail: "news.png" },
          { label: "Messages", page: 4, thumbnail: "messages.png" }
        ]
      }
    },
    {
      module: "clock",
      position: "middle_center",
      classes: "page-clock"
    },
    {
      module: "calendar",
      position: "middle_center",
      classes: "page-calendar",
      header: "Upcoming",
      config: {
        maximumEntries: 6,
        maximumNumberOfDays: 365,
        timeFormat: "absolute",
        urgency: 0,
        getRelative: 0,
        dateFormat: "ddd, MMM D",
        fullDayEventDateFormat: "ddd, MMM D",
        tableClass: "medium",
        fade: false,
        showLocation: false,
        wrapEvents: true,
        maxTitleLines: 2,
        calendars: [
          {
            symbol: "calendar-days",
            url: "https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics"
          }
        ]
      }
    },
    {
      module: "weather",
      position: "top_center",
      classes: "page-weather",
      config: {
        weatherProvider: "openmeteo",
        type: "current",
        lat: latitude,
        lon: longitude
      }
    },
    {
      module: "weather",
      position: "bottom_center",
      classes: "page-weather",
      config: {
        weatherProvider: "openmeteo",
        type: "forecast",
        lat: latitude,
        lon: longitude
      }
    },
    {
      module: "newsfeed",
      position: "middle_center",
      classes: "page-news",
      config: {
        feeds: [
          {
            title: "New York Times",
            url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"
          }
        ],
        showSourceTitle: true,
        showPublishDate: true
      }
    },
    {
      module: "MMM-MessageCenter",
      position: "middle_center",
      classes: "page-messages",
      config: {
        ui: "messages",
        displayMode: "page",
        pages: true,
        messagesPage: 4,
        showHeader: true,
        showControls: true,
        showToasts: true,
        clearAttentionWhenViewed: true,
        internalNotifications: {
          remoteControl: { enabled: true },
          weather: { enabled: false }
        },
        webhook: {
          host: "127.0.0.1",
          port: 8787,
          token: ""
        },
        images: {
          enabled: false
        }
      }
    },
    {
      module: "MMM-pages",
      config: {
        modules: [
          ["page-clock"],
          ["page-calendar"],
          ["page-weather"],
          ["page-news"],
          ["page-messages"]
        ],
        fixed: ["MMM-Seymour", "alert"],
        timings: { default: 0 }
      }
    }
  ]
};

if (typeof module !== "undefined") {
  module.exports = config;
}
