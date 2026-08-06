#!/usr/bin/env python3
"""
Rewrite main: replace d2f1239 + e69cef9 chain with single clean commit.
- d2f1239 has the secret (tree includes scripts/set-github-secrets.js)
- e69cef9 removes the secret (tree without it)
We graft e69cef9's tree directly onto 171ef4d, then replay all commits after e69cef9.
"""
import subprocess, os, sys

os.chdir("/home/z/my-project")

BAD = "d2f1239"
CLEAN = "e69cef9"  # removes the secret
ANCHOR = "171ef4d"  # parent of bad commit

# Verify the chain
cat_bad = subprocess.run(["git", "cat-file", "-p", BAD], capture_output=True, text=True)
cat_clean = subprocess.run(["git", "cat-file", "-p", CLEAN], capture_output=True, text=True)

print(f"Bad commit tree: {cat_bad.stdout.split()[1]}")
print(f"Clean commit tree: {cat_clean.stdout.split()[1]}")
print(f"Anchor: {ANCHOR}")

# Get clean commit's tree
clean_tree = cat_clean.stdout.split("\n")[0].split()[1]

# Get clean commit's message
lines = cat_clean.stdout.strip().split("\n")
blank_idx = next(i for i, l in enumerate(lines) if l == "")
clean_message = "\n".join(lines[blank_idx+1:])
print(f"Clean message: {clean_message.strip()}")

# Get all commits after CLEAN to HEAD
result = subprocess.run(
    ["git", "rev-list", "--reverse", f"{CLEAN}..HEAD"],
    capture_output=True, text=True
)
commits = [c.strip() for c in result.stdout.strip().split("\n") if c.strip()]
print(f"Commits to replay after clean: {len(commits)}")

env_override = {
    "GIT_AUTHOR_NAME": "Z User",
    "GIT_AUTHOR_EMAIL": "z@container",
    "GIT_COMMITTER_NAME": "Z User",
    "GIT_COMMITTER_EMAIL": "z@container",
}

full_env = {**os.environ, **env_override}

# Step 1: Create grafted commit (clean's tree on anchor's parent)
r = subprocess.run(
    ["git", "commit-tree", clean_tree, "-p", ANCHOR, "-m", clean_message],
    capture_output=True, text=True, env=full_env
)
if r.returncode != 0:
    print(f"ERROR: {r.stderr}")
    sys.exit(1)
parent = r.stdout.strip()
print(f"Grafted clean commit: {parent}")

# Step 2: Replay remaining commits
for i, commit in enumerate(commits):
    cat = subprocess.run(["git", "cat-file", "-p", commit], capture_output=True, text=True)
    lines = cat.stdout.strip().split("\n")
    tree = lines[0].split()[1]
    
    blank_idx = next((j for j, l in enumerate(lines) if l == ""), None)
    if blank_idx is not None:
        message = "\n".join(lines[blank_idx+1:])
    else:
        message = lines[0]
    
    r = subprocess.run(
        ["git", "commit-tree", tree, "-p", parent, "-m", message],
        capture_output=True, text=True, env=full_env
    )
    if r.returncode != 0:
        print(f"ERROR at commit {i}: {r.stderr}")
        sys.exit(1)
    
    new_hash = r.stdout.strip()
    
    # Show original message first line
    orig_msg = message.split("\n")[0][:60]
    print(f"  [{i+1}/{len(commits)}] {orig_msg} -> {new_hash[:8]}")
    parent = new_hash

print(f"\nNew main HEAD: {parent}")
subprocess.run(["git", "update-ref", "refs/heads/main", parent])
print("main branch updated")

# Verify bad commit's tree is NOT in history
result = subprocess.run(
    ["git", "log", "--oneline", "-15", "main"],
    capture_output=True, text=True
)
print("\nNew history:")
print(result.stdout)

# Verify d2f1239 is not an ancestor
result = subprocess.run(
    ["git", "merge-base", "--is-ancestor", BAD, "main"],
    capture_output=True, text=True
)
if result.returncode == 0:
    print(f"WARNING: {BAD} is still an ancestor of main!")
else:
    print(f"Confirmed: {BAD} is NOT in main history")
