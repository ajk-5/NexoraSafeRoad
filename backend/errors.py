"""Errors raised by the services. The API turns them into
{"error": "...", "message": "..."} responses with the matching HTTP status."""


class ServiceError(Exception):
    status_code = 400

    def __init__(self, error: str, message: str):
        super().__init__(message)
        self.error = error
        self.message = message


class BadRequest(ServiceError):
    status_code = 400


class Unauthorized(ServiceError):
    status_code = 401


class Forbidden(ServiceError):
    status_code = 403


class NotFound(ServiceError):
    status_code = 404


class Conflict(ServiceError):
    status_code = 409
