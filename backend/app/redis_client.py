import os
import redis

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.Redis.from_url(redis_url, decode_responses=True)

def increment_operation_counter(operation_type: str):
    """Atomically increment a counter in Redis."""
    try:
        redis_client.incr(f"metrics:total_{operation_type.lower()}_validated")
    except redis.RedisError:
        pass

def get_operation_counters() -> dict:
    """Fetch the atomic counters from Redis."""
    try:
        keys = redis_client.keys("metrics:total_*_validated")
        if not keys:
            return {}
        values = redis_client.mget(keys)
        return {k.replace("metrics:total_", "").replace("_validated", ""): int(v or 0) for k, v in zip(keys, values)}
    except redis.RedisError:
        return {}
