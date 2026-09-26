class DomainError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status = status
        self.code = code
        self.message = message


def not_found(resource: str):
    return DomainError(404, "NOT_FOUND", f"{resource} not found")
