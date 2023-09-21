---
"@nocturne-xyz/core": patch
---

Fix op request gas edge case where odd number of notes from existing joinsplits would not be accounted for in reducing num extra joinsplits by 1 (matching odd existing note with 1 new note does not increase num JSs)
