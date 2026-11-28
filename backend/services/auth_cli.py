"""
backend/services/auth_cli.py - Safe CLI helper for local bootstrap of an initial
AI Bridge X Administrator (or Project Manager) without hardcoding passwords in code.

Usage:
  python -m backend.services.auth_cli create-admin
"""

import argparse
import getpass
import sys

from backend.services.auth_service import (
    AuthValidationError,
    DuplicateAccountError,
    create_user_account,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="AI Bridge X User & Role Bootstrap CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    create_cmd = sub.add_parser("create-admin", help="Create a local Administrator account")
    create_cmd.add_argument("--username", help="Username (3-40 alphanumeric/._- chars)")
    create_cmd.add_argument("--email", help="Valid email address")
    create_cmd.add_argument("--full-name", default="Platform Administrator", help="Full display name")

    args = parser.parse_args()
    if args.command == "create-admin":
        username = (args.username or input("Administrator username: ")).strip()
        email = (args.email or input("Administrator email: ")).strip()
        full_name = (args.full_name or "Platform Administrator").strip()
        password = getpass.getpass("Password (min 8 chars with letters & digits): ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            print("Error: Passwords do not match.", file=sys.stderr)
            return 1
        try:
            user = create_user_account(
                username=username,
                email=email,
                full_name=full_name,
                password=password,
                role="administrator",
            )
            print(
                f"Created Administrator '{user['username']}' ({user['email']}) "
                f"with ID {user['id']}."
            )
            return 0
        except (AuthValidationError, DuplicateAccountError) as exc:
            print(f"Error: {exc}", file=sys.stderr)
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
