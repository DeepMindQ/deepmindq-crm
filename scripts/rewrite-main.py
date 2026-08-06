#!/usr/bin/env python3
"""
Rewrite git history: remove commit d2f1239 from main branch.
Replay all commits after 171ef4d (skipping d2f1239) with clean parent chain.
"""
import subprocess
import sys

BAD_COMMIT = "d2f1239"
ANCHOR_COMMIT = "171ef4d"  # parent of bad commit

# Get all commits from ANCHOR to HEAD (exclusive of ANCHOR)
result = subprocess.run(
    ["git", "rev-list", "--reverse", f"{ANCHOR_COMMIT}..HEAD"],
    capture_output=True, text=True, cwd="/home/z/my-project"
)
commits = [c.strip() for c in result.stdout.strip().split("\n") if c.strip() and c.strip() != BAD_COMMIT]

print(f"Total commits to replay: {len(commits)}")
print(f"Excluding: {BAD_COMMIT}")
print(f"Anchor parent: {ANCHOR_COMMIT}")

if not commits:
    print("No commits to replay")
    sys.exit(0)

# Verify bad commit is excluded
if BAD_COMMIT in commits:
    print(f"ERROR: Bad commit {BAD_COMMIT} still in list!")
    sys.exit(1)

# Replay commits using plumbing
parent = ANCHOR_COMMIT
env = {
    "GIT_AUTHOR_NAME": "Z User",
    "GIT_AUTHOR_EMAIL": "z@container",
    "GIT_COMMITTER_NAME": "Z User",
    "GIT_COMMITTER_EMAIL": "z@container",
}

for i, commit in enumerate(commits):
    # Get commit info
    cat = subprocess.run(
        ["git", "cat-file", "-p", commit],
        capture_output=True, text=True, cwd="/home/z/my-project"
    )
    lines = cat.stdout.strip().split("\n")
    
    # Extract message (everything after blank line)
    blank_idx = None
    for j, line in enumerate(lines):
        if line == "":
            blank_idx = j
            break
    
    if blank_idx is None:
        message = lines[0]
    else:
        message = "\n".join(lines[blank_idx+1:])
    
    # Get tree
    tree = lines[0].split()[1]
    
    # Create new commit with same tree and message, but new parent
    if i == 0:
        # First commit: parent is ANCHOR_COMMIT
        cmd = ["git", "commit-tree", tree, "-p", parent, "-m", message]
    else:
        cmd = ["git", "commit-tree", tree, "-p", parent, "-m", message]
    
    result = subprocess.run(
        cmd, capture_output=True, text=True, cwd="/home/z/my-project", env={**dict(__import__('os').environ), **env}
    )
    
    if result.returncode != 0:
        print(f"ERROR creating commit {i}: {result.stderr}")
        sys.exit(1)
    
    new_commit = result.stdout.strip()
    parent = new_commit
    
    # Show short hash for progress
    short = subprocess.run(
        ["git", "log", "--oneline", "-1", commit],
        capture_output=True, text=True, cwd="/home/z/my-project"
    )
    print(f"  [{i+1}/{len(commits)}] {short.stdout.strip()} -> {new_commit[:8]}")

print(f"\nFinal commit (new main): {parent}")

# Update main branch ref
subprocess.run(
    ["git", "update-ref", "refs/heads/main", parent],
    cwd="/home/z/my-project"
)
print("main branch updated")

# Show new history
subprocess.run(
    ["git", "log", "--oneline", "-5", "main"],
    cwd="/home/z/my-project"
)
