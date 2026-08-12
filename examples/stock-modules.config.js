/*
 * MMM-Seymour starter configuration
 *
 * This example uses only modules bundled with MagicMirror, plus MMM-pages and
 * MMM-Seymour. Replace the latitude and longitude with your location.
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
          { label: "News", page: 3, thumbnail: "news.png" }
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
            // Public US holidays calendar maintained by Google. This endpoint
            // is used instead of Calendar Labs, which intermittently rejects
            // requests from MagicMirror installations.
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
      module: "MMM-pages",
      config: {
        modules: [
          ["page-clock"],
          ["page-calendar"],
          ["page-weather"],
          ["page-news"]
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
