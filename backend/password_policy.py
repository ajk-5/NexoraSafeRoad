"""Password rules for creation and password changes; existing logins remain compatible."""
MIN_PASSWORD_LENGTH = 15
MAX_PASSWORD_LENGTH = 128
PASSWORD_REQUIREMENTS = "Use 15–128 characters. Avoid common passwords and repeated patterns."
COMMON_PASSWORDS = {
    "passwordpassword", "password123456789", "123456789012345", "12345678901234567890",
    "qwertyuiopasdfgh", "qwertyuiop123456", "letmeinletmeinletmein",
    "correcthorsebatterystaple", "iloveyouiloveyou", "adminadminadmin",
    "saferoadsaferoad", "saferoad123456789",
}


def validate_new_password(password: str) -> str:
    compact = "".join(c for c in password.casefold() if c.isalnum())
    repeated = any(password == password[:size] * (len(password) // size) for size in range(1, 5))
    if (not MIN_PASSWORD_LENGTH <= len(password) <= MAX_PASSWORD_LENGTH
            or not compact or compact in COMMON_PASSWORDS or repeated):
        raise ValueError(PASSWORD_REQUIREMENTS)
    return password
