from collections import deque
from datetime import datetime, timezone
from typing import Any

event_log: deque[dict[str, Any]] = deque(maxlen=100)


def append_event(payload: dict[str, Any]) -> None:
    event_log.appendleft({**payload, "processed_at": datetime.now(timezone.utc).isoformat()})
