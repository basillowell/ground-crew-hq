# Ground Crew HQ Deployment Notes

## Vercel SPA Routing
Ground Crew HQ is a Vite + React Router SPA. Direct route refreshes are handled by a rewrite in [vercel.json](/C:/Users/basil/OneDrive/Documents/New%20project/vercel.json):

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

This ensures URLs like `/app/settings` and `/app/employees` load the app shell instead of returning a route-level 404.

## Preview “Forbidden” Thumbnail
Vercel deployment preview cards can show `Forbidden` when Deployment Protection or preview authentication is enabled. That thumbnail behavior is separate from React Router configuration.

If app routes load when you open the deployment URL directly, SPA routing is working and the thumbnail warning is an access-protection artifact.

## Verify
When deployment protection permits access, confirm direct navigation works for:
- `/`
- `/app/settings`
- `/app/employees`
