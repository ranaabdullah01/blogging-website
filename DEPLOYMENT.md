# Deployment Guide

## Prerequisites

1. **GitHub Repository**
   - Create a new GitHub repository
   - Enable GitHub Pages in repository settings (branch: main, folder: /)

2. **Backblaze B2 Setup**
   - Create a Backblaze B2 account
   - Create a bucket (set to public)
   - Generate Application Key with write access
   - Note your: Bucket Name, Region, Key ID, Application Key

3. **Cloudflare Setup**
   - Create a Cloudflare account
   - Create a Worker
   - Set up Cloudflare Access for admin authentication

## Environment Variables for Cloudflare Worker

Set these in your Cloudflare Worker environment:

```env
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_REPO=your-username/your-repo-name
B2_BUCKET_NAME=your-bucket-name
B2_REGION=us-west-002
B2_API_KEY=your_backblaze_application_key
