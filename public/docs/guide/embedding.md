# Embedding in a Web Page

A dashboard can be dropped into **any** HTML page - a Squarespace/WordPress "custom HTML" block,
a plain `.html` file, an internal portal page, etc. - without needing to build or install
anything. You only need to add a few lines to the page.

If none of this is familiar to you (HTML, "script tags", JSON), don't worry - just copy the
example below, swap in your own config (built with the [editor](../editor.html)), and paste it
into your page's HTML.

## The short version

Add this near the end of your page, just before the closing `</body>` tag:

```html
<link rel="stylesheet" href="https://matthewmuehlhausernrcan.github.io/geoview_dashboards/geoview-dashboards.css" />
<div id="my-dashboard" style="height: 100vh"></div>
<script src="https://matthewmuehlhausernrcan.github.io/geoview_dashboards/geoview-dashboards.js"></script>
<script>
  GeoViewDashboards.render('my-dashboard', {
    id: 'my-dashboard-config',
    title: 'My Dashboard',
    dataSources: [],
    pages: [
      {
        id: 'main',
        label: 'Dashboard',
        grid: { columns: 1, rows: 1 },
        panels: [
          {
            id: 'panel-notes',
            type: 'text',
            title: 'Notes',
            layout: { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
            content: 'Hello, dashboard!',
          },
        ],
      },
    ],
  });
</script>
```

Replace the object passed to `GeoViewDashboards.render(...)` with your own config - see
[Getting Started](guide/getting-started.md) for the overall shape, or [Full Example](guide/full-example.md)
for a complete, realistic one. The easiest way to produce one is the [editor](../editor.html):
build your dashboard there, export the config, and paste it in place of the example above.

## Piece by piece

- **The `<link>` tag** loads the dashboard's visual styles (fonts, colors, borders, etc.).
- **The `<div id="my-dashboard">`** is where the dashboard will appear - pick any id you like, as
  long as it's not already used elsewhere on the page, and use that same id below. **It must have
  an explicit height** (a pixel value like `height: 600px`, or `height: 100vh` to fill the
  browser window) - the dashboard fills 100% of this element, and a `<div>` with no height set
  has nothing to fill, so it'll end up collapsed to nothing.
- **The first `<script>` tag** loads the dashboard code itself. This makes a `GeoViewDashboards`
  object available to the rest of the page.
- **The second `<script>` tag** is where you tell it what to actually show, by calling
  `GeoViewDashboards.render(id, config)`:
  - `id` is the same id you gave the `<div>` above (as a quoted string).
  - `config` is the dashboard's configuration object - everything about what pages, panels, and
    data it should show.

## More than one dashboard on a page

`GeoViewDashboards.render(...)` can be called more than once with different `div` ids to show
more than one independent dashboard on the same page - the `<link>`/first `<script>` tag only
need to be included once no matter how many dashboards you add.

## Loading the config from a separate file

For a long config, it's often easier to keep it in its own file instead of inline in the page.
If your config is saved as its own file (e.g. `my-dashboard-config.json`, uploaded alongside your
HTML page), fetch and render it like this instead:

```html
<div id="my-dashboard" style="height: 100vh"></div>
<script src="https://matthewmuehlhausernrcan.github.io/geoview_dashboards/geoview-dashboards.js"></script>
<script>
  fetch('./my-dashboard-config.json')
    .then((response) => response.json())
    .then((config) => GeoViewDashboards.render('my-dashboard', config));
</script>
```

## Troubleshooting

- **Nothing shows up / a blank space**: open your browser's developer console (usually F12) and
  look for a red error message. If it mentions a specific config field, your config doesn't match
  the expected shape - double check it against [Getting Started](guide/getting-started.md) and
  [Panels](guide/panels.md), or re-export it from the editor.
- **The `<div>` has zero height / looks collapsed**: give it an explicit `height` as shown above.
- **Removing a dashboard**: call `GeoViewDashboards.unmount('my-dashboard')` to remove a
  previously rendered dashboard from the page (e.g. before removing its `<div>`).
