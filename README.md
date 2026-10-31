# 7AM Gym & Vegan Hub — Vercel + Supabase Quickstart

## Do You Need Visual Studio?
**No!** You can upload these files directly on the GitHub website in your browser (takes 60 seconds), or use Visual Studio / VS Code if you prefer.

## Step 1: Put This Folder on GitHub (1 Minute — No Visual Studio Needed)
1. Unzip `7am_gym_vercel_app.zip` on your computer.
2. Go to https://github.com/new and create a new repository named `7am-gym-app`.
3. Click **"uploading an existing file"**, drag and drop all files/folders from the unzipped folder (`index.html`, `manifest.json`, `vercel.json`, and the `api` folder), and click **Commit changes**.

## Step 2: Deploy on Vercel (1 Minute)
1. Go to https://vercel.com/new and click **Import** next to your `7am-gym-app` repository.
2. Click **Deploy** (leave Framework Preset as **Other**).

## Step 3: Connect Free Supabase Database on Vercel (2 Minutes)
1. Inside your newly deployed project on Vercel, click the **Storage** tab at the top.
2. Click **Create Database -> Supabase -> Continue** (Free 500 MB tier, no credit card required).
3. Once Vercel finishes connecting Supabase, click **Open in Supabase** -> click **SQL Editor** on the left sidebar -> paste this 1 line and click **Run**:
   ```sql
   CREATE TABLE IF NOT EXISTS gym_state (id text primary key, data jsonb, updated_at timestamptz default now());
   ```
4. Back in Vercel, go to the **Deployments** tab -> click the **⋯** menu next to your deployment -> click **Redeploy** so your `/api/state` function picks up the new Supabase database variables.

That's it! Every time you tap a day, log a weight, or check off a meal on your phone, `/api/state.js` automatically saves it to your Supabase Postgres database!
