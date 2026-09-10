from __future__ import annotations

from dataclasses import dataclass

from fastapi import Request
from fastapi.responses import JSONResponse


@dataclass
class OrbitError(Exception):
    status_code: int
    code: str
    message: str
    details: dict | None = None


async def orbit_error_handler(request: Request, exc: OrbitError) -> JSONResponse:
    trace_id = getattr(request.state, "trace_id", None)
    payload = {
        "error": {
            "code": exc.code,
            "message": exc.message,
            "details": exc.details,
            "trace_id": trace_id,
        }
    }
    return JSONResponse(status_code=exc.status_code, content=payload)


def bad_request(code: str, message: str, details: dict | None = None) -> OrbitError:
    return OrbitError(400, code, message, details)


def not_found(code: str, message: str) -> OrbitError:
    return OrbitError(404, code, message)


def conflict(code: str, message: str, details: dict | None = None) -> OrbitError:
    return OrbitError(409, code, message, details)
