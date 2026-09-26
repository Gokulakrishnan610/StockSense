import asyncio
import json
from typing import Any

_queues: list[asyncio.Queue] = []
_loop = None

def broadcast(event_type: str, data: dict[str, Any]):
    message = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
    if _loop:
        for q in _queues:
            _loop.call_soon_threadsafe(q.put_nowait, message)

async def event_generator():
    global _loop
    _loop = asyncio.get_running_loop()
    q = asyncio.Queue()
    _queues.append(q)
    try:
        while True:
            message = await q.get()
            yield message
    except asyncio.CancelledError:
        pass
    finally:
        _queues.remove(q)
