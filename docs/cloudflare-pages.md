# Deploying to Cloudflare Pages

Bean Bazaar builds to plain static files in `dist/`, so Cloudflare Pages can host it for free. Pages builds and deploys every push to `main`, and gives each pull request its own preview link.

The site lives at `bean-bazaar.calvinphuah.com`.

## 1. Create the Pages project

1. Sign in at https://dash.cloudflare.com.
2. Go to **Workers & Pages**, then **Create**, then the **Pages** tab, then **Connect to Git**.
3. Allow Cloudflare to read the `Calvinphuah/bean-bazaar-play` GitHub repo, then pick it.
4. Fill in the build settings:
   - **Project name:** `bean-bazaar-play`. This gives the site the address `bean-bazaar-play.pages.dev`.
   - **Production branch:** `main`
   - **Framework preset:** `Vue`, or `None`.
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variable:** `NODE_VERSION` = `22`
5. Press **Save and Deploy**. Wait for the first build to finish, then open `https://bean-bazaar-play.pages.dev` to check that the game loads.

## 2. Point your subdomain at it

Add the custom domain in Pages **before** you create the DNS record. A CNAME made first can give a 522 error until Pages knows about the domain.

1. In the Pages project, open **Custom domains**, then **Set up a custom domain**.
2. Enter `bean-bazaar.calvinphuah.com`, then **Continue**.

Then pick the case that fits your domain.

### Your domain's DNS is already on Cloudflare

Cloudflare offers to add the record for you. Press **Activate domain**. It creates this record:

| Type  | Name   | Target                       | Proxy   |
|-------|--------|------------------------------|---------|
| CNAME | `bean-bazaar` | `bean-bazaar-play.pages.dev` | Proxied |

### Your domain's DNS is somewhere else

Use this path if your registrar or another DNS host manages your domain's records.

1. Log in where your DNS records live.
2. Add this record:

| Type  | Name / Host | Value / Target                | TTL  |
|-------|-------------|-------------------------------|------|
| CNAME | `bean-bazaar` | `bean-bazaar-play.pages.dev`  | Auto |

3. Back in Pages, press **Check DNS records**. The domain turns **Active** once Cloudflare sees the record. This usually takes a few minutes, and can take up to a day.

Cloudflare sets up HTTPS for the subdomain by itself.

## 3. Check it

- Open `https://bean-bazaar.calvinphuah.com`, start a game, make a move, and reload the page. The game should pick up where you left it.
- Each push to `main` deploys again. Watch the build log under **Deployments** in the Pages project.
