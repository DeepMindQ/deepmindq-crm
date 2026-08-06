#!/bin/bash
# Rewrite M5 commit messages — match by original message content
set -e

MSG=$(git log -1 --format=%B | head -1)

case "$MSG" in
  "19b55fdc-05f5-4af3-89f9-d5e172954976")
    git commit --amend -m "M5 Phase 1.0: Worklog cleanup + initial M5 session setup"
    ;;
  "f52fb1dc-9fbd-4c8b-97b4-2a2dede52668")
    git commit --amend -m "M5 docs: Enterprise Readiness Audit document"
    ;;
  "634e0ddf-1851-4918-bbdb-c9b038e1f5d2")
    git commit --amend -m "M5 docs: Audit PDF generation script"
    ;;
  "3a964d9e-caa0-481c-b5eb-4fa2025db9a9")
    git commit --amend -m "M5 docs: Audit cover + capability gap assessment"
    ;;
  "d92c3848-cbdb-4395-89f0-0a9a2afd67a6")
    git commit --amend -m "M5 docs: Enterprise Readiness Audit PDF"
    ;;
  "0dec803b-0b30-46de-8b03-601ef2837e4c")
    git commit --amend -m "M5 Phase 1.5: TRUST metadata framework + Clearbit connector + enrichment route + types"
    ;;
  "bd5927a7-3542-49bd-9454-3b75a6ba452d")
    git commit --amend -m "M5 Phase 2: WOW experiences — Market Discovery, Meeting Brief, Knowledge Intelligence, Executive Brief, Financial Intelligence"
    ;;
  "163dd20a-a64c-4095-8463-ef43ac645499")
    git commit --amend -m "M5 docs: Evidence package generation script + worklog"
    ;;
  "d89e0877-34be-447c-aae2-335d92ebde10")
    git commit --amend -m "M5 docs: Phase 1-2 Execution Evidence Package PDF"
    ;;
  *)
    echo "Keeping: $MSG"
    ;;
esac
