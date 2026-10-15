"""One error envelope for the whole API, so the frontend has a single shape to handle:

    {
      "detail": "Human readable message",
      "code": "MACHINE_READABLE_CODE",
      "errors": [{"field": "amount", "message": "..."}]     # only for validation errors
    }
"""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("vdms")


class AppError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        errors: list[dict] | None = None,
        headers: dict[str, str] | None = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.errors = errors
        self.headers = headers


def bad_request(code: str, message: str, field: str | None = None) -> AppError:
    errors = [{"field": field, "message": message}] if field else None
    return AppError(400, code, message, errors)


def not_found(what: str) -> AppError:
    return AppError(404, "NOT_FOUND", f"{what} not found")


def conflict(code: str, message: str) -> AppError:
    return AppError(409, code, message)


def forbidden(message: str = "You do not have permission to perform this action") -> AppError:
    return AppError(403, "FORBIDDEN", message)


def unauthorized(message: str = "Authentication required", code: str = "NOT_AUTHENTICATED") -> AppError:
    return AppError(401, code, message, headers={"WWW-Authenticate": "Bearer"})


def _body(detail: str, code: str, errors: list[dict] | None = None) -> dict:
    body: dict = {"detail": detail, "code": code}
    if errors:
        body["errors"] = errors
    return body


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return JSONResponse(
            status_code=exc.status_code,
            content=_body(exc.message, exc.code, exc.errors),
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError):
        errors = []
        for err in exc.errors():
            loc = [str(p) for p in err["loc"]]
            if loc and loc[0] in ("body", "query", "path", "header"):
                loc = loc[1:]
            msg = err["msg"]
            if msg.startswith("Value error, "):
                msg = msg[len("Value error, ") :]
            errors.append({"field": ".".join(loc) or None, "message": msg})
        return JSONResponse(status_code=422, content=_body("Validation failed", "VALIDATION_ERROR", errors))

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException):
        code = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}.get(exc.status_code, f"HTTP_{exc.status_code}")
        return JSONResponse(
            status_code=exc.status_code,
            content=_body(str(exc.detail), code),
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        log.exception("Unhandled error", exc_info=exc)
        return JSONResponse(status_code=500, content=_body("Internal server error", "INTERNAL_ERROR"))
