"""In-process serialisation for the few read-check-write sequences that must not interleave
(confirming a donation, taking the last event slot, recording fund utilisation).

On PostgreSQL we additionally take row locks (SELECT ... FOR UPDATE); SQLite has no row locks,
so this lock is what protects the default lab deployment (single process).
"""
import threading

critical_section = threading.RLock()
