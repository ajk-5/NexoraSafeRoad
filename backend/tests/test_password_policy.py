import unittest

from backend.password_policy import validate_new_password


class PasswordPolicyTest(unittest.TestCase):
    def test_weak_passwords_are_rejected(self):
        for password in ("short", "passwordpassword", "PASSWORD-PASSWORD", "123456789012345", "a" * 20, "abcd" * 8, " " * 20, "x" * 129):
            with self.subTest(password=password), self.assertRaises(ValueError):
                validate_new_password(password)

    def test_unique_passwords_and_passphrases_are_supported(self):
        for password in ("Three otters cross a river!", "aB3!dE6@gH9#kL2", "Une longue phrase française", "🦦" * 14 + "x"):
            with self.subTest(password=password):
                self.assertEqual(validate_new_password(password), password)
