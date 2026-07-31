class AppError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


class InvalidInputError(AppError):
    def __init__(self, message: str = "필수 입력값이 누락되었습니다."):
        super().__init__(400, "INVALID_INPUT", message)
