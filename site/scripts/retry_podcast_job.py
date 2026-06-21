#!/usr/bin/env python3
import argparse
import json
import time
import urllib.request

BASE = "http://localhost:5055"


def http_get(url: str):
    with urllib.request.urlopen(url) as r:
        return json.loads(r.read().decode("utf-8"))


def http_post(url: str):
    req = urllib.request.Request(url, method="POST")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode("utf-8"))


def latest_failed_episode_id():
    eps = http_get(f"{BASE}/api/podcasts/episodes")
    for e in eps:
        if e.get("job_status") == "failed":
            return e["id"], e.get("name")
    raise RuntimeError("No failed episode found")


def main():
    ap = argparse.ArgumentParser(description="Retry a failed podcast episode and wait for completion")
    ap.add_argument("--episode-id", help="Episode ID to retry (default: latest failed)")
    ap.add_argument("--poll-seconds", type=int, default=3)
    ap.add_argument("--timeout-seconds", type=int, default=900)
    args = ap.parse_args()

    if args.episode_id:
        episode_id = args.episode_id
        episode_name = None
    else:
        episode_id, episode_name = latest_failed_episode_id()

    retry = http_post(f"{BASE}/api/podcasts/episodes/{episode_id}/retry")
    job_id = retry.get("job_id")
    if not job_id:
        raise RuntimeError(f"Retry did not return job_id: {retry}")

    print(json.dumps({
        "episode_id": episode_id,
        "episode_name": episode_name,
        "job_id": job_id,
        "status": "submitted"
    }, ensure_ascii=False))

    elapsed = 0
    while elapsed <= args.timeout_seconds:
        st = http_get(f"{BASE}/api/podcasts/jobs/{job_id}")
        status = st.get("status")
        print(f"poll: {status}")
        if status in ("completed", "failed"):
            print(json.dumps(st, ensure_ascii=False, indent=2))
            return
        time.sleep(args.poll_seconds)
        elapsed += args.poll_seconds

    print(json.dumps({"job_id": job_id, "status": "timeout"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
