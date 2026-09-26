import smtplib

import pytest

from app.config import get_settings
from app.errors import DomainError
from app.services.mailer import send_reset_code


def test_smtp_transport(monkeypatch):
    settings = get_settings()
    for name, value in {
        "smtp_host": "smtp.example.com",
        "smtp_starttls": True,
        "smtp_username": "test-user",
    }.items():
        monkeypatch.setattr(settings, name, value)
    calls = []

    class SMTP:
        def __init__(self, host, port, timeout):
            calls.append(("connect", host, port, timeout))

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def starttls(self, context):
            calls.append(("tls", context.check_hostname))

        def login(self, username, password):
            calls.append(("login", username))

        def send_message(self, message):
            calls.append(("message", message))

    monkeypatch.setattr(smtplib, "SMTP", SMTP)
    send_reset_code("person@example.com", "123456")
    assert calls[0] == ("connect", "smtp.example.com", settings.smtp_port, 10)
    assert calls[1] == ("tls", True)
    assert calls[2] == ("login", "test-user")
    assert calls[3][1]["To"] == "person@example.com"
    assert "123456" in calls[3][1].get_content()


def test_smtp_failure_is_sanitized(monkeypatch):
    monkeypatch.setattr(get_settings(), "smtp_host", "smtp.example.com")

    def fail(*args, **kwargs):
        raise OSError("sensitive transport details")

    monkeypatch.setattr(smtplib, "SMTP", fail)
    with pytest.raises(DomainError) as caught:
        send_reset_code("person@example.com", "123456")
    assert caught.value.status == 503
    assert "sensitive" not in caught.value.message
