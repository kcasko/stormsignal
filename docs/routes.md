# Route-aware planning (Amazon Location Service V2)

The "Weather along a trip" section on **When to go** asks Amazon Location Routes V2 for a car route between two distinct cities from `stormsignal.config.json`. The server returns estimated distance and driving duration, then queries the National Weather Service at the route start, approximate middle, and end. The interface shows the weather risk and active NWS warnings at those three samples.

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

Potential next iteration: add a street-map baselayer and route departure-time-aware forecast checks (current results use the latest forecast rather than predicting conditions when the driver reaches each point).
