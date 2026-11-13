# Route-aware planning (Amazon Location Service V2)

The "Weather along a trip" section on **When to go** asks Amazon Location Routes V2 for a car route between two distinct cities from `stormsignal.config.json`. The server returns estimated distance and driving duration, then queries the National Weather Service at the route start, approximate middle, and end. The interface shows the weather risk and active NWS warnings at those three samples.

The screen now embeds an **interactive, zoomable OpenStreetMap street map using Leaflet**, with start/end markers, the driving route and official NWS warning-area overlays. A static offline route diagram remains available. The frontend requests OpenStreetMap tiles only when the route map is opened, with contributor attribution. Route requests and NWS lookups remain server-side; no AWS keys are exposed in the browser.

The route planner offers departure choices from now to 36 hours ahead. It uses the AWS estimated driving duration and **distance along the route polyline**, not its number of vertices, to estimate arrival at each of three points. The risk at each point is calculated against the one-hour NWS forecast window beginning at that estimated arrival. Missing future forecast coverage is Unknown, never Low. Forecast-based risk excludes active warning overlays, which are explicitly marked as **active at check time**, not predictions of future alerts. Arrival timing is approximate and can shift with traffic.

The screen also draws a geographical route-shape diagram with start/end markers and NWS warning-area shading. The backend compares **full, unsimplified route geometry** to available storm polygons and NWS warning-zone outlines. This can detect intersections missed by the three-point samples. It checks the active feeds for MI, IN, IL, OH and WI (the region of the configured city routes); if any feed or relevant zone boundary is unavailable, it explicitly reports **incomplete warning coverage**. The outline is not a street-map baselayer or turn-by-turn navigation.

## Boundaries and caveats

- **Three weather-risk samples do not cover the full route.** Official NWS warning polygons and available NWS zone outlines are intersected against the route geometry, but gaps in NWS feeds, zone boundary geometry, alert type coverage and states outside the checked region can miss warnings. Zone shapes are simplified and may be approximate; no route is called safe.
- This is not navigation, live road-closure, accident, or driving-safety advice. Route duration is an AWS routing estimate, not a promised ETA.
- This MVP supports only the catalog cities. The route origin follows the selected city (otherwise defaults to the first catalog city); destination is chosen from the other catalog cities.
- Routes are fetched only after the user presses **Check route**. Simulated NWS scenarios do not trigger real route requests.
- Weather sample failures are shown as **Unknown**, not Low; alerts are shown only when NWS returned a working alert feed.
- API Gateway throttles requests (5 per second, burst 10). Each route request calls an AWS metered Routes V2 API. See AWS Location Routes pricing; route calculation uses Car/Core.

## AWS

The Lambda's narrowly scoped permission is `geo-routes:CalculateRoutes` (the AWS operation does not use a route-calculator resource). The API route is `GET /api/route?from=kalamazoo&to=grand-rapids`. No AWS credentials are placed in the browser. The React view is under When to go.

Potential next iteration: allow arbitrary destinations and more than three forecast sample points. Current arrival estimates distribute AWS's total driving time proportionally along route distance and do not incorporate stop time, future traffic, or real-time road closures. Standard OpenStreetMap tiles require network access and follow OSM tile usage rules; the offline route diagram remains available.
